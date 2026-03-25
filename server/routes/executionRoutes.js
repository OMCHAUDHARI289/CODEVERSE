import express from "express";

import { execute } from "../controllers/executionController.js";

const router = express.Router();

router.post("/execute", execute);

export default router;
