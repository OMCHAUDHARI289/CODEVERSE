import express from "express";
import {
  getMyLifelineStatus,
  markRoundStartedForLifeline,
  requestLifeline
} from "../controllers/lifelineController.js";
import { isTeam, protectTeam } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectTeam, isTeam);

router.get("/status", getMyLifelineStatus);
router.post("/round-start", markRoundStartedForLifeline);
router.post("/request", requestLifeline);

export default router;
