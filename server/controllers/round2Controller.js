import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/appError.js";

import {
  getRound2ResultPayload,
  runOrSubmitSubRound,
  startSubRound
} from "../services/round2Service.js";

// 🔐 Ensure team is actively in round 2
const ensureRound2 = (team) => {
  if (team.currentRound !== 2) {
    throw new AppError("Not allowed. Not in Round 2", 403);
  }
};

// 📊 Allow reading round 2 results even after promotion to round 3
const ensureRound2ResultAccess = (team) => {
  if ((Number(team?.currentRound) || 1) < 2) {
    throw new AppError("Round 2 result not available yet", 403);
  }
};

// 🔁 Common executor
const executeSubRound = async ({ req, subKey, mode }) => {
  ensureRound2(req.team);

  return runOrSubmitSubRound({
    team: req.team,
    subKey,
    code: req.body?.code,
    mode
  });
};

// =======================
// 🚀 START SUB ROUNDS
// =======================

export const startRound2SubA = asyncHandler(async (req, res) => {
  ensureRound2(req.team);

  const payload = await startSubRound({
    team: req.team,
    subKey: "subA",
    difficulty: req.body?.difficulty,
    language: req.body?.language
  });

  res.json(payload);
});

export const startRound2SubB = asyncHandler(async (req, res) => {
  ensureRound2(req.team);

  const payload = await startSubRound({
    team: req.team,
    subKey: "subB",
    difficulty: req.body?.difficulty,
    language: req.body?.language
  });

  res.json(payload);
});

// =======================
// ▶️ RUN (NO SCORE)
// =======================

export const runRound2SubA = asyncHandler(async (req, res) => {
  const payload = await executeSubRound({
    req,
    subKey: "subA",
    mode: "run"
  });

  res.json(payload);
});

export const runRound2SubB = asyncHandler(async (req, res) => {
  const payload = await executeSubRound({
    req,
    subKey: "subB",
    mode: "run"
  });

  res.json(payload);
});

// =======================
// ✅ SUBMIT (FINAL)
// =======================

export const submitRound2SubA = asyncHandler(async (req, res) => {
  const payload = await executeSubRound({
    req,
    subKey: "subA",
    mode: "submit" // 🔥 forced, no override
  });

  res.json(payload);
});

export const submitRound2SubB = asyncHandler(async (req, res) => {
  const payload = await executeSubRound({
    req,
    subKey: "subB",
    mode: "submit" // 🔥 forced
  });

  res.json(payload);
});

// =======================
// 📊 RESULT
// =======================

export const getRound2Result = asyncHandler(async (req, res) => {
  ensureRound2ResultAccess(req.team);

  const payload = await getRound2ResultPayload(req.team);

  res.json(payload);
});
