import express from "express";

import { finalSubmit } from "../controllers/submissionController.js";
import { isTeam, protectTeam } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectTeam, isTeam);
router.post("/final", finalSubmit);

export default router;
