import Question from "../models/questions.js";
import AppError from "../utils/appError.js";
import { executeAgainstTestCases } from "./executorService.js";
import { analyzeCode } from "./aiService.js";

const TOTAL_TEST_CASES = 3;
const SUPPORTED_LANGUAGES = new Set(["cpp", "java"]);

const marksMap = {
  easy: 20,
  medium: 30,
  hard: 50
};

const normalize = (value = "") => String(value).replace(/\r\n/g, "\n").trim();

const tokenizeAndSort = (value = "") =>
  normalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .sort();

const compareOutput = ({ actual, expected, ignoreOrder = false }) => {
  if (!ignoreOrder) {
    return normalize(actual) === normalize(expected);
  }

  const left = tokenizeAndSort(actual);
  const right = tokenizeAndSort(expected);
  if (left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
};

const hasExecutionError = (execution) => {
  const stderr = normalize(execution?.stderr);
  const compileOutput = normalize(execution?.compileOutput);
  const nonZeroCode =
    typeof execution?.code === "number" && Number(execution.code) !== 0;

  return Boolean(stderr || compileOutput || nonZeroCode || execution?.signal);
};

const collectThreeTestCases = (question) => {
  const direct = Array.isArray(question?.testCases) ? question.testCases : [];

  if (direct.length >= TOTAL_TEST_CASES) {
    return direct.slice(0, TOTAL_TEST_CASES);
  }

  const visible = Array.isArray(question?.visibleTestCases)
    ? question.visibleTestCases
    : [];
  const hidden = Array.isArray(question?.hiddenTestCases)
    ? question.hiddenTestCases
    : [];

  const combined = [...visible, ...hidden];
  if (combined.length < TOTAL_TEST_CASES) {
    throw new AppError("Problem must have at least 3 test cases", 400);
  }

  return combined.slice(0, TOTAL_TEST_CASES);
};

const calculateBaseScore = (difficulty, passedTestCases) => {
  const totalMarks = marksMap[difficulty] || 0;
  const perTest = Math.floor(totalMarks / TOTAL_TEST_CASES);
  const remainder = totalMarks - perTest * TOTAL_TEST_CASES;

  let baseScore = passedTestCases * perTest;
  if (passedTestCases === TOTAL_TEST_CASES) {
    baseScore += remainder;
  }

  return baseScore;
};

const getComplexityBonus = (tc = "") => {
  const normalized = String(tc || "").toLowerCase();

  if (normalized.includes("o(1)")) return 30;
  if (normalized.includes("n log n")) return 15; // Check n log n before log n
  if (normalized.includes("log n")) return 25;
  if (normalized.includes("n)")) return 20;
  if (normalized.includes("n^2")) return 5;
  return 0;
};

export const judgeFinalSubmission = async ({ questionId, code, language }) => {
  if (!questionId) {
    throw new AppError("questionId is required", 400);
  }

  if (!String(code || "").trim()) {
    throw new AppError("code is required", 400);
  }

  // FIX #2: Code size limit - prevent abuse/crashes
  const MAX_CODE_SIZE = 50000; // 50KB
  if (code.length > MAX_CODE_SIZE) {
    throw new AppError("Code too large", 400);
  }

  const normalizedLanguage = String(language || "").toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(normalizedLanguage)) {
    throw new AppError("language must be one of: cpp, java", 400);
  }

  const question = await Question.findById(questionId);
  if (!question || Number(question.round) !== 2) {
    throw new AppError("Round 2 problem not found", 404);
  }

  const testCases = collectThreeTestCases(question);

  // FIX #6: Min test case validation
  if (!testCases.length) {
    throw new AppError("No test cases found", 500);
  }

  // FIX #4: Execution failure safe - prevent crash on executor error
  let executionResults;
  try {
    executionResults = await executeAgainstTestCases({
      code,
      language: normalizedLanguage,
      testCases
    });
  } catch (err) {
    throw new AppError(
      `Execution failed: ${err?.message || "Unknown error"}`,
      500
    );
  }

  const detailedResults = executionResults.map((result, index) => {
    const testCase = testCases[index] || {};
    const outputMatched = compareOutput({
      actual: result.output,
      expected: testCase.output,
      ignoreOrder: Boolean(testCase.ignoreOrder)
    });
    const passed = !hasExecutionError(result) && outputMatched;

    return {
      caseNo: result.caseNo,
      passed,
      status: passed ? "passed" : "failed",
      expectedOutput: normalize(testCase.output),
      actualOutput: normalize(result.output),
      error: normalize(result.compileOutput) || normalize(result.stderr),
      time: result.time
    };
  });

  const passedTestCases = detailedResults.filter((item) => item.passed).length;
  const baseScore = calculateBaseScore(question.difficulty, passedTestCases);

  if (passedTestCases < TOTAL_TEST_CASES) {
    return {
      status: "partial",
      passedTestCases,
      totalTestCases: TOTAL_TEST_CASES,
      baseScore,
      finalScore: baseScore
    };
  }

  // FIX #5: AI failure prevention - don't crash if AI unavailable
  let aiComplexity = null;
  try {
    aiComplexity = await analyzeCode(code);
  } catch {
    aiComplexity = null;
  }

  const timeComplexity = aiComplexity?.timeComplexity || "N/A";
  const spaceComplexity = aiComplexity?.spaceComplexity || "N/A";

  // FIX #1: Cap bonus points - prevent AI abuse
  const rawBonus = aiComplexity
    ? getComplexityBonus(aiComplexity.timeComplexity)
    : 0;
  const MAX_BONUS = 30;
  const complexityBonus = Math.min(rawBonus, MAX_BONUS);
  const finalScore = baseScore + complexityBonus;

  // Optional: Calculate average execution time
  const averageTime = detailedResults.reduce((acc, result) => acc + result.time, 0) / TOTAL_TEST_CASES;

  return {
    status: "accepted",
    passedTestCases,
    totalTestCases: TOTAL_TEST_CASES,
    baseScore,
    complexity: {
      time: timeComplexity,
      space: spaceComplexity
    },
    bonus: complexityBonus,
    finalScore,
    averageExecutionTime: Number(averageTime.toFixed(4))
  };
};

export { calculateBaseScore, getComplexityBonus, marksMap };
