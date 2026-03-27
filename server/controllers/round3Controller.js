import asyncHandler from "../utils/asyncHandler.js";
import {
  addRound3WarningState,
  getRound3ResultPayload,
  getRound3StatusPayload,
  revealRound3Hint,
  runRound3Challenge,
  startRound3Challenge,
  submitRound3Challenge
} from "../services/round3Service.js";

export const getRound3Status = asyncHandler(async (req, res) => {
  const payload = await getRound3StatusPayload(req.team);
  res.json(payload);
});

export const startRound3 = asyncHandler(async (req, res) => {
  const payload = await startRound3Challenge({
    team: req.team,
    language: req.body?.language
  });

  res.json(payload);
});

export const addRound3Warning = asyncHandler(async (req, res) => {
  const payload = await addRound3WarningState(req.team);
  res.json(payload);
});

export const getRound3Hint = asyncHandler(async (req, res) => {
  const payload = await revealRound3Hint({
    team: req.team,
    code: req.body?.code
  });

  res.json(payload);
});

export const runRound3 = asyncHandler(async (req, res) => {
  const payload = await runRound3Challenge({
    team: req.team,
    code: req.body?.code
  });

  res.json(payload);
});

export const submitRound3 = asyncHandler(async (req, res) => {
  const payload = await submitRound3Challenge({
    team: req.team,
    code: req.body?.code,
    reason: req.body?.reason
  });

  res.json(payload);
});

export const getRound3Result = asyncHandler(async (req, res) => {
  const payload = await getRound3ResultPayload(req.team);
  res.json(payload);
});
