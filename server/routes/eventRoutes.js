import express from "express";
import {
  getEventLeaderboard,
  getEventStatus,
  setEventStatus
} from "../controllers/eventController.js";
import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/status", getEventStatus);
router.get("/leaderboard", getEventLeaderboard);
router.put("/status", protectAdmin, setEventStatus);

export default router;
