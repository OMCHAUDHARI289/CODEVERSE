import express from "express";

import {
  adminLogin,
  getMe,
  login,
  logout
} from "../controllers/authController.js";

import { protectTeam } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔐 Auth
router.post("/team/login", login);
router.post("/admin/login", adminLogin);

// 🔓 Session-based protected routes
router.post("/logout", protectTeam, logout);
router.get("/me", protectTeam, getMe);

export default router;