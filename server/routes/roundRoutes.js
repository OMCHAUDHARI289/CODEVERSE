import express from "express";

import {
  addRound1Warning,
  getRound1Questions,
  getRound1Status,
  startRound1,
  submitRound1
} from "../controllers/round1Controller.js";
import {
  getRound2Result,
  startRound2SubA,
  startRound2SubB,
  submitRound2SubA,
  submitRound2SubB
} from "../controllers/round2Controller.js";
import { isTeam, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, isTeam);

router.get("/round1/status", getRound1Status);
router.post("/round1/start", startRound1);
router.post("/round1/warn", addRound1Warning);
router.get("/round1/questions", getRound1Questions);
router.post("/round1/submit", submitRound1);

router.post("/round2/start-subA", startRound2SubA);
router.post("/round2/submit-subA", submitRound2SubA);
router.post("/round2/start-subB", startRound2SubB);
router.post("/round2/submit-subB", submitRound2SubB);
router.get("/round2/result", getRound2Result);

export default router;
