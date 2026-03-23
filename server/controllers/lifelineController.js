import LifelineRequest from "../models/lifelineRequest.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";

const LIFELINE_PENALTY = 10;

const isValidRound = (round) => ["round2", "round3"].includes(round);

const getRoundUsageFlag = (round) => (round === "round2" ? "round2Used" : "round3Used");

const getRoundScoreKey = (round) => (round === "round2" ? "round2" : "round3");
const getRoundNumber = (round) => (round === "round2" ? 2 : 3);

const normalizeRound = (roundValue) => {
  const nextRound = String(roundValue || "round3").toLowerCase();
  return nextRound;
};

const buildLifelineStatusPayload = async ({ team, round }) => {
  const usageFlag = getRoundUsageFlag(round);
  const latestRequest = await LifelineRequest.findOne({
    team: team._id,
    round
  })
    .sort({ requestedAt: -1 })
    .select("status requestedAt resolvedAt note");

  return {
    round,
    penaltyPoints: LIFELINE_PENALTY,
    used: Boolean(team?.lifelines?.[usageFlag]),
    request: latestRequest
      ? {
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

export const requestLifeline = asyncHandler(async (req, res) => {
  const round = normalizeRound(req.body?.round || req.query?.round);

  if (!isValidRound(round)) {
    throw new AppError("Invalid round. Use round2 or round3.", 400);
  }

  const usageFlag = getRoundUsageFlag(round);
  const requiredRound = getRoundNumber(round);

  if ((Number(req.team?.currentRound) || 1) < requiredRound) {
    throw new AppError("Lifeline is not available for this round yet", 403);
  }

  if (req.team?.lifelines?.[usageFlag]) {
    throw new AppError("Lifeline already used for this round", 400);
  }

  const pendingRequest = await LifelineRequest.findOne({
    team: req.team._id,
    round,
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

export const getLifelinePenalty = () => LIFELINE_PENALTY;

export const applyLifelinePenaltyToTeam = ({ team, round }) => {
  const scoreKey = getRoundScoreKey(round);
  const usageFlag = getRoundUsageFlag(round);

  if (!team.lifelines) {
    team.lifelines = { round2Used: false, round3Used: false };
  }

  if (team.lifelines[usageFlag]) {
    throw new AppError("Lifeline already used for this round", 400);
  }

  if (!team.scores) {
    team.scores = { round1: 0, round2: 0, round3: 0 };
  }

  team.lifelines[usageFlag] = true;

  const prevTotal = Number(team.totalScore) || 0;
  const prevRoundScore = Number(team.scores?.[scoreKey]) || 0;
  const appliedPenalty = Math.min(LIFELINE_PENALTY, prevTotal);
  const appliedRoundPenalty = Math.min(appliedPenalty, prevRoundScore);

  team.totalScore = Math.max(0, prevTotal - appliedPenalty);
  team.scores[scoreKey] = Math.max(0, prevRoundScore - appliedRoundPenalty);

  return {
    appliedPenalty,
    totalScore: team.totalScore,
    roundScore: team.scores[scoreKey]
  };
};
