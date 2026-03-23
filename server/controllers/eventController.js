import Event from "../models/event.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/appError.js";
import { getLeaderboardData } from "../services/leaderboardService.js";

const getOrCreateEvent = async () => {
  let event = await Event.findOne();

  if (!event) {
    event = await Event.create({
      name: "Techfest CodeVerse",
      isLive: false
    });
  }

  return event;
};

export const getEventStatus = asyncHandler(async (req, res) => {
  const event = await getOrCreateEvent();

  res.json({
    name: event.name,
    isLive: event.isLive
  });
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
    name: event.name,
    isLive: event.isLive
  });
});

export const getEventLeaderboard = asyncHandler(async (req, res) => {
  const payload = await getLeaderboardData({
    limit: req.query?.limit
  });

  res.json(payload);
});
