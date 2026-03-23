export const ROUND_CONFIG = {
  round1: {
    id: 1,
    title: "Round 1 - MCQ Arena",
    durationSeconds: 30 * 60,
    maxScore: 150,
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
    maxScore: 100
  },
  round3: {
    id: 3,
    title: "Round 3 - Bug Hunter",
    durationSeconds: 30 * 60,
    maxScore: 250
  }
};
