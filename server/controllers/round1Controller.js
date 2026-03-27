import Question from "../models/questions.js";
import Team from "../models/teams.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ROUND_CONFIG } from "../config/roundConfig.js";

const { round1: ROUND1 } = ROUND_CONFIG;

const UNANSWERED = -1;

/* ──────────────────────────────
   UTILS
────────────────────────────── */

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const sanitizeQuestion = (q) => ({
  _id: q._id,
  question: q.title || q.question,
  codeSnippet: q.codeSnippet,
  options: q.options || [],
  marks: q.marks || 0
});

const ensureRuntime = (team) => {
  if (!team.roundRuntime) team.roundRuntime = {};
  if (!team.roundRuntime.round1) {
    team.roundRuntime.round1 = {
      questionOrder: [],
      warningCount: 0
    };
  }
};

const buildOrderedQuestions = async (questionOrder) => {
  if (!questionOrder.length) {
    throw new AppError("Question order missing", 500);
  }

  const questions = await Question.find({
    _id: { $in: questionOrder },
    round: 1
  }).select("title codeSnippet options marks correctAnswer");

  const map = new Map(questions.map(q => [q._id.toString(), q]));

  return questionOrder
    .map(id => map.get(id.toString()))
    .filter(Boolean);
};

/* ──────────────────────────────
   STATUS
────────────────────────────── */

const getStatusPayload = async (team) => {
  ensureRuntime(team);

  const runtime = team.roundRuntime.round1;
  const submitted = Boolean(team.submissions?.round1?.isSubmitted);
  const started = Boolean(runtime.startedAt && runtime.questionOrder?.length);

  let orderedQuestions = [];
  let elapsedSeconds = 0;

  if (started) {
    orderedQuestions = await buildOrderedQuestions(runtime.questionOrder);
    elapsedSeconds = Math.floor(
      (Date.now() - new Date(runtime.startedAt).getTime()) / 1000
    );
  }

  const duration = ROUND1.durationSeconds;
  const remaining = Math.max(0, duration - elapsedSeconds);

  const maxPoints = orderedQuestions.reduce(
    (sum, q) => sum + (q.marks || 0),
    0
  );

  return {
    round: 1,
    started,
    submitted,
    durationSeconds: duration,
    elapsedSeconds,
    remainingSeconds: remaining,
    warningCount: runtime.warningCount || 0,
    maxWarnings: ROUND1.maxWarnings,
    totalQuestions: orderedQuestions.length,
    maxPoints,

    questions: submitted
      ? []
      : orderedQuestions.map(sanitizeQuestion),

    result: submitted
      ? {
          score: team.submissions.round1.score || 0,
          correctCount: team.submissions.round1.correctCount || 0,
          submittedAt: team.submissions.round1.submittedAt
        }
      : null
  };
};

/* ──────────────────────────────
   CONTROLLERS
────────────────────────────── */

// STATUS
export const getRound1Status = asyncHandler(async (req, res) => {
  const payload = await getStatusPayload(req.team);
  res.json(payload);
});

// START
export const startRound1 = asyncHandler(async (req, res) => {
  const team = req.team;

  if (team.currentRound !== 1) {
    throw new AppError("Not allowed", 403);
  }

  if (team.submissions?.round1?.isSubmitted) {
    throw new AppError("Already submitted", 400);
  }

  ensureRuntime(team);
  const runtime = team.roundRuntime.round1;

  // Prevent restart
  if (runtime.startedAt) {
    const payload = await getStatusPayload(team);
    return res.json(payload);
  }

  const questions = await Question.find({ round: 1 });

  if (!questions.length) {
    throw new AppError("No questions found", 404);
  }

  const shuffled = shuffle(questions);

  runtime.questionOrder = shuffled.map(q => q._id);
  runtime.startedAt = new Date();
  runtime.warningCount = 0;

  await team.save();

  const payload = await getStatusPayload(team);
  res.json(payload);
});

// QUESTIONS
export const getRound1Questions = asyncHandler(async (req, res) => {
  const team = req.team;

  if (team.currentRound !== 1) {
    throw new AppError("Not allowed", 403);
  }

  if (team.submissions?.round1?.isSubmitted) {
    throw new AppError("Already submitted", 400);
  }

  ensureRuntime(team);
  const runtime = team.roundRuntime.round1;

  if (!runtime.startedAt || !runtime.questionOrder.length) {
    throw new AppError("Round not started", 400);
  }

  const ordered = await buildOrderedQuestions(runtime.questionOrder);

  res.json(ordered.map(sanitizeQuestion));
});

// WARNING
export const addRound1Warning = asyncHandler(async (req, res) => {
  const team = req.team;

  if (team.currentRound !== 1) {
    throw new AppError("Not allowed", 403);
  }

  ensureRuntime(team);
  const runtime = team.roundRuntime.round1;

  if (runtime.warningCount >= ROUND1.maxWarnings) {
    return res.json({
      warningCount: runtime.warningCount,
      maxWarnings: ROUND1.maxWarnings,
      shouldAutoSubmit: true
    });
  }

  runtime.warningCount += 1;
  await team.save();

  res.json({
    warningCount: runtime.warningCount,
    maxWarnings: ROUND1.maxWarnings,
    shouldAutoSubmit: runtime.warningCount >= ROUND1.maxWarnings
  });
});

// SUBMIT
export const submitRound1 = asyncHandler(async (req, res) => {
  const team = req.team;
  const { answers, autoSubmit } = req.body;

  if (team.currentRound !== 1) {
    throw new AppError("Not allowed", 403);
  }

  if (!Array.isArray(answers)) {
    throw new AppError("Answers must be array", 400);
  }

  ensureRuntime(team);
  const runtime = team.roundRuntime.round1;

  if (!runtime.startedAt || !runtime.questionOrder.length) {
    throw new AppError("Round not started", 400);
  }

  const elapsed = Math.floor(
    (Date.now() - new Date(runtime.startedAt).getTime()) / 1000
  );

  const isTimeOver = elapsed > ROUND1.durationSeconds;

  if (isTimeOver && !autoSubmit) {
    throw new AppError("Time is over", 400);
  }

  if (autoSubmit && runtime.warningCount < ROUND1.maxWarnings && !isTimeOver) {
    throw new AppError("Invalid auto submit", 400);
  }

  const questions = await buildOrderedQuestions(runtime.questionOrder);

  if (answers.length !== questions.length) {
    throw new AppError("Invalid answers length", 400);
  }

  let score = 0;
  let correctCount = 0;

  const normalized = answers.map((val, i) => {
    if (val === null || val === undefined || val === "") {
      return UNANSWERED;
    }

    if (!Number.isInteger(val)) {
      throw new AppError(`Invalid answer at Q${i + 1}`, 400);
    }

    const q = questions[i];

    if (val < 0 || val >= (q.options?.length || 0)) {
      throw new AppError(`Invalid option at Q${i + 1}`, 400);
    }

    if (val === q.correctAnswer) {
      score += q.marks || 0;
      correctCount++;
    }

    return val;
  });

  // ✅ ATOMIC SUBMIT (prevents double submission)
  const updated = await Team.findOneAndUpdate(
    {
      _id: team._id,
      "submissions.round1.isSubmitted": { $ne: true }
    },
    {
      $set: {
        "submissions.round1": {
          answers: normalized,
          isSubmitted: true,
          submittedAt: new Date(),
          score,
          correctCount,
          timeSpentSeconds: Math.min(elapsed, ROUND1.durationSeconds)
        },
        "scores.round1": score,
        currentRound: 2
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError("Already submitted", 400);
  }

  res.json({
    message: "Round 1 submitted",
    score,
    correct: correctCount,
    totalQuestions: questions.length
  });
});
