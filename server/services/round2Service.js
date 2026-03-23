import Question from "../models/questions.js";
import { ROUND_CONFIG } from "../config/roundConfig.js";
import AppError from "../utils/appError.js";
import { executeWithJudge0 } from "./judge0Service.js";

const ROUND2 = ROUND_CONFIG.round2;
const SUB_KEYS = ["subA", "subB"];

const DEFAULT_STARTER = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  // write your code here

  return 0;
}
`,
  java: `import java.io.*;
import java.util.*;

public class Main {
  public static void main(String[] args) throws Exception {
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

    // write your code here
  }
}
`
};

const normalizeWhitespace = (value = "") =>
  String(value).replace(/\r\n/g, "\n").trim();

const tokenizeAndSort = (value = "") =>
  normalizeWhitespace(value)
    .split(/\s+/)
    .filter(Boolean)
    .sort();

const compareOutput = ({ actual, expected, ignoreOrder }) => {
  if (ignoreOrder) {
    const actualTokens = tokenizeAndSort(actual);
    const expectedTokens = tokenizeAndSort(expected);
    if (actualTokens.length !== expectedTokens.length) return false;
    return actualTokens.every((token, index) => token === expectedTokens[index]);
  }
  return normalizeWhitespace(actual) === normalizeWhitespace(expected);
};

const ensureRound2State = (team) => {
  if (!team.submissions) team.submissions = {};
  if (!team.submissions.round2) {
    team.submissions.round2 = {};
  }

  const round2 = team.submissions.round2;

  for (const subKey of SUB_KEYS) {
    if (!round2[subKey]) {
      round2[subKey] = {};
    }
    const sub = round2[subKey];
    if (typeof sub.isStarted !== "boolean") sub.isStarted = false;
    if (typeof sub.isSubmitted !== "boolean") sub.isSubmitted = false;
    if (typeof sub.passed !== "boolean") sub.passed = false;
    if (typeof sub.score !== "number") sub.score = 0;
    if (!sub.code) sub.code = "";
  }

  if (typeof round2.totalScore !== "number") {
    round2.totalScore = 0;
  }
};

const getSubState = (team, subKey) => {
  ensureRound2State(team);
  return team.submissions.round2[subKey];
};

const validateSubKey = (subKey) => {
  if (!SUB_KEYS.includes(subKey)) {
    throw new AppError("Invalid sub round", 400);
  }
};

const validateDifficulty = (difficulty) => {
  if (!difficulty || !Object.hasOwn(ROUND2.difficultyPoints, difficulty)) {
    throw new AppError("Invalid difficulty", 400);
  }
};

const validateLanguage = (language) => {
  if (!language || !ROUND2.allowedLanguages.includes(language)) {
    throw new AppError("Invalid language", 400);
  }
};

const getQuestionTestCases = (question) => {
  const visible = Array.isArray(question.visibleTestCases) && question.visibleTestCases.length
    ? question.visibleTestCases
    : Array.isArray(question.testCases)
      ? question.testCases.slice(0, 2)
      : [];

  const hidden = Array.isArray(question.hiddenTestCases)
    ? question.hiddenTestCases
    : [];

  return { visible, hidden };
};

const ensureRound2Access = (team) => {
  if (team.currentRound !== 2) {
    throw new AppError("Round 2 is locked", 403);
  }
};

const sanitizeProblemForClient = (question, language) => {
  const { visible } = getQuestionTestCases(question);
  return {
    _id: question._id,
    title: question.title || "Untitled Problem",
    description: question.description || "",
    difficulty: question.difficulty || "easy",
    constraints: question.constraints || [],
    inputFormat: question.inputFormat || "",
    outputFormat: question.outputFormat || "",
    visibleTestCases: visible.map((testCase) => ({
      input: testCase.input,
      output: testCase.output
    })),
    starterCode:
      question?.starterCode?.[language] ||
      DEFAULT_STARTER[language] ||
      DEFAULT_STARTER.cpp
  };
};

const findRound2Question = async ({ difficulty, excludeQuestionId }) => {
  const query = {
    round: 2,
    difficulty
  };

  if (excludeQuestionId) {
    query._id = { $ne: excludeQuestionId };
  }

  const candidates = await Question.find(query);
  if (!candidates.length) {
    throw new AppError(
      "No Round 2 problem available for selected difficulty",
      404
    );
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
};

const getRound2QuestionById = async (questionId) => {
  if (!questionId) {
    throw new AppError("Problem not assigned for this sub round", 400);
  }
  const question = await Question.findById(questionId);
  if (!question || question.round !== 2) {
    throw new AppError("Problem not found", 404);
  }
  return question;
};

const publicSubPayload = (sub) => ({
  difficulty: sub.difficulty || null,
  language: sub.language || null,
  isStarted: Boolean(sub.isStarted),
  isSubmitted: Boolean(sub.isSubmitted),
  passed: Boolean(sub.passed),
  score: Number(sub.score) || 0,
  startedAt: sub.startedAt || null,
  submittedAt: sub.submittedAt || null
});

const recomputeTeamRound2Totals = (team) => {
  ensureRound2State(team);
  if (!team.scores) {
    team.scores = { round1: 0, round2: 0, round3: 0 };
  }
  const round2 = team.submissions.round2;
  const nextRound2Score =
    (Number(round2.subA?.score) || 0) + (Number(round2.subB?.score) || 0);

  const prevRound2Score = Number(team.scores?.round2) || 0;
  const prevTotal = Number(team.totalScore) || 0;

  team.scores.round2 = nextRound2Score;
  round2.totalScore = nextRound2Score;
  team.totalScore = prevTotal - prevRound2Score + nextRound2Score;
};

const evaluateTestCases = async ({
  question,
  sourceCode,
  language,
  includeHidden
}) => {
  const { visible, hidden } = getQuestionTestCases(question);
  const all = includeHidden ? [...visible, ...hidden] : [...visible];

  if (!all.length) {
    throw new AppError("Problem has no test cases", 500);
  }

  const languageId = ROUND2.judge0.languageIds[language];
  if (!languageId) {
    throw new AppError("Judge0 language mapping missing", 500);
  }

  const results = [];
  for (let index = 0; index < all.length; index += 1) {
    const testCase = all[index];
    const execution = await executeWithJudge0({
      sourceCode,
      languageId,
      stdin: testCase.input
    });

    const passedByOutput = compareOutput({
      actual: execution.stdout,
      expected: testCase.output,
      ignoreOrder: Boolean(testCase.ignoreOrder)
    });

    const passed = execution.statusId === 3 && passedByOutput;

    results.push({
      index: index + 1,
      isHidden: index >= visible.length,
      passed,
      status: execution.status,
      time: execution.time,
      actualOutput: normalizeWhitespace(execution.stdout),
      expectedOutput: normalizeWhitespace(testCase.output),
      stderr: execution.stderr,
      compileOutput: execution.compileOutput,
      message: execution.message
    });
  }

  return {
    visibleCount: visible.length,
    hiddenCount: hidden.length,
    results
  };
};

export const startSubRound = async ({ team, subKey, difficulty, language }) => {
  validateSubKey(subKey);
  ensureRound2Access(team);
  ensureRound2State(team);

  if (subKey === "subB" && !team.submissions.round2.subA.isSubmitted) {
    throw new AppError("Submit Sub A before starting Sub B", 400);
  }

  const sub = getSubState(team, subKey);

  if (sub.isSubmitted) {
    throw new AppError(`${subKey.toUpperCase()} already submitted`, 400);
  }

  if (sub.isStarted) {
    const existingQuestion = await getRound2QuestionById(sub.problemId);
    return {
      subKey,
      sub: publicSubPayload(sub),
      problem: sanitizeProblemForClient(existingQuestion, sub.language),
      code: sub.code || ""
    };
  }

  validateDifficulty(difficulty);
  validateLanguage(language);

  const excludeQuestionId =
    subKey === "subB" ? team.submissions.round2.subA.problemId : null;

  const question = await findRound2Question({
    difficulty,
    excludeQuestionId
  });

  const now = new Date();
  if (!team.submissions.round2.startedAt) {
    team.submissions.round2.startedAt = now;
  }

  sub.problemId = question._id;
  sub.difficulty = difficulty;
  sub.language = language;
  sub.code = sanitizeProblemForClient(question, language).starterCode;
  sub.isStarted = true;
  sub.isSubmitted = false;
  sub.passed = false;
  sub.score = 0;
  sub.startedAt = now;
  sub.submittedAt = null;

  await team.save();

  return {
    subKey,
    sub: publicSubPayload(sub),
    problem: sanitizeProblemForClient(question, language),
    code: sub.code || ""
  };
};

export const runOrSubmitSubRound = async ({
  team,
  subKey,
  code,
  mode = "submit"
}) => {
  validateSubKey(subKey);
  ensureRound2Access(team);
  ensureRound2State(team);

  if (!["run", "submit"].includes(mode)) {
    throw new AppError("Invalid mode", 400);
  }

  const sub = getSubState(team, subKey);

  if (!sub.isStarted || !sub.problemId) {
    throw new AppError(`${subKey.toUpperCase()} not started`, 400);
  }

  if (sub.isSubmitted) {
    throw new AppError(`${subKey.toUpperCase()} already submitted`, 400);
  }

  if (!code || !code.trim()) {
    throw new AppError("Code is required", 400);
  }

  const question = await getRound2QuestionById(sub.problemId);
  const { visible, hidden } = getQuestionTestCases(question);

  if (mode === "run" && !visible.length) {
    throw new AppError("No visible test cases configured for this problem", 500);
  }

  const evaluation = await evaluateTestCases({
    question,
    sourceCode: code,
    language: sub.language,
    includeHidden: mode === "submit"
  });

  const visibleResults = evaluation.results.filter((item) => !item.isHidden);
  const hiddenResults = evaluation.results.filter((item) => item.isHidden);

  if (mode === "run") {
    const visiblePassed = visibleResults.every((item) => item.passed);
    return {
      mode,
      passed: visiblePassed,
      visible: {
        total: evaluation.visibleCount,
        passed: visibleResults.filter((item) => item.passed).length,
        results: visibleResults.map((item) => ({
          caseNo: item.index,
          passed: item.passed,
          status: item.status,
          time: item.time,
          actualOutput: item.actualOutput,
          expectedOutput: item.expectedOutput,
          error: item.stderr || item.compileOutput || item.message || ""
        }))
      }
    };
  }

  const allPassed = evaluation.results.every((item) => item.passed);
  const basePoints = ROUND2.difficultyPoints[sub.difficulty];
  const score = allPassed ? basePoints : 0;

  sub.code = code;
  sub.passed = allPassed;
  sub.score = score;
  sub.isSubmitted = true;
  sub.submittedAt = new Date();

  if (team.submissions.round2.subA.isSubmitted && team.submissions.round2.subB.isSubmitted) {
    team.submissions.round2.submittedAt = new Date();
    team.currentRound = Math.max(team.currentRound, 3);
  }

  recomputeTeamRound2Totals(team);
  await team.save();

  return {
    mode,
    subKey,
    passed: allPassed,
    score,
    visible: {
      total: visible.length,
      passed: visibleResults.filter((item) => item.passed).length,
      results: visibleResults.map((item) => ({
        caseNo: item.index,
        passed: item.passed,
        status: item.status,
        time: item.time,
        actualOutput: item.actualOutput,
        expectedOutput: item.expectedOutput,
        error: item.stderr || item.compileOutput || item.message || ""
      }))
    },
    hidden: {
      total: hidden.length,
      passed: hiddenResults.filter((item) => item.passed).length
    },
    round2TotalScore: team.submissions.round2.totalScore
  };
};

export const getRound2ResultPayload = async (team) => {
  ensureRound2State(team);

  if (team.currentRound < 2) {
    throw new AppError("Round 2 not available yet", 403);
  }

  const round2 = team.submissions.round2;
  const subA = round2.subA;
  const subB = round2.subB;

  return {
    round: 2,
    maxScore: ROUND2.maxScore,
    difficultyPoints: ROUND2.difficultyPoints,
    allowedLanguages: ROUND2.allowedLanguages,
    startedAt: round2.startedAt || null,
    submittedAt: round2.submittedAt || null,
    totalScore: round2.totalScore || 0,
    subA: publicSubPayload(subA),
    subB: publicSubPayload(subB),
    activeSub:
      !subA.isSubmitted
        ? "subA"
        : !subB.isSubmitted
          ? "subB"
          : null
  };
};
