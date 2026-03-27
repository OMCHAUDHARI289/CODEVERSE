import Question from "../models/questions.js";
import Team from "../models/teams.js";
import { ROUND_CONFIG } from "../config/roundConfig.js";
import AppError from "../utils/appError.js";
import { executeAgainstTestCases } from "./executorService.js";
import {
  evaluateRound3Code,
  getRound3Challenge,
  getNextRound3Hint,
  ROUND3_HINT_COOLDOWN_SECONDS,
  ROUND3_POINTS_PER_BUG,
  ROUND3_TOTAL_BUGS,
  sanitizeRound3EditorCode
} from "../../client/src/pages/team/round3/round3ChallengeData.js";

const ROUND3 = ROUND_CONFIG.round3;
const ROUND3_ALLOWED_LANGUAGES = ROUND3.allowedLanguages || ["cpp", "java"];
const ROUND3_MAX_WARNINGS = Number(ROUND3.maxWarnings) || 3;
const ROUND3_MAX_RUNS = 10;
const ROUND3_LIFELINE_PENALTY = 20;
const ROUND3_MAX_CODE_SIZE = 100000;

const normalizeCode = (value = "") => String(value || "").replace(/\r\n/g, "\n");
const normalizeOutput = (value = "") => String(value || "").replace(/\r\n/g, "\n").trim();
const hintDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const getHintRemainingSeconds = (nextHintAvailableAt) => {
  const nextDate = hintDateOrNull(nextHintAvailableAt);
  if (!nextDate) return 0;
  return Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 1000));
};

const hasExecutionError = (execution) => {
  const stderr = normalizeOutput(execution?.stderr);
  const compileOutput = normalizeOutput(execution?.compileOutput);
  const nonZeroCode =
    typeof execution?.code === "number" && Number(execution.code) !== 0;

  return Boolean(stderr || compileOutput || nonZeroCode || execution?.signal);
};

const compareOutput = ({ actual, expected }) =>
  normalizeOutput(actual) === normalizeOutput(expected);

const sanitizeSolved = (value) => Math.max(0, Number(value) || 0);
const sanitizePenalty = (value) => Math.max(0, Number(value) || 0);

const sortTeams = (teams) =>
  [...teams].sort((a, b) => {
    if (a.solved !== b.solved) return b.solved - a.solved;
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    return String(a.name).localeCompare(String(b.name));
  });

const toRound3Output = (teams) => {
  const sanitized = teams.map((team) => ({
    name: String(team.name || ""),
    solved: sanitizeSolved(team.solved),
    penalty: sanitizePenalty(team.penalty)
  }));

  const ranked = sortTeams(sanitized);
  const totalSolved = sanitized.reduce((sum, team) => sum + team.solved, 0);
  const totalPenalty = sanitized.reduce((sum, team) => sum + team.penalty, 0);
  const averageSolved =
    sanitized.length > 0 ? (totalSolved / sanitized.length).toFixed(2) : "0.00";

  const lines = [
    `Average solved: ${averageSolved}`,
    `Total penalty: ${totalPenalty}`,
    "Leaderboard"
  ];

  for (let index = 0; index < ranked.length; index += 1) {
    const team = ranked[index];
    lines.push(`${index + 1}. ${team.name} ${team.solved} ${team.penalty}`);
  }

  return lines.join("\n");
};

const toRound3Input = (teams) => {
  const lines = [String(teams.length)];
  for (const team of teams) {
    lines.push(`${team.name} ${team.solved} ${team.penalty}`);
  }
  return lines.join("\n");
};

const buildTeamsForCase = (caseNo) => {
  const seed = Number(caseNo) || 1;
  const size = 3 + (seed % 4); // 3..6 teams
  const teams = [];

  for (let index = 0; index < size; index += 1) {
    const name = `${String.fromCharCode(65 + ((seed + index) % 26))}${seed}${index}`;
    const solved = ((seed * 3 + index * 7) % 11) - 2; // includes negatives
    const penalty = ((seed * 17 + index * 19) % 140) - (index % 2 === 0 ? 12 : 0);
    teams.push({ name, solved, penalty });
  }

  // Force ties to validate comparator order deterministically.
  if (size > 1 && seed % 2 === 0) {
    teams[1].solved = teams[0].solved;
  }
  if (size > 2 && seed % 3 === 0) {
    teams[2].penalty = teams[0].penalty;
  }
  if (size > 3 && seed % 5 === 0) {
    teams[3].solved = teams[0].solved;
    teams[3].penalty = teams[0].penalty;
  }

  return teams;
};

const ROUND3_EXECUTION_TEST_CASES = Array.from(
  { length: ROUND3_TOTAL_BUGS },
  (_, index) => {
    const id = index + 1;
    const teams = buildTeamsForCase(id);
    return {
      id,
      input: toRound3Input(teams),
      output: toRound3Output(teams)
    };
  }
);

const ensureRound3State = (team) => {
  if (!team.submissions) team.submissions = {};
  if (!team.submissions.round3) {
    team.submissions.round3 = {};
  }
  if (!team.roundRuntime) team.roundRuntime = {};
  if (!team.roundRuntime.round3) {
    team.roundRuntime.round3 = {};
  }
  if (!team.scores) {
    team.scores = { round1: 0, round2: 0, round3: 0 };
  }

  const submission = team.submissions.round3;
  const runtime = team.roundRuntime.round3;

  if (typeof submission.code !== "string") submission.code = "";
  if (typeof submission.score !== "number") submission.score = 0;
  if (typeof submission.fixedBugs !== "number") submission.fixedBugs = 0;
  if (typeof submission.totalBugs !== "number") submission.totalBugs = ROUND3_TOTAL_BUGS;
  if (typeof submission.warnings !== "number") submission.warnings = 0;
  if (typeof submission.runCount !== "number") submission.runCount = 0;
  if (typeof submission.hintCount !== "number") submission.hintCount = 0;
  if (!Array.isArray(submission.revealedHintBugIds)) submission.revealedHintBugIds = [];
  if (typeof submission.testResults !== "number") submission.testResults = 0;
  if (typeof submission.timeSpentSeconds !== "number") submission.timeSpentSeconds = 0;
  if (typeof submission.isStarted !== "boolean") submission.isStarted = false;
  if (typeof submission.isSubmitted !== "boolean") submission.isSubmitted = false;
  if (typeof submission.isSuspicious !== "boolean") submission.isSuspicious = false;

  if (typeof runtime.warningCount !== "number") {
    runtime.warningCount = submission.warnings || 0;
  }
};

const ensureRound3Access = (team) => {
  if ((Number(team.currentRound) || 1) < 3) {
    throw new AppError("Round 3 is locked", 403);
  }
};

const validateLanguage = (language) => {
  if (!language || !ROUND3_ALLOWED_LANGUAGES.includes(language)) {
    throw new AppError("Invalid language", 400);
  }
};

const getElapsedSeconds = (startedAt) => {
  if (!startedAt) return 0;
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
};

const getRound3LifelineUsageCount = (team) =>
  Number(team?.lifelines?.round3UsedCount) || (team?.lifelines?.round3Used ? 1 : 0);

const withRound3Penalty = (team, evaluation) => {
  const usedCount = getRound3LifelineUsageCount(team);
  const penaltyPoints = usedCount * ROUND3_LIFELINE_PENALTY;
  const rawScore = Number(evaluation.score) || 0;

  return {
    ...evaluation,
    rawScore,
    penaltyPoints,
    usedLifelines: usedCount,
    score: Math.max(0, rawScore - penaltyPoints)
  };
};

const evaluateRound3ByExecution = async ({ language, code }) => {
  const bugEvaluation = evaluateRound3Code({ language, code });
  const executionResults = await executeAgainstTestCases({
    code,
    language,
    testCases: ROUND3_EXECUTION_TEST_CASES
  });
  const executionFixedBugIds = executionResults
    .filter(
      (result, index) =>
        !hasExecutionError(result) &&
        compareOutput({
          actual: result?.output,
          expected: ROUND3_EXECUTION_TEST_CASES[index]?.output
        })
    )
    .map((result, index) => Number(ROUND3_EXECUTION_TEST_CASES[index]?.id || result?.caseNo || index + 1))
    .filter((id) => Number.isFinite(id));
  const executionPassed = executionFixedBugIds.length;
  const executionScore = executionPassed * ROUND3_POINTS_PER_BUG;
  const bugFixedBugIds = Array.isArray(bugEvaluation.fixedBugIds) ? bugEvaluation.fixedBugIds : [];
  const bugPassed = bugFixedBugIds.length;
  const bugScore = bugPassed * ROUND3_POINTS_PER_BUG;
  const useBugEvaluation = bugScore > executionScore;
  const finalPassed = useBugEvaluation ? bugPassed : executionPassed;
  const fixedBugIds = useBugEvaluation ? bugFixedBugIds : executionFixedBugIds;
  const remainingBugIds = useBugEvaluation
    ? Array.isArray(bugEvaluation.remainingBugIds)
      ? bugEvaluation.remainingBugIds
      : []
    : ROUND3_EXECUTION_TEST_CASES.map((testCase) => Number(testCase.id)).filter(
        (id) => !executionFixedBugIds.includes(id)
      );
  const finalScore = Math.max(executionScore, bugScore);

  return {
    passed: finalPassed,
    executionPassed,
    bugPassed,
    total: ROUND3_TOTAL_BUGS,
    executionScore,
    bugScore,
    score: finalScore,
    fixedBugIds,
    remainingBugIds,
    title: bugEvaluation.title || getRound3Challenge(language).subtitle
  };
};

const buildChallengePayload = async ({ language, codeOverride }) => {
  const challenge = getRound3Challenge(language);
  const question = await Question.findOne({
    round: 3,
    language
  }).select("title description buggyCode marks language");

  return {
    language,
    label: challenge.label,
    title: question?.title || challenge.title,
    subtitle: challenge.subtitle,
    description:
      question?.description ||
      `${challenge.subtitle}. Fix ${ROUND3_TOTAL_BUGS} deliberate bugs in the provided ${challenge.label} program.`,
    systems: challenge.systems || [],
    totalBugs: ROUND3_TOTAL_BUGS,
    pointsPerBug: ROUND3_POINTS_PER_BUG,
    maxScore: Number(question?.marks) || ROUND3.maxScore,
    code:
      typeof codeOverride === "string"
        ? sanitizeRound3EditorCode(codeOverride)
        : challenge.buggyCode
  };
};

const buildResultPayload = (result, { mode, reason = "", submittedAt = null }) => ({
  ...result,
  mode,
  reason: reason || undefined,
  submittedAt,
  verdict:
    mode === "submit"
      ? Number(result.passed) === Number(result.total)
        ? "accepted"
        : "partial"
      : "analysis-complete"
});

const buildHintState = (submission) => {
  const remainingSeconds = getHintRemainingSeconds(submission?.nextHintAvailableAt);

  return {
    usedCount: Number(submission?.hintCount) || 0,
    revealedBugIds: Array.isArray(submission?.revealedHintBugIds)
      ? submission.revealedHintBugIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [],
    cooldownSeconds: ROUND3_HINT_COOLDOWN_SECONDS,
    nextAvailableAt: submission?.nextHintAvailableAt || null,
    remainingSeconds,
    availableNow: remainingSeconds <= 0
  };
};

const buildStatusPayload = async (team) => {
  ensureRound3State(team);

  const submission = team.submissions.round3;
  const runtime = team.roundRuntime.round3;
  const language = submission.selectedLanguage || submission.language || "";
  const startedAt = submission.startedAt || runtime.startedAt || null;
  const elapsedSeconds = submission.isSubmitted
    ? Number(submission.timeSpentSeconds) || getElapsedSeconds(startedAt)
    : getElapsedSeconds(startedAt);
  const remainingSeconds = Math.max(0, ROUND3.durationSeconds - elapsedSeconds);
  const warningCount = Math.max(
    Number(submission.warnings) || 0,
    Number(runtime.warningCount) || 0
  );
  const isSuspicious =
    Boolean(submission.isSuspicious) || warningCount > ROUND3_MAX_WARNINGS;

  const challenge = language
    ? await buildChallengePayload({
        language,
        codeOverride: submission.code
      })
    : null;
  const hasLastRun =
    (Number(submission.runCount) || 0) > 0 ||
    Boolean(submission.lastRunAt) ||
    Boolean(submission.lastRun?.recordedAt);
  const hasFinalResult =
    Boolean(submission.isSubmitted) &&
    (Boolean(submission.submittedAt) || Boolean(submission.finalResult?.recordedAt));

  return {
    round: 3,
    started: Boolean(submission.isStarted),
    submitted: Boolean(submission.isSubmitted),
    durationSeconds: ROUND3.durationSeconds,
    elapsedSeconds,
    remainingSeconds,
    maxScore: ROUND3.maxScore,
    totalBugs: ROUND3_TOTAL_BUGS,
    pointsPerBug: ROUND3_POINTS_PER_BUG,
    maxRuns: ROUND3_MAX_RUNS,
    maxWarnings: ROUND3_MAX_WARNINGS,
    selectedLanguage: language || null,
    warnings: warningCount,
    isSuspicious,
    runCount: Number(submission.runCount) || 0,
    startedAt,
    lastRunAt: submission.lastRunAt || runtime.lastRunAt || null,
    submittedAt: submission.submittedAt || null,
    lastActivityAt: submission.lastActivityAt || null,
    challenge,
    hint: buildHintState(submission),
    lastRun: hasLastRun ? submission.lastRun || null : null,
    finalResult: hasFinalResult ? submission.finalResult || null : null,
    result: submission.isSubmitted
      ? {
          score: Number(submission.score) || 0,
          rawScore:
            Number(submission.rawScore) || Number(submission.score) || 0,
          penaltyPoints: Number(submission.penaltyPoints) || 0,
          usedLifelines: Number(submission.usedLifelines) || 0,
          fixedBugs: Number(submission.fixedBugs) || 0,
          totalBugs: Number(submission.totalBugs) || ROUND3_TOTAL_BUGS,
          submitReason: submission.submitReason || "",
          submittedAt: submission.submittedAt || null,
          verdict: submission.finalResult?.verdict || ""
        }
      : null
  };
};

const ensureStartedChallenge = async (team) => {
  ensureRound3State(team);
  ensureRound3Access(team);

  const submission = team.submissions.round3;
  const language = submission.selectedLanguage || submission.language;

  if (!submission.isStarted || !language) {
    throw new AppError("Round 3 not started", 400);
  }

  if (submission.isSubmitted) {
    throw new AppError("Round 3 already submitted", 400);
  }

  return {
    submission,
    runtime: team.roundRuntime.round3,
    language
  };
};

export const startRound3Challenge = async ({ team, language }) => {
  ensureRound3Access(team);
  ensureRound3State(team);

  const submission = team.submissions.round3;
  const runtime = team.roundRuntime.round3;

  if (submission.isSubmitted) {
    return buildStatusPayload(team);
  }

  if (submission.isStarted) {
    const lockedLanguage = submission.selectedLanguage || submission.language;
    if (language && lockedLanguage !== language) {
      throw new AppError(
        `Round 3 already started in ${String(lockedLanguage).toUpperCase()}`,
        400
      );
    }

    return buildStatusPayload(team);
  }

  validateLanguage(language);

  const challenge = await buildChallengePayload({ language });
  const now = new Date();

  // FIX #8: Atomic start - prevent duplicate starts
  const updated = await Team.findOneAndUpdate(
    {
      _id: team._id,
      $or: [
        { "submissions.round3.isStarted": false },
        { "submissions.round3.isStarted": { $exists: false } }
      ]
    },
    {
      $set: {
        "submissions.round3.selectedLanguage": language,
        "submissions.round3.language": language,
        "submissions.round3.code": challenge.code,
        "submissions.round3.score": 0,
        "submissions.round3.rawScore": 0,
        "submissions.round3.penaltyPoints": 0,
        "submissions.round3.usedLifelines": getRound3LifelineUsageCount(team),
        "submissions.round3.fixedBugs": 0,
        "submissions.round3.totalBugs": ROUND3_TOTAL_BUGS,
        "submissions.round3.warnings": 0,
        "submissions.round3.runCount": 0,
        "submissions.round3.hintCount": 0,
        "submissions.round3.revealedHintBugIds": [],
        "submissions.round3.isStarted": true,
        "submissions.round3.isSubmitted": false,
        "submissions.round3.isSuspicious": false,
        "submissions.round3.startedAt": now,
        "submissions.round3.nextHintAvailableAt": now,
        "submissions.round3.lastActivityAt": now,
        "submissions.round3.submitReason": "",
        "submissions.round3.timeSpentSeconds": 0,
        "submissions.round3.testResults": 0,
        "roundRuntime.round3.startedAt": now,
        "roundRuntime.round3.warningCount": 0
      }
    },
    { new: true }
  );

  if (!updated) {
    // Already started (or raced), return latest persisted status
    const freshTeam = await Team.findById(team._id);
    return buildStatusPayload(freshTeam || team);
  }

  return buildStatusPayload(updated);
};

export const addRound3WarningState = async (team) => {
  ensureRound3Access(team);
  ensureRound3State(team);

  const submission = team.submissions.round3;
  const runtime = team.roundRuntime.round3;

  if (!submission.isStarted || submission.isSubmitted) {
    throw new AppError("Round 3 is not active", 400);
  }

  const nextWarnings = Math.max(
    Number(submission.warnings) || 0,
    Number(runtime.warningCount) || 0
  ) + 1;

  const isSuspicious = nextWarnings > ROUND3_MAX_WARNINGS;
  const now = new Date();

  // FIX #9: Atomic warning update
  const updated = await Team.findOneAndUpdate(
    {
      _id: team._id,
      "submissions.round3.isStarted": true,
      "submissions.round3.isSubmitted": false
    },
    {
      $set: {
        "submissions.round3.warnings": nextWarnings,
        "submissions.round3.isSuspicious": isSuspicious,
        "submissions.round3.lastActivityAt": now,
        "roundRuntime.round3.warningCount": nextWarnings
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError("Round 3 is not active", 400);
  }

  return {
    warnings: nextWarnings,
    maxWarnings: ROUND3_MAX_WARNINGS,
    isSuspicious: isSuspicious
  };
};

export const revealRound3Hint = async ({ team, code }) => {
  const { submission, language } = await ensureStartedChallenge(team);
  const currentCode = sanitizeRound3EditorCode(
    typeof code === "string" ? code : submission.code || ""
  );

  if (!currentCode.trim()) {
    throw new AppError("Code is required", 400);
  }

  if (currentCode.length > ROUND3_MAX_CODE_SIZE) {
    throw new AppError("Code too large", 400);
  }

  const remainingSeconds = getHintRemainingSeconds(submission.nextHintAvailableAt);
  if (remainingSeconds > 0) {
    throw new AppError(`Hint will be available in ${remainingSeconds} seconds`, 400);
  }

  const hint = getNextRound3Hint({
    language,
    code: currentCode,
    revealedHintBugIds: submission.revealedHintBugIds
  });

  if (!hint) {
    throw new AppError("No more hints are available for this challenge", 400);
  }

  const now = new Date();
  const nextHintAvailableAt = new Date(
    now.getTime() + ROUND3_HINT_COOLDOWN_SECONDS * 1000
  );

  const updated = await Team.findOneAndUpdate(
    {
      _id: team._id,
      "submissions.round3.isStarted": true,
      "submissions.round3.isSubmitted": false,
      $or: [
        { "submissions.round3.nextHintAvailableAt": { $exists: false } },
        { "submissions.round3.nextHintAvailableAt": { $lte: now } }
      ]
    },
    {
      $set: {
        "submissions.round3.code": hint.code,
        "submissions.round3.nextHintAvailableAt": nextHintAvailableAt,
        "submissions.round3.lastActivityAt": now
      },
      $inc: {
        "submissions.round3.hintCount": 1
      },
      $addToSet: {
        "submissions.round3.revealedHintBugIds": hint.bugId
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError("Hint is cooling down right now", 400);
  }

  const refreshedSubmission = updated.submissions?.round3 || {};

  return {
    code: hint.code,
    bugId: hint.bugId,
    comment: hint.comment,
    hint: buildHintState(refreshedSubmission)
  };
};

export const runRound3Challenge = async ({ team, code }) => {
  const { submission, runtime, language } = await ensureStartedChallenge(team);
  const currentRunCount = Number(submission.runCount) || 0;

  if (currentRunCount >= ROUND3_MAX_RUNS) {
    throw new AppError(`Run limit exceeded. Maximum ${ROUND3_MAX_RUNS} runs allowed`, 400);
  }

  if (!code || !String(code).trim()) {
    throw new AppError("Code is required", 400);
  }
  if (String(code).length > ROUND3_MAX_CODE_SIZE) {
    throw new AppError("Code too large", 400);
  }

  const now = new Date();
  const normalizedCode = sanitizeRound3EditorCode(code);
  const executionEvaluation = await evaluateRound3ByExecution({
    language,
    code: normalizedCode
  });
  const evaluation = withRound3Penalty(team, executionEvaluation);
  const resultPayload = buildResultPayload(evaluation, { mode: "run" });

  const runCount = currentRunCount + 1;
  const timeSpentSeconds = Math.min(
    ROUND3.durationSeconds,
    getElapsedSeconds(submission.startedAt || runtime.startedAt)
  );

  const lastRun = {
    passed: evaluation.passed,
    executionPassed: Number(evaluation.executionPassed) || 0,
    total: evaluation.total,
    score: evaluation.score,
    rawScore: Number(evaluation.rawScore) || Number(evaluation.score) || 0,
    penaltyPoints: Number(evaluation.penaltyPoints) || 0,
    usedLifelines: Number(evaluation.usedLifelines) || 0,
    verdict: resultPayload.verdict,
    fixedBugIds: evaluation.fixedBugIds,
    remainingBugIds: evaluation.remainingBugIds,
    recordedAt: now
  };

  // FIX #7: Atomic run update - prevent concurrent modification issues
  const updated = await Team.findOneAndUpdate(
    {
      _id: team._id,
      "submissions.round3.isSubmitted": false
    },
    {
      $set: {
        "submissions.round3.code": normalizedCode,
        "submissions.round3.runCount": runCount,
        "submissions.round3.fixedBugs": evaluation.passed,
        "submissions.round3.totalBugs": evaluation.total,
        "submissions.round3.rawScore": Number(evaluation.rawScore) || Number(evaluation.score) || 0,
        "submissions.round3.penaltyPoints": Number(evaluation.penaltyPoints) || 0,
        "submissions.round3.usedLifelines": Number(evaluation.usedLifelines) || 0,
        "submissions.round3.lastRun": lastRun,
        "submissions.round3.lastRunAt": now,
        "submissions.round3.lastActivityAt": now,
        "submissions.round3.timeSpentSeconds": timeSpentSeconds,
        "submissions.round3.testResults": Number(evaluation.executionPassed) || 0
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError("Cannot run after submission", 400);
  }

  return resultPayload;
};

export const submitRound3Challenge = async ({ team, code, reason = "manual" }) => {
  const { submission, runtime, language } = await ensureStartedChallenge(team);

  if (!code || !String(code).trim()) {
    throw new AppError("Code is required", 400);
  }
  if (String(code).length > ROUND3_MAX_CODE_SIZE) {
    throw new AppError("Code too large", 400);
  }

  const startedAt = submission.startedAt || runtime.startedAt || new Date();
  const elapsedSeconds = getElapsedSeconds(startedAt);
  const warningCount = Math.max(
    Number(submission.warnings) || 0,
    Number(runtime.warningCount) || 0
  );
  const normalizedReason = String(reason || "manual").trim().toLowerCase() || "manual";
  const isTimedOut = elapsedSeconds >= ROUND3.durationSeconds;

  if (normalizedReason === "timeout" && !isTimedOut) {
    throw new AppError("Timeout submission is not valid yet", 400);
  }

  if (normalizedReason === "warning" && warningCount <= ROUND3_MAX_WARNINGS) {
    throw new AppError("Warning submission is not valid yet", 400);
  }

  if (isTimedOut && normalizedReason === "manual") {
    throw new AppError("Time is over", 400);
  }

  const now = new Date();
  const normalizedCode = sanitizeRound3EditorCode(code);
  const executionEvaluation = await evaluateRound3ByExecution({
    language,
    code: normalizedCode
  });
  const evaluation = withRound3Penalty(team, executionEvaluation);
  const resultPayload = buildResultPayload(evaluation, {
    mode: "submit",
    reason: normalizedReason,
    submittedAt: now.toISOString()
  });

  const finalResult = {
    passed: evaluation.passed,
    executionPassed: Number(evaluation.executionPassed) || 0,
    total: evaluation.total,
    score: evaluation.score,
    rawScore: Number(evaluation.rawScore) || Number(evaluation.score) || 0,
    penaltyPoints: Number(evaluation.penaltyPoints) || 0,
    usedLifelines: Number(evaluation.usedLifelines) || 0,
    verdict: resultPayload.verdict,
    fixedBugIds: evaluation.fixedBugIds,
    remainingBugIds: evaluation.remainingBugIds,
    recordedAt: now
  };

  // FIX #6: Atomic submit - prevent double submissions and race conditions
  const updated = await Team.findOneAndUpdate(
    {
      _id: team._id,
      "submissions.round3.isSubmitted": { $ne: true }
    },
    {
      $set: {
        "submissions.round3.code": normalizedCode,
        "submissions.round3.score": evaluation.score,
        "submissions.round3.rawScore": Number(evaluation.rawScore) || Number(evaluation.score) || 0,
        "submissions.round3.penaltyPoints": Number(evaluation.penaltyPoints) || 0,
        "submissions.round3.usedLifelines": Number(evaluation.usedLifelines) || 0,
        "submissions.round3.fixedBugs": evaluation.passed,
        "submissions.round3.totalBugs": evaluation.total,
        "submissions.round3.warnings": warningCount,
        "submissions.round3.testResults": Number(evaluation.executionPassed) || 0,
        "submissions.round3.isStarted": true,
        "submissions.round3.isSubmitted": true,
        "submissions.round3.isSuspicious": Boolean(submission.isSuspicious) || warningCount > ROUND3_MAX_WARNINGS,
        "submissions.round3.submitReason": normalizedReason,
        "submissions.round3.startedAt": startedAt,
        "submissions.round3.submittedAt": now,
        "submissions.round3.lastRunAt": now,
        "submissions.round3.lastActivityAt": now,
        "submissions.round3.timeSpentSeconds": Math.min(ROUND3.durationSeconds, elapsedSeconds),
        "submissions.round3.lastRun": {
          passed: evaluation.passed,
          executionPassed: Number(evaluation.executionPassed) || 0,
          total: evaluation.total,
          score: evaluation.score,
          rawScore: Number(evaluation.rawScore) || Number(evaluation.score) || 0,
          penaltyPoints: Number(evaluation.penaltyPoints) || 0,
          usedLifelines: Number(evaluation.usedLifelines) || 0,
          verdict: "analysis-complete",
          fixedBugIds: evaluation.fixedBugIds,
          remainingBugIds: evaluation.remainingBugIds,
          recordedAt: now
        },
        "submissions.round3.finalResult": finalResult,
        "scores.round3": evaluation.score,
        "currentRound": Math.max(Number(team.currentRound) || 3, 4),
        "completedAt": now
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError("Already submitted", 400);
  }

  // Keep denormalized totalScore in sync for leaderboard consumers.
  updated.totalScore =
    (Number(updated?.scores?.round1) || 0) +
    (Number(updated?.scores?.round2) || 0) +
    (Number(updated?.scores?.round3) || 0);
  await updated.save();

  return resultPayload;
};

export const getRound3StatusPayload = async (team) => {
  ensureRound3Access(team);
  return buildStatusPayload(team);
};

export const getRound3ResultPayload = async (team) => {
  ensureRound3Access(team);
  const status = await buildStatusPayload(team);

  return {
    round: 3,
    submitted: Boolean(status.submitted),
    maxScore: status.maxScore,
    totalBugs: status.totalBugs,
    pointsPerBug: status.pointsPerBug,
    selectedLanguage: status.selectedLanguage,
    startedAt: status.startedAt,
    submittedAt: status.submittedAt,
    score: Number(team.submissions?.round3?.score) || 0,
    rawScore:
      Number(team.submissions?.round3?.rawScore) ||
      Number(team.submissions?.round3?.score) ||
      0,
    penaltyPoints: Number(team.submissions?.round3?.penaltyPoints) || 0,
    usedLifelines: Number(team.submissions?.round3?.usedLifelines) || 0,
    fixedBugs: Number(team.submissions?.round3?.fixedBugs) || 0,
    warnings: status.warnings,
    isSuspicious: status.isSuspicious,
    submitReason: team.submissions?.round3?.submitReason || "",
    hint: status.hint,
    lastRun: status.lastRun,
    finalResult: status.finalResult
  };
};
