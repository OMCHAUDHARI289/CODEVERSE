import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import lifelineRoutes from "./routes/lifelineRoutes.js";
import executionRoutes from "./routes/executionRoutes.js";
import roundRoutes from "./routes/roundRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

const parseOrigins = (value = "") =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const envOrigins = parseOrigins(process.env.CLIENT_ORIGINS);
const allowedOrigins = envOrigins.length
  ? envOrigins
  : [process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/event", eventRoutes);
app.use("/api/lifeline", lifelineRoutes);
app.use("/api/round", roundRoutes);
app.use("/api/submission", submissionRoutes);
app.use("/", executionRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
