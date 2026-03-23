const ROUND2_DIFFICULTY_POINTS = {
  easy: 20,
  medium: 30,
  hard: 50
};

const ROUND2_ALLOWED_LANGUAGES = ["cpp", "java"];

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export const ROUND_CONFIG = {
  round1: {
    id: 1,
    title: "MCQ Arena",
    durationSeconds: 30 * 60,
    maxScore: 150,
    maxWarnings: 3
  },
  round2: {
    id: 2,
    title: "Coding Engine",
    durationSeconds: 45 * 60,
    difficultyPoints: ROUND2_DIFFICULTY_POINTS,
    allowedLanguages: ROUND2_ALLOWED_LANGUAGES,
    maxScore: Math.max(...Object.values(ROUND2_DIFFICULTY_POINTS)) * 2,
    judge0: {
      baseUrl: process.env.JUDGE0_BASE_URL || "http://localhost:2358",
      apiKey: process.env.JUDGE0_API_KEY || "",
      languageIds: {
        cpp: toPositiveInt(process.env.JUDGE0_CPP_LANGUAGE_ID, 54),
        java: toPositiveInt(process.env.JUDGE0_JAVA_LANGUAGE_ID, 62)
      },
      pollIntervalMs: toPositiveInt(process.env.JUDGE0_POLL_INTERVAL_MS, 800),
      maxPollAttempts: toPositiveInt(process.env.JUDGE0_MAX_POLL_ATTEMPTS, 30)
    }
  },
  round3: {
    id: 3,
    title: "Bug Hunter",
    durationSeconds: 30 * 60,
    maxScore: 250
  }
};
