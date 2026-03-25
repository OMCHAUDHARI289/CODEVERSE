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
  runRound2SubA,
  runRound2SubB,
  startRound2SubA,
  startRound2SubB,
  submitRound2SubA,
  submitRound2SubB
} from "../controllers/round2Controller.js";
import {
  addRound3Warning,
  getRound3Result,
  getRound3Status,
  runRound3,
  startRound3,
  submitRound3
} from "../controllers/round3Controller.js";
import { isTeam, protectTeam } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectTeam, isTeam);

router.get("/round1/status", getRound1Status);
router.post("/round1/start", startRound1);
router.post("/round1/warn", addRound1Warning);
router.get("/round1/questions", getRound1Questions);
router.post("/round1/submit", submitRound1);

router.post("/round2/start-subA", startRound2SubA);
router.post("/round2/run-subA", runRound2SubA);
router.post("/round2/submit-subA", submitRound2SubA);
router.post("/round2/start-subB", startRound2SubB);
router.post("/round2/run-subB", runRound2SubB);
router.post("/round2/submit-subB", submitRound2SubB);
router.get("/round2/result", getRound2Result);

router.get("/round3/status", getRound3Status);
router.post("/round3/start", startRound3);
router.post("/round3/warn", addRound3Warning);
router.post("/round3/run", runRound3);
router.post("/round3/submit", submitRound3);
router.get("/round3/result", getRound3Result);

export default router;
