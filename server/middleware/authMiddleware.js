import jwt from "jsonwebtoken";
import Team from "../models/teams.js";
import Admin from "../models/admin.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
};

export const protect = asyncHandler(async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    throw new AppError("Not authorized, no token", 401);
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError("Token expired or invalid", 401);
  }

  if (!decoded?.id || !decoded?.role) {
    throw new AppError("Invalid token payload", 401);
  }

  req.user = {
    id: decoded.id,
    role: decoded.role
  };

  next();
});

export const isTeam = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "team") {
    throw new AppError("Team access only", 403);
  }

  const team = await Team.findById(req.user.id).select("-password");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  req.team = team;

  next();
});

export const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "admin") {
    throw new AppError("Admin access only", 403);
  }

  const admin = await Admin.findById(req.user.id).select("-password");

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  req.admin = admin;

  next();
});