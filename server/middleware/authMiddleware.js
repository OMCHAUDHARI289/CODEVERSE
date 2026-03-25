import Team from "../models/teams.js";
import Admin from "../models/admin.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

// =======================
// 🔐 JWT VERIFICATION
// =======================
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new AppError("No token provided", 401);
  }

  if (!process.env.JWT_SECRET) {
    throw new AppError("JWT secret not configured", 500);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    throw new AppError("Invalid or expired token", 401);
  }
});

// =======================
// 🔐 TEAM PROTECT
// =======================
export const protectTeam = asyncHandler(async (req, res, next) => {
  // First try JWT verification from Authorization header
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    if (!process.env.JWT_SECRET) {
      throw new AppError("JWT secret not configured", 500);
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // If JWT user is a team, fetch and set req.team
      if (decoded.role === "team") {
        const team = await Team.findById(decoded.id);
        if (!team) {
          throw new AppError("Team not found", 404);
        }
        req.team = team;
      }
      return next();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Invalid or expired token", 401);
    }
  }

  // Fallback to teamId from headers/body/query for legacy support
  const teamId =
    req.headers["x-team-id"] ||
    req.body?.teamId ||
    req.query?.teamId;

  if (!teamId) {
    throw new AppError("teamId required in headers (x-team-id), body, or query", 401);
  }

  const team = await Team.findOne({ teamId: String(teamId).trim() });

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  if (!team.isLoggedIn) {
    throw new AppError("Session expired. Please login again.", 401);
  }

  req.team = team;
  next();
});

export const isTeam = asyncHandler(async (req, res, next) => {
  if (!req.team && !req.user) {
    throw new AppError("Team not authenticated", 401);
  }

  next();
});

export const protectAdmin = asyncHandler(async (req, res, next) => {
  // First try JWT verification from Authorization header
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    if (!process.env.JWT_SECRET) {
      throw new AppError("JWT secret not configured", 500);
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // If JWT user is an admin, fetch and set req.admin
      if (decoded.role === "admin") {
        const admin = await Admin.findById(decoded.id);
        if (!admin) {
          throw new AppError("Admin not found", 404);
        }
        req.admin = admin;
      }
      return next();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Invalid or expired token", 401);
    }
  }

  // Fallback to email-based (legacy support)
  const { email } = req.body;

  if (!email) {
    throw new AppError("Admin email required or provide JWT token", 401);
  }

  const admin = await Admin.findOne({ email: email.trim().toLowerCase() });

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  req.admin = admin;
  next();
});