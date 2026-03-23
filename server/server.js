import "dotenv/config";
import mongoose from "mongoose";

import app from "./app.js";

const { MONGO_URI, PORT } = process.env;
const port = PORT || 5000;

const startServer = async () => {
  if (!MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down...");
      await mongoose.connection.close();
      server.close(() => process.exit(0));
    });

  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
};

// Global error handlers
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

startServer();