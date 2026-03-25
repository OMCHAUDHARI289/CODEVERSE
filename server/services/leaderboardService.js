import Team from "../models/teams.js";

const getRoundCode = (currentRoundValue) => {
  const currentRound = Number(currentRoundValue) || 1;
  if (currentRound <= 1) return "R1";
  if (currentRound === 2) return "R2";
  return "R3";
};

const toLeaderboardRow = (team) => {
  const round1Score = Number(team?.scores?.round1) || 0;
  const round2Score = Number(team?.scores?.round2) || 0;
  const round3Score = Number(team?.scores?.round3) || 0;
  const scoreFromRounds = round1Score + round2Score + round3Score;
  const storedTotal = Number(team.totalScore) || 0;
  const totalScore =
    scoreFromRounds > 0 || storedTotal === 0 ? scoreFromRounds : storedTotal;
  const currentRound = Number(team.currentRound) || 1;
  const round2Usage = Number(team?.lifelines?.round2UsedCount) || (team?.lifelines?.round2Used ? 1 : 0);
  const round3Usage = Number(team?.lifelines?.round3UsedCount) || (team?.lifelines?.round3Used ? 1 : 0);
  const lifelineUsed = round2Usage > 0 || round3Usage > 0;

  return {
    teamId: team.teamId,
    teamName: team.teamName,
    score: totalScore,
    round: getRoundCode(currentRound),
    currentRound,
    scores: {
      round1: round1Score,
      round2: round2Score,
      round3: round3Score
    },
    isOnline: Boolean(team.isLoggedIn),
    lifelineUsed,
    lifelineUsage: {
      round2: round2Usage,
      round3: round3Usage
    },
    updatedAt: team.updatedAt || null
  };
};

const sortLeaderboardRows = (rows) => {
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.currentRound !== a.currentRound) return b.currentRound - a.currentRound;
    return String(a.teamId).localeCompare(String(b.teamId));
  });

  return rows.map((item, index) => ({
    rank: index + 1,
    ...item
  }));
};

export const getLeaderboardData = async ({ limit = 100 } = {}) => {
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  const teams = await Team.find({})
    .select("teamId teamName totalScore currentRound scores lifelines isLoggedIn updatedAt")
    .lean();

  const leaderboard = sortLeaderboardRows(teams.map(toLeaderboardRow)).slice(0, safeLimit);

  return {
    updatedAt: new Date().toISOString(),
    totalTeams: teams.length,
    leaderboard
  };
};
