import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import Admin from "../models/admin.js";
import Team from "../models/teams.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";

const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new AppError("JWT secret not configured", 500);
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d"
  });
};

const mapTeamPayload = (team) => ({
  _id: team._id,
  teamId: team.teamId,
  teamName: team.teamName,
  currentRound: team.currentRound,
  totalScore: team.totalScore,
  scores: team.scores,
  members: (team.members || []).map(({ name, email, phone, erpId }) => ({
    name,
    email,
    phone,
    erpId
  })),
  submissions: {
    round1: {
      isSubmitted: Boolean(team.submissions?.round1?.isSubmitted),
      score: team.submissions?.round1?.score || 0,
      correctCount: team.submissions?.round1?.correctCount || 0,
      submittedAt: team.submissions?.round1?.submittedAt || null
    },
    round2: {
      totalScore: team.submissions?.round2?.totalScore || 0,
      subA: {
        isStarted: Boolean(team.submissions?.round2?.subA?.isStarted),
        isSubmitted: Boolean(team.submissions?.round2?.subA?.isSubmitted),
        score: team.submissions?.round2?.subA?.score || 0,
        passed: Boolean(team.submissions?.round2?.subA?.passed)
      },
      subB: {
        isStarted: Boolean(team.submissions?.round2?.subB?.isStarted),
        isSubmitted: Boolean(team.submissions?.round2?.subB?.isSubmitted),
        score: team.submissions?.round2?.subB?.score || 0,
        passed: Boolean(team.submissions?.round2?.subB?.passed)
      }
    },
    round3: {
      isStarted: Boolean(team.submissions?.round3?.isStarted),
      isSubmitted: Boolean(team.submissions?.round3?.isSubmitted),
      selectedLanguage: team.submissions?.round3?.selectedLanguage || null,
      score: team.submissions?.round3?.score || 0,
      rawScore:
        team.submissions?.round3?.rawScore ||
        team.submissions?.round3?.score ||
        0,
      penaltyPoints: team.submissions?.round3?.penaltyPoints || 0,
      usedLifelines: team.submissions?.round3?.usedLifelines || 0,
      fixedBugs: team.submissions?.round3?.fixedBugs || 0,
      totalBugs: team.submissions?.round3?.totalBugs || 0,
      warnings: team.submissions?.round3?.warnings || 0,
      runCount: team.submissions?.round3?.runCount || 0,
      isSuspicious: Boolean(team.submissions?.round3?.isSuspicious),
      submitReason: team.submissions?.round3?.submitReason || "",
      startedAt: team.submissions?.round3?.startedAt || null,
      submittedAt: team.submissions?.round3?.submittedAt || null
    }
  }
});

export const login = asyncHandler(async (req, res) => {
  const { teamId, password } = req.body;

  if (!teamId || !password) {
    throw new AppError("All fields required", 400);
  }

  const team = await Team.findOne({ teamId: teamId.trim() }).select("+password");

  if (!team) {
    throw new AppError("Team not found", 404);
  }

  const isMatch = await bcrypt.compare(password, team.password);

  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const alreadyLoggedIn = Boolean(team.isLoggedIn);
  team.isLoggedIn = true;
  await team.save();

  const token = generateToken({ id: team._id, role: "team" });

  res.json({
    token,
    role: "team",
    alreadyLoggedIn,
    team: mapTeamPayload(team)
  });
});

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("All fields required", 400);
  }

  const admin = await Admin.findOne({ email }).select("+password");

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const isMatch = await bcrypt.compare(password, admin.password);

  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = generateToken({ id: admin._id, role: "admin" });

  res.json({
    token,
    role: "admin",
    admin: {
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });
});

export const logout = asyncHandler(async (req, res) => {
  if (!req.user?.id || !req.user?.role) {
    throw new AppError("Not authorized", 401);
  }

  if (req.user.role === "team") {
    const team = await Team.findById(req.user.id);
    if (team) {
      team.isLoggedIn = false;
      await team.save();
    }
  }

  res.json({
    message: "Logged out successfully"
  });
});

export const getMe = asyncHandler(async (req, res) => {
  if (!req.user?.id || !req.user?.role) {
    throw new AppError("Not authorized", 401);
  }

  if (req.user.role === "team") {
    const team = await Team.findById(req.user.id);
    if (!team) {
      throw new AppError("Team not found", 404);
    }

    return res.json({
      role: "team",
      team: mapTeamPayload(team)
    });
  }

  if (req.user.role === "admin") {
    const admin = await Admin.findById(req.user.id).select("-password");
    if (!admin) {
      throw new AppError("Admin not found", 404);
    }

    return res.json({
      role: "admin",
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });
  }

  throw new AppError("Invalid role", 403);
});
