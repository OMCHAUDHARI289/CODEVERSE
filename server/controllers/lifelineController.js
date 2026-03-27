import LifelineRequest from "../models/lifelineRequest.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";

const LIFELINE_PENALTIES = {
  round2: 10,
  round3: 20
};
const LIFELINE_MAX_TOTAL = 1;
const LIFELINE_UNLOCK_DELAY_MS = 15 * 60 * 1000;

const isValidRound = (round) => ["round2", "round3"].includes(round);

const getRoundUsageFlag = (round) => (round === "round2" ? "round2Used" : "round3Used");
const getRoundUsageCountKey = (round) =>
  round === "round2" ? "round2UsedCount" : "round3UsedCount";
const getRoundScoreKey = (round) => (round === "round2" ? "round2" : "round3");
const getRoundNumber = (round) => (round === "round2" ? 2 : 3);
const getRoundPenalty = (round) => LIFELINE_PENALTIES[round] || 0;

const normalizeRound = (roundValue) => {
  const nextRound = String(roundValue || "round3").toLowerCase();
  return nextRound;
};

const getRoundStartedAt = (team, round) => {
  if (round === "round2") {
    return team?.submissions?.round2?.startedAt || null;
  }

  return team?.submissions?.round3?.startedAt || team?.roundRuntime?.round3?.startedAt || null;
};

const ensureLifelineShape = (team) => {
  if (!team.lifelines) {
    team.lifelines = {
      round2Used: false,
      round3Used: false,
      round2UsedCount: 0,
      round3UsedCount: 0
    };
    return;
  }

  if (!Number.isFinite(Number(team.lifelines.round2UsedCount))) {
    team.lifelines.round2UsedCount = team.lifelines.round2Used ? 1 : 0;
  }

  if (!Number.isFinite(Number(team.lifelines.round3UsedCount))) {
    team.lifelines.round3UsedCount = team.lifelines.round3Used ? 1 : 0;
  }
};

const getRoundUsageCount = (team, round) => {
  const usageCountKey = getRoundUsageCountKey(round);
  const usageFlag = getRoundUsageFlag(round);
  const nextCount = Number(team?.lifelines?.[usageCountKey]);

  if (Number.isFinite(nextCount) && nextCount >= 0) {
    return nextCount;
  }

  return team?.lifelines?.[usageFlag] ? 1 : 0;
};

const getTotalUsageCount = (team) =>
  getRoundUsageCount(team, "round2") + getRoundUsageCount(team, "round3");

const getAvailabilityState = (team, round) => {
  const startedAt = getRoundStartedAt(team, round);
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : NaN;

  if (!Number.isFinite(startedAtMs)) {
    return {
      roundStartedAt: null,
      availableAt: null,
      available: false
    };
  }

  const availableAt = new Date(startedAtMs + LIFELINE_UNLOCK_DELAY_MS);

  return {
    roundStartedAt: new Date(startedAtMs),
    availableAt,
    available: Date.now() >= availableAt.getTime()
  };
};

const buildLifelineStatusPayload = async ({ team, round }) => {
  const usageFlag = getRoundUsageFlag(round);
  const usedCount = getTotalUsageCount(team);
  const { available, availableAt, roundStartedAt } = getAvailabilityState(team, round);
  const latestRequest = await LifelineRequest.findOne({
    team: team._id
  })
    .sort({ requestedAt: -1 })
    .select("round status requestedAt resolvedAt note");

  return {
    round,
    penaltyPoints: getRoundPenalty(round),
    used: Boolean(team?.lifelines?.[usageFlag]) || usedCount > 0,
    usedCount,
    remainingCount: Math.max(0, LIFELINE_MAX_TOTAL - usedCount),
    maxRequests: LIFELINE_MAX_TOTAL,
    unlockAfterMinutes: LIFELINE_UNLOCK_DELAY_MS / 60000,
    roundStartedAt,
    availableAt,
    available,
    request: latestRequest
      ? {
          round: latestRequest.round,
          status: latestRequest.status,
          requestedAt: latestRequest.requestedAt,
          resolvedAt: latestRequest.resolvedAt || null,
          note: latestRequest.note || ""
        }
      : null
  };
};

export const getMyLifelineStatus = asyncHandler(async (req, res) => {
  const round = normalizeRound(req.query?.round);

  if (!isValidRound(round)) {
    throw new AppError("Invalid round. Use round2 or round3.", 400);
  }

  const payload = await buildLifelineStatusPayload({
    team: req.team,
    round
  });

  res.json(payload);
});

export const markRoundStartedForLifeline = asyncHandler(async (req, res) => {
  const round = normalizeRound(req.body?.round || req.query?.round);

  if (!isValidRound(round)) {
    throw new AppError("Invalid round. Use round2 or round3.", 400);
  }

  if (round === "round2") {
    res.json({
      message: "Round 2 start is already tracked by the coding service",
      round,
      startedAt: getRoundStartedAt(req.team, round)
    });
    return;
  }

  const startedAt = getRoundStartedAt(req.team, round) || new Date();

  if (!req.team.submissions?.round3?.startedAt) {
    req.team.submissions.round3.startedAt = startedAt;
  }
  if (!req.team.roundRuntime?.round3?.startedAt) {
    req.team.roundRuntime.round3.startedAt = startedAt;
  }
  if (!req.team.submissions?.round3?.isStarted) {
    req.team.submissions.round3.isStarted = true;
  }

  await req.team.save();

  res.json({
    message: "Round start tracked",
    round,
    startedAt
  });
});

export const requestLifeline = asyncHandler(async (req, res) => {
  const round = normalizeRound(req.body?.round || req.query?.round);

  if (!isValidRound(round)) {
    throw new AppError("Invalid round. Use round2 or round3.", 400);
  }

  const requiredRound = getRoundNumber(round);
  const usedCount = getTotalUsageCount(req.team);
  const { available, availableAt } = getAvailabilityState(req.team, round);

  if ((Number(req.team?.currentRound) || 1) < requiredRound) {
    throw new AppError("Lifeline is not available for this round yet", 403);
  }

  if (!available) {
    const unlockText = availableAt
      ? availableAt.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit"
        })
      : "15 minutes after the round starts";

    throw new AppError(`Lifeline becomes available at ${unlockText}`, 400);
  }

  if (usedCount >= LIFELINE_MAX_TOTAL) {
    throw new AppError("Lifeline already used", 400);
  }

  const pendingRequest = await LifelineRequest.findOne({
    team: req.team._id,
    status: "pending"
  });

  if (pendingRequest) {
    return res.json({
      message: "Lifeline request already pending approval",
      request: {
        _id: pendingRequest._id,
        round: pendingRequest.round,
        status: pendingRequest.status,
        requestedAt: pendingRequest.requestedAt
      }
    });
  }

  const request = await LifelineRequest.create({
    team: req.team._id,
    round,
    status: "pending",
    requestedAt: new Date(),
    note: ""
  });

  res.status(201).json({
    message: "Lifeline request sent to admin",
    request: {
      _id: request._id,
      round: request.round,
      status: request.status,
      requestedAt: request.requestedAt
    }
  });
});

export const getLifelinePenalty = (round) =>
  round ? getRoundPenalty(round) : { ...LIFELINE_PENALTIES };

export const getLifelinePenaltyConfig = () => ({
  perRound: { ...LIFELINE_PENALTIES },
  maxRequests: LIFELINE_MAX_TOTAL,
  unlockAfterMinutes: LIFELINE_UNLOCK_DELAY_MS / 60000
});

export const applyLifelinePenaltyToTeam = ({ team, round }) => {
  const scoreKey = getRoundScoreKey(round);
  const usageFlag = getRoundUsageFlag(round);
  const usageCountKey = getRoundUsageCountKey(round);
  const penaltyPoints = getRoundPenalty(round);

  ensureLifelineShape(team);

  if (getTotalUsageCount(team) >= LIFELINE_MAX_TOTAL) {
    throw new AppError("Lifeline already used", 400);
  }

  if (!team.scores) {
    team.scores = { round1: 0, round2: 0, round3: 0 };
  }

  team.lifelines[usageFlag] = true;
  team.lifelines[usageCountKey] = getRoundUsageCount(team, round) + 1;

  const prevTotal = Number(team.totalScore) || 0;
  const prevRoundScore = Number(team.scores?.[scoreKey]) || 0;
  const appliedPenalty = Math.min(penaltyPoints, prevTotal);
  const appliedRoundPenalty = Math.min(appliedPenalty, prevRoundScore);

  team.totalScore = Math.max(0, prevTotal - appliedPenalty);
  team.scores[scoreKey] = Math.max(0, prevRoundScore - appliedRoundPenalty);

  return {
    appliedPenalty,
    usedCount: team.lifelines[usageCountKey],
    totalScore: team.totalScore,
    roundScore: team.scores[scoreKey]
  };
};
