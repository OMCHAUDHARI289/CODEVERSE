import Event from "../models/event.js";
import Team from "../models/teams.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/appError.js";
import { getLeaderboardData } from "../services/leaderboardService.js";

const DEFAULT_EVENT_NAME = "Techfest CodeVerse";
const DEFAULT_REVEAL_INTERVAL_SECONDS = 10;
const MAX_REVEAL_INTERVAL_SECONDS = 300;

const buildDefaultRevealState = () => ({
  status: "hidden",
  intervalSeconds: DEFAULT_REVEAL_INTERVAL_SECONDS,
  startedAt: null,
  completedAt: null,
  totalTeams: 0,
  revealedCount: 0,
  snapshot: []
});

const getOrCreateEvent = async () => {
  let event = await Event.findOne();

  if (!event) {
    event = await Event.create({
      name: DEFAULT_EVENT_NAME,
      isLive: false,
      leaderboardReveal: buildDefaultRevealState()
    });
  }

  if (!event.leaderboardReveal) {
    event.leaderboardReveal = buildDefaultRevealState();
    await event.save();
  }

  return event;
};

const sanitizeRevealIntervalSeconds = (value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_REVEAL_INTERVAL_SECONDS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_REVEAL_INTERVAL_SECONDS) {
    throw new AppError(
      `intervalSeconds must be an integer between 1 and ${MAX_REVEAL_INTERVAL_SECONDS}`,
      400
    );
  }

  return parsed;
};

const getRevealTiming = (event) => {
  const reveal = event?.leaderboardReveal || buildDefaultRevealState();
  const snapshot = Array.isArray(reveal.snapshot) ? reveal.snapshot : [];
  const totalTeams = Number(reveal.totalTeams) || snapshot.length;
  const status = reveal.status || "hidden";
  const intervalSeconds =
    Number(reveal.intervalSeconds) > 0
      ? Number(reveal.intervalSeconds)
      : DEFAULT_REVEAL_INTERVAL_SECONDS;
  const revealedCount =
    status === "completed"
      ? totalTeams
      : Math.min(totalTeams, Math.max(0, Number(reveal.revealedCount) || 0));

  const remainingCount = Math.max(0, totalTeams - revealedCount);

  return {
    status,
    intervalSeconds,
    startedAt: reveal.startedAt || null,
    completedAt: reveal.completedAt || null,
    totalTeams,
    revealedCount,
    remainingCount,
    nextRevealAt: null,
    isComplete: totalTeams > 0 && revealedCount >= totalTeams
  };
};

const buildRevealSummary = (event) => {
  const timing = getRevealTiming(event);
  const status =
    timing.status === "revealing" && timing.isComplete ? "completed" : timing.status;

  return {
    ...timing,
    status,
    displayOrder: "last-to-first"
  };
};

const getRevealSnapshot = async () => {
  const payload = await getLeaderboardData({ limit: 500 });
  const snapshot = Array.isArray(payload?.leaderboard) ? payload.leaderboard : [];

  if (snapshot.length === 0) {
    throw new AppError("No leaderboard data available to reveal yet", 400);
  }

  return {
    snapshot,
    totalTeams: Number(payload?.totalTeams) || snapshot.length
  };
};

const buildEventStatusPayload = (event, now = new Date()) => ({
  name: event.name,
  isLive: event.isLive,
  leaderboardReveal: buildRevealSummary(event, now)
});

export const getEventStatus = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();
  const payload = buildEventStatusPayload(event);

  if (!payload.leaderboardReveal.totalTeams) {
    const totalTeams = await Team.countDocuments();
    payload.leaderboardReveal.totalTeams = totalTeams;
    payload.leaderboardReveal.remainingCount = Math.max(
      0,
      totalTeams - payload.leaderboardReveal.revealedCount
    );
  }

  res.json(payload);
});

export const setEventStatus = asyncHandler(async (req, res) => {
  const { isLive } = req.body || {};

  if (typeof isLive !== "boolean") {
    throw new AppError("isLive must be a boolean", 400);
  }

  const event = await getOrCreateEvent();
  event.isLive = isLive;
  await event.save();

  res.json({
    message: isLive ? "Event started successfully" : "Event stopped successfully",
    ...buildEventStatusPayload(event)
  });
});

export const startLeaderboardReveal = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();
  const { snapshot, totalTeams } = await getRevealSnapshot();
  const now = new Date();

  event.leaderboardReveal = {
    status: "revealing",
    intervalSeconds: sanitizeRevealIntervalSeconds(req.body?.intervalSeconds),
    startedAt: now,
    completedAt: null,
    totalTeams,
    revealedCount: 0,
    snapshot
  };
  await event.save();

  res.json({
    message: "Leaderboard reveal started",
    ...buildEventStatusPayload(event, now)
  });
});

export const revealNextLeaderboardTeam = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();
  let snapshot = Array.isArray(event.leaderboardReveal?.snapshot)
    ? event.leaderboardReveal.snapshot
    : [];
  let totalTeams = Number(event.leaderboardReveal?.totalTeams) || snapshot.length;

  if (snapshot.length === 0) {
    const latest = await getRevealSnapshot();
    snapshot = latest.snapshot;
    totalTeams = latest.totalTeams;
  }

  if ((event.leaderboardReveal?.status || "hidden") === "hidden") {
    throw new AppError("Start the leaderboard reveal before revealing teams", 400);
  }
  if ((event.leaderboardReveal?.status || "hidden") === "completed") {
    throw new AppError("Leaderboard reveal is already complete", 400);
  }

  const nextCount = Math.min(totalTeams, (Number(event.leaderboardReveal?.revealedCount) || 0) + 1);
  const isComplete = totalTeams > 0 && nextCount >= totalTeams;
  const now = new Date();

  event.leaderboardReveal = {
    status: isComplete ? "completed" : "revealing",
    intervalSeconds:
      Number(event.leaderboardReveal?.intervalSeconds) || DEFAULT_REVEAL_INTERVAL_SECONDS,
    startedAt: event.leaderboardReveal?.startedAt || now,
    completedAt: isComplete ? now : null,
    totalTeams,
    revealedCount: nextCount,
    snapshot
  };
  await event.save();

  res.json({
    message: isComplete ? "Final team revealed" : "Next team revealed",
    ...buildEventStatusPayload(event, now)
  });
});

export const completeLeaderboardReveal = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();
  let snapshot = Array.isArray(event.leaderboardReveal?.snapshot)
    ? event.leaderboardReveal.snapshot
    : [];
  let totalTeams = Number(event.leaderboardReveal?.totalTeams) || snapshot.length;

  if (snapshot.length === 0) {
    const latest = await getRevealSnapshot();
    snapshot = latest.snapshot;
    totalTeams = latest.totalTeams;
  }

  const now = new Date();
  event.leaderboardReveal = {
    status: "completed",
    intervalSeconds:
      Number(event.leaderboardReveal?.intervalSeconds) || DEFAULT_REVEAL_INTERVAL_SECONDS,
    startedAt: event.leaderboardReveal?.startedAt || now,
    completedAt: now,
    totalTeams,
    revealedCount: totalTeams,
    snapshot
  };
  await event.save();

  res.json({
    message: "Leaderboard reveal completed",
    ...buildEventStatusPayload(event, now)
  });
});

export const resetLeaderboardReveal = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();

  event.leaderboardReveal = buildDefaultRevealState();
  await event.save();

  res.json({
    message: "Leaderboard reveal reset",
    ...buildEventStatusPayload(event)
  });
});

export const getEventLeaderboard = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();
  const revealSummary = buildRevealSummary(event);
  const snapshot = Array.isArray(event.leaderboardReveal?.snapshot)
    ? event.leaderboardReveal.snapshot
    : [];
  const totalTeams = revealSummary.totalTeams || (await Team.countDocuments());
  const effectiveRevealSummary = {
    ...revealSummary,
    totalTeams,
    remainingCount: Math.max(0, totalTeams - revealSummary.revealedCount)
  };

  let leaderboard = [];

  if (effectiveRevealSummary.status === "completed") {
    leaderboard = snapshot;
  } else if (
    effectiveRevealSummary.status === "revealing" &&
    effectiveRevealSummary.revealedCount > 0
  ) {
    leaderboard = snapshot.slice(
      Math.max(0, snapshot.length - effectiveRevealSummary.revealedCount)
    );
  }

  res.json({
    updatedAt: new Date().toISOString(),
    totalTeams,
    leaderboard,
    reveal: effectiveRevealSummary
  });
});
