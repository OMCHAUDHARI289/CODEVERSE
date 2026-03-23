import express from "express";

import { adminLogin, getMe, login, logout } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/team/login", login);
router.post("/admin/login", adminLogin);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

export default router;
