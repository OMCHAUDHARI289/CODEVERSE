import asyncHandler from "../utils/asyncHandler.js";
import {
  getRound2ResultPayload,
  runOrSubmitSubRound,
  startSubRound
} from "../services/round2Service.js";

export const startRound2SubA = asyncHandler(async (req, res) => {
  const payload = await startSubRound({
    team: req.team,
    subKey: "subA",
    difficulty: req.body?.difficulty,
    language: req.body?.language
  });

  res.json(payload);
});

export const startRound2SubB = asyncHandler(async (req, res) => {
  const payload = await startSubRound({
    team: req.team,
    subKey: "subB",
    difficulty: req.body?.difficulty,
    language: req.body?.language
  });

  res.json(payload);
});

export const submitRound2SubA = asyncHandler(async (req, res) => {
  const payload = await runOrSubmitSubRound({
    team: req.team,
    subKey: "subA",
    code: req.body?.code,
    mode: req.body?.mode || "submit"
  });

  res.json(payload);
});

export const submitRound2SubB = asyncHandler(async (req, res) => {
  const payload = await runOrSubmitSubRound({
    team: req.team,
    subKey: "subB",
    code: req.body?.code,
    mode: req.body?.mode || "submit"
  });

  res.json(payload);
});

export const getRound2Result = asyncHandler(async (req, res) => {
  const payload = await getRound2ResultPayload(req.team);
  res.json(payload);
});
