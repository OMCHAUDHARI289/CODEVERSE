const ROUND2_DIFFICULTY_POINTS = {
  easy: 20,
  medium: 30,
  hard: 50
};

const ROUND2_MAX_COMPLEXITY_BONUS = 30;

const ROUND2_ALLOWED_LANGUAGES = Object.freeze(["cpp", "java"]);

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback;
};

const maxDifficulty = Math.max(
  ...Object.values(ROUND2_DIFFICULTY_POINTS || { easy: 0 })
);

export const ROUND_CONFIG = Object.freeze({
  round1: {
    id: 1,
    title: "MCQ Arena",
    durationSeconds: 15 * 60,
    maxScore: 60,
    maxWarnings: 3
  },

  round2: {
    id: 2,
    title: "Coding Engine",
    durationSeconds: 45 * 60,

    // 🎯 Scoring system
    difficultyPoints: ROUND2_DIFFICULTY_POINTS,
    maxComplexityBonus: ROUND2_MAX_COMPLEXITY_BONUS,
    maxScore: (maxDifficulty + ROUND2_MAX_COMPLEXITY_BONUS) * 2,

    allowedLanguages: ROUND2_ALLOWED_LANGUAGES,

    // ⚙️ Local execution config
    localExecution: {
      timeoutMs: toPositiveInt(
        process.env.LOCAL_EXECUTION_TIMEOUT_MS,
        2000
      ),
      compileTimeoutMs: toPositiveInt(
        process.env.LOCAL_COMPILE_TIMEOUT_MS,
        10000
      ),
      cppCompiler: process.env.CPP_COMPILER || "g++",
      javacCommand: process.env.JAVAC_COMMAND || "javac",
      javaCommand: process.env.JAVA_COMMAND || "java"
    }
  },

  round3: {
    id: 3,
    title: "Bug Hunter",
    durationSeconds: 60 * 60,
    maxScore: 150,
    totalBugs: 30,
    pointsPerBug: 5,
    maxWarnings: 3,
    allowedLanguages: Object.freeze(["cpp", "java"])
  }
});
