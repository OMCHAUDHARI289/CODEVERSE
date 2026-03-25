import express from "express";
import {
  approveLifelineRequest,
  getAdminLeaderboard,
  getAdminQuestions,
  getDashboardSummary,
  getLifelineRequests,
  getTeamMonitor,
  rejectLifelineRequest
} from "../controllers/adminController.js";
import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectAdmin);

router.get("/dashboard-summary", getDashboardSummary);
router.get("/team-monitor", getTeamMonitor);
router.get("/leaderboard", getAdminLeaderboard);
router.get("/questions", getAdminQuestions);
router.get("/lifeline-requests", getLifelineRequests);
router.patch("/lifeline-requests/:id/approve", approveLifelineRequest);
router.patch("/lifeline-requests/:id/reject", rejectLifelineRequest);

export default router;
