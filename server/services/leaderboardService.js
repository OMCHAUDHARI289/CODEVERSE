import Team from "../models/teams.js";

const getRoundCode = (currentRoundValue) => {
  const currentRound = Number(currentRoundValue) || 1;
  if (currentRound <= 1) return "R1";
  if (currentRound === 2) return "R2";
  return "R3";
};

const toLeaderboardRow = (team) => {
  const totalScore = Number(team.totalScore) || 0;
  const currentRound = Number(team.currentRound) || 1;
  const lifelineUsed = Boolean(team?.lifelines?.round2Used || team?.lifelines?.round3Used);

  return {
    teamId: team.teamId,
    teamName: team.teamName,
    score: totalScore,
    round: getRoundCode(currentRound),
    currentRound,
    scores: {
      round1: Number(team?.scores?.round1) || 0,
      round2: Number(team?.scores?.round2) || 0,
      round3: Number(team?.scores?.round3) || 0
    },
    isOnline: Boolean(team.isLoggedIn),
    lifelineUsed,
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
