import express from "express";
import {
  getMyLifelineStatus,
  requestLifeline
} from "../controllers/lifelineController.js";
import { isTeam, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, isTeam);

router.get("/status", getMyLifelineStatus);
router.post("/request", requestLifeline);

export default router;
