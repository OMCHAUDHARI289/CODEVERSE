import Question from "../models/questions.js";
import { ROUND_CONFIG } from "../config/roundConfig.js";
import AppError from "../utils/appError.js";
import { executeCode } from "./executorService.js";
import { analyzeCode } from "./aiService.js";
import { wrapCode } from "../utils/wrapCode.js";

const ROUND2 = ROUND_CONFIG.round2;
const SUB_KEYS = ["subA", "subB"];
const MIN_VISIBLE_TEST_CASES = 3;

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

const safeJsonParse = (value = "") => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
};

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const compareJson = (actual, expected, ignoreOrder) => {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    if (!ignoreOrder) {
      return actual.every((item, index) =>
        compareJson(item, expected[index], false)
      );
    }

    const left = actual.map(stableStringify).sort();
    const right = expected.map(stableStringify).sort();
    return left.every((item, index) => item === right[index]);
  }

  if (
    actual &&
    expected &&
    typeof actual === "object" &&
    typeof expected === "object" &&
    !Array.isArray(actual) &&
    !Array.isArray(expected)
  ) {
    const leftKeys = Object.keys(actual).sort();
    const rightKeys = Object.keys(expected).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    if (!leftKeys.every((key, index) => key === rightKeys[index])) return false;
    return leftKeys.every((key) => compareJson(actual[key], expected[key], false));
  }

  return actual === expected;
};

const tokenizeAndSort = (value = "") =>
  normalizeWhitespace(value)
    .split(/\s+/)
    .filter(Boolean)
    .sort();

const compareOutput = ({ actual, expected, ignoreOrder }) => {
  const parsedActual = safeJsonParse(actual);
  const parsedExpected = safeJsonParse(expected);

  if (parsedActual !== null && parsedExpected !== null) {
    return compareJson(parsedActual, parsedExpected, ignoreOrder);
  }

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
  if (typeof round2.timeSpentSeconds !== "number") {
    round2.timeSpentSeconds = 0;
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
      ? question.testCases.slice(0, MIN_VISIBLE_TEST_CASES)
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
  baseScore: Number(sub.baseScore) || 0,
  bonusPoints: Number(sub.bonusPoints) || 0,
  passedCount: Number(sub.passedCount) || 0,
  totalTests: Number(sub.totalTests) || 0,
  visiblePassed: Number(sub.visiblePassed) || 0,
  hiddenPassed: Number(sub.hiddenPassed) || 0,
  hiddenTotal: Number(sub.hiddenTotal) || 0,
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

const getWrapperTemplate = (question, language) =>
  question?.runnerTemplate?.[language] ||
  question?.runnerTemplate?.default ||
  "";

const hasExecutionError = (execution) => {
  const hasStderr = Boolean(normalizeWhitespace(execution.stderr));
  const hasCompileOutput = Boolean(normalizeWhitespace(execution.compileOutput));
  const nonZeroExit =
    typeof execution.code === "number" && Number(execution.code) !== 0;
  const hasSignal = Boolean(execution.signal);
  return hasStderr || hasCompileOutput || nonZeroExit || hasSignal;
};

const buildExecutionStatus = (execution, passedByOutput) => {
  if (hasExecutionError(execution)) return "Execution Error";
  return passedByOutput ? "Accepted" : "Wrong Answer";
};

const buildCaseError = (execution) => {
  if (normalizeWhitespace(execution.stderr)) return execution.stderr;
  if (normalizeWhitespace(execution.compileOutput)) return execution.compileOutput;
  if (execution.signal) return `Terminated by signal ${execution.signal}`;
  if (typeof execution.code === "number" && Number(execution.code) !== 0) {
    return `Exited with code ${execution.code}`;
  }
  return "";
};

const averageExecutionTime = (results) => {
  const times = results
    .map((item) =>
      Number.isFinite(Number(item.time)) ? Number(item.time) : null
    )
    .filter((value) => value !== null);

  if (!times.length) return null;
  const avg = times.reduce((sum, value) => sum + value, 0) / times.length;
  return Number(avg.toFixed(4));
};

const formatResultOutput = ({ visibleResults, hiddenSummary = null }) => {
  const lines = visibleResults.map(
    (item) =>
      `Case ${item.index}: ${item.passed ? "PASSED" : "FAILED"} (${item.status})`
  );

  if (hiddenSummary && Number.isFinite(Number(hiddenSummary.total))) {
    const hiddenPassed = Number(hiddenSummary.passed) || 0;
    const hiddenTotal = Number(hiddenSummary.total) || 0;
    lines.push(`Hidden tests passed: ${hiddenPassed}/${hiddenTotal}`);
  }

  return lines.join("\n");
};

const didPassVisibleTests = ({ visiblePassedCount, visibleTotal }) =>
  Number(visibleTotal) > 0 &&
  Number(visiblePassedCount) === Number(visibleTotal);

export const calculateRound2Score = ({ difficulty, passedCount }) => {
  const basePoints = Number(ROUND2.difficultyPoints[difficulty]) || 0;
  const awardedChunks = Math.min(3, Math.max(0, Number(passedCount) || 0));

  if (!awardedChunks) return 0;

  return Math.min(basePoints, Math.round((basePoints * awardedChunks) / 3));
};

const getComplexityBonus = (timeComplexity = "") => {
  const normalized = String(timeComplexity || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return 0;
  if (normalized.includes("o(1)")) return 30;
  if (
    /\bo\(\s*n\s*\+\s*m\s*\)/.test(normalized) ||
    /\bo\(\s*m\s*\+\s*n\s*\)/.test(normalized) ||
    /\bo\(\s*v\s*\+\s*e\s*\)/.test(normalized) ||
    /\bo\(\s*e\s*\+\s*v\s*\)/.test(normalized)
  ) {
    return 20;
  }
  if (/n\s*log\s*n/.test(normalized)) return 15;
  if (normalized.includes("log n") || normalized.includes("log(n)")) return 25;
  if (normalized.includes("o(n)") || normalized === "n") return 20;
  if (
    normalized.includes("n^2") ||
    normalized.includes("n2") ||
    normalized.includes("n*n")
  ) {
    return 5;
  }

  return 0;
};

const buildSubmitMessage = ({
  visiblePassedCount,
  visibleTotal,
  hiddenPassedCount,
  hiddenTotal,
  baseScore,
  bonusPoints,
  complexity
}) => {
  if (!visiblePassedCount && !hiddenPassedCount) {
    return "Submission saved. No test cases passed, so no points were awarded.";
  }

  const passSummary = `Visible ${visiblePassedCount}/${visibleTotal}, hidden ${hiddenPassedCount}/${hiddenTotal}.`;

  if (!complexity) {
    return `Submission saved. ${passSummary} Base ${baseScore} points awarded. Bonus analysis is currently unavailable.`;
  }

  if (bonusPoints > 0) {
    return `Submission saved. ${passSummary} Base ${baseScore} + bonus ${bonusPoints} points for ${complexity.timeComplexity}.`;
  }

  return `Submission saved. ${passSummary} Base ${baseScore} points awarded. Complexity detected as ${complexity.timeComplexity}; no bonus points for this tier.`;
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

  const results = [];
  for (let index = 0; index < all.length; index += 1) {
    const testCase = all[index];
    const wrappedCode = wrapCode(sourceCode, testCase.input, {
      wrapperTemplate: getWrapperTemplate(question, language)
    });
    const execution = await executeCode({
      code: wrappedCode,
      language,
      input: testCase.input
    });

    const passedByOutput = compareOutput({
      actual: execution.output,
      expected: testCase.output,
      ignoreOrder: Boolean(testCase.ignoreOrder)
    });

    const runtimeFailed = hasExecutionError(execution);
    const passed = !runtimeFailed && passedByOutput;

    results.push({
      index: index + 1,
      isHidden: index >= visible.length,
      passed,
      status: buildExecutionStatus(execution, passedByOutput),
      time: execution.time,
      actualOutput: normalizeWhitespace(execution.output),
      expectedOutput: normalizeWhitespace(testCase.output),
      stderr: execution.stderr,
      compileOutput: execution.compileOutput,
      error: buildCaseError(execution)
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
    team.submissions.round2.timeSpentSeconds = 0;
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
  const round2StartedAt = team.submissions?.round2?.startedAt;

  // FIX #1: Run limit - prevent brute-force solving
  const MAX_RUNS = 50;
  if (mode === "run") {
    sub.runCount = sub.runCount || 0;
    if (sub.runCount >= MAX_RUNS) {
      throw new AppError("Run limit exceeded", 400);
    }
    sub.runCount += 1;
    sub.lastRunAt = new Date();
  }

  // FIX #2: Time limit check - prevent late submissions
  if (round2StartedAt) {
    const elapsed = (Date.now() - new Date(round2StartedAt).getTime()) / 1000;
    if (elapsed > ROUND2.durationSeconds) {
      throw new AppError("Round 2 time is over", 400);
    }
  }

  if (!sub.isStarted || !sub.problemId) {
    throw new AppError(`${subKey.toUpperCase()} not started`, 400);
  }

  if (sub.isSubmitted) {
    throw new AppError(`${subKey.toUpperCase()} already submitted`, 400);
  }

  if (!code || !code.trim()) {
    throw new AppError("Code is required", 400);
  }

  // FIX #4: Code size limit - prevent abuse/crashes
  const MAX_CODE_SIZE = 50000; // 50KB
  if (code.length > MAX_CODE_SIZE) {
    throw new AppError("Code too large", 400);
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
      averageExecutionTime: averageExecutionTime(visibleResults),
      output: formatResultOutput({ visibleResults }),
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
          error: item.error || item.stderr || item.compileOutput || ""
        }))
      }
    };
  }

  const totalPassed = evaluation.results.filter((item) => item.passed).length;
  const totalTests = evaluation.results.length;
  const visiblePassedCount = visibleResults.filter((item) => item.passed).length;
  const hiddenPassedCount = hiddenResults.filter((item) => item.passed).length;
  const passed = didPassVisibleTests({
    visiblePassedCount,
    visibleTotal: visible.length
  });
  const allPassed = totalTests > 0 && totalPassed === totalTests;
  const resolvedDifficulty = sub.difficulty || question.difficulty;
  const baseScore = calculateRound2Score({
    difficulty: resolvedDifficulty,
    passedCount: visiblePassedCount
  });

  const complexity = totalPassed > 0 ? await analyzeCode(code) : null;
  const rawBonus =
    totalPassed > 0 && complexity?.timeComplexity
      ? getComplexityBonus(complexity.timeComplexity)
      : 0;
  const bonusPoints = Math.min(rawBonus, ROUND2.maxComplexityBonus || 0);
  const score = baseScore + bonusPoints;
  const complexityPayload = {
    timeComplexity: complexity?.timeComplexity || "N/A",
    spaceComplexity: complexity?.spaceComplexity || "N/A",
    explanation:
      complexity?.explanation ||
      (totalPassed > 0
        ? "AI complexity analysis is currently unavailable."
        : "Complexity is evaluated only after at least one test case passes.")
  };
  const message = buildSubmitMessage({
    visiblePassedCount,
    visibleTotal: visible.length,
    hiddenPassedCount,
    hiddenTotal: hidden.length,
    baseScore,
    bonusPoints,
    complexity
  });

  sub.code = code;
  if (!sub.difficulty && resolvedDifficulty) {
    sub.difficulty = resolvedDifficulty;
  }
  sub.passed = passed;
  sub.baseScore = baseScore;
  sub.bonusPoints = bonusPoints;
  sub.passedCount = totalPassed;
  sub.totalTests = totalTests;
  sub.visiblePassed = visiblePassedCount;
  sub.hiddenPassed = hiddenPassedCount;
  sub.hiddenTotal = hidden.length;
  sub.score = score;
  sub.isSubmitted = true;
  sub.submittedAt = new Date();

  // FIX #5: Atomic submit - prevent race conditions and double scoring
  const updated = await team.constructor.findOneAndUpdate(
    {
      _id: team._id,
      [`submissions.round2.${subKey}.isSubmitted`]: { $ne: true }
    },
    {
      $set: {
        [`submissions.round2.${subKey}.code`]: code,
        [`submissions.round2.${subKey}.passed`]: passed,
        [`submissions.round2.${subKey}.baseScore`]: baseScore,
        [`submissions.round2.${subKey}.bonusPoints`]: bonusPoints,
        [`submissions.round2.${subKey}.passedCount`]: totalPassed,
        [`submissions.round2.${subKey}.totalTests`]: totalTests,
        [`submissions.round2.${subKey}.visiblePassed`]: visiblePassedCount,
        [`submissions.round2.${subKey}.hiddenPassed`]: hiddenPassedCount,
        [`submissions.round2.${subKey}.hiddenTotal`]: hidden.length,
        [`submissions.round2.${subKey}.score`]: score,
        [`submissions.round2.${subKey}.isSubmitted`]: true,
        [`submissions.round2.${subKey}.submittedAt`]: new Date(),
        [`submissions.round2.${subKey}.runCount`]: sub.runCount,
        [`submissions.round2.${subKey}.lastRunAt`]: sub.lastRunAt
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError("Already submitted", 400);
  }

  // Check if both subs are now submitted and advance round
  if (updated.submissions.round2.subA.isSubmitted && updated.submissions.round2.subB.isSubmitted) {
    if (!updated.submissions.round2.submittedAt) {
      const completedAt = new Date();
      const startedAtMs = round2StartedAt ? new Date(round2StartedAt).getTime() : NaN;
      const timeSpentSeconds = Number.isFinite(startedAtMs)
        ? Math.max(
            0,
            Math.min(
              ROUND2.durationSeconds,
              Math.floor((completedAt.getTime() - startedAtMs) / 1000)
            )
          )
        : 0;

      updated.submissions.round2.submittedAt = completedAt;
      updated.submissions.round2.timeSpentSeconds = timeSpentSeconds;
      updated.currentRound = Math.max(updated.currentRound, 3);
      await updated.save();
    }
  }

  // Recompute totals using updated doc
  recomputeTeamRound2Totals(updated);
  await updated.save();

  return {
    mode,
    subKey,
    passed,
    score,
    baseScore,
    bonusPoints,
    message,
    complexity: complexityPayload,
    averageExecutionTime: averageExecutionTime(evaluation.results),
    output: formatResultOutput({
      visibleResults,
      hiddenSummary: {
        passed: hiddenResults.filter((item) => item.passed).length,
        total: hidden.length
      }
    }),
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
        error: item.error || item.stderr || item.compileOutput || ""
      }))
    },
    hidden: {
      total: hidden.length,
      passed: hiddenResults.filter((item) => item.passed).length
    },
    round2TotalScore: updated.submissions.round2.totalScore
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
    maxComplexityBonus: ROUND2.maxComplexityBonus || 0,
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
