import express from "express";
import {
  completeLeaderboardReveal,
  getEventLeaderboard,
  getEventStatus,
  revealNextLeaderboardTeam,
  resetLeaderboardReveal,
  setEventStatus,
  startLeaderboardReveal
} from "../controllers/eventController.js";
import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/status", getEventStatus);
router.get("/leaderboard", getEventLeaderboard);
router.put("/status", protectAdmin, setEventStatus);
router.put("/leaderboard-reveal/start", protectAdmin, startLeaderboardReveal);
router.put("/leaderboard-reveal/next", protectAdmin, revealNextLeaderboardTeam);
router.put("/leaderboard-reveal/complete", protectAdmin, completeLeaderboardReveal);
router.put("/leaderboard-reveal/reset", protectAdmin, resetLeaderboardReveal);

export default router;
