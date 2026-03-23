import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import lifelineRoutes from "./routes/lifelineRoutes.js";
import roundRoutes from "./routes/roundRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({
  origin: [allowedOrigin],
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

app.use(notFound);
app.use(errorHandler);

export default app;
