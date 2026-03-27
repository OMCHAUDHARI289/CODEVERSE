export const ROUND_CONFIG = {
  round1: {
    id: 1,
    title: "Round 1 - MCQ Arena",
    durationSeconds: 30 * 60,
    maxScore: 60,
    warningTimeSeconds: 10 * 60,
    lowTimeSeconds: 5 * 60,
    fallbackQuestions: 15,
    maxWarnings: 3,
    routes: {
      terms: "/team/round1/terms",
      arena: "/team/round1/arena",
      result: "/team/round1/result",
      nextRound: "/team/round2"
    }
  },
  round2: {
    id: 2,
    title: "Round 2 - Coding Engine",
    durationSeconds: 45 * 60,
    difficultyPoints: {
      easy: 20,
      medium: 30,
      hard: 50
    },
    allowedLanguages: ["cpp", "java"],
    maxComplexityBonus: 30,
    maxScore: 160,
    routes: {
      terms: "/team/round2/terms",
      arena: "/team/round2/arena",
      result: "/team/round2/result",
      nextRound: "/team/round3/terms"
    }
  },
  round3: {
    id: 3,
    title: "Round 3 - Bug Apocalypse",
    durationSeconds: 60 * 60,
    maxScore: 150,
    routes: {
      terms: "/team/round3/terms",
      language: "/team/round3/language",
      arena: "/team/round3/arena",
      result: "/team/round3/result",
      nextRound: "/team/leaderboard"
    }
  }
};
