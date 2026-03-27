import mongoose from "mongoose";

const leaderboardRevealEntrySchema = new mongoose.Schema(
  {
    rank: { type: Number, default: 0 },
    teamId: { type: String, default: "" },
    teamName: { type: String, default: "" },
    score: { type: Number, default: 0 },
    round: { type: String, default: "R1" },
    currentRound: { type: Number, default: 1 },
    scores: {
      round1: { type: Number, default: 0 },
      round2: { type: Number, default: 0 },
      round3: { type: Number, default: 0 }
    },
    isOnline: { type: Boolean, default: false },
    lifelineUsed: { type: Boolean, default: false },
    lifelineUsage: {
      round2: { type: Number, default: 0 },
      round3: { type: Number, default: 0 }
    },
    updatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const leaderboardRevealSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["hidden", "revealing", "completed"],
      default: "hidden"
    },
    intervalSeconds: {
      type: Number,
      default: 10,
      min: 1,
      max: 300
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    totalTeams: {
      type: Number,
      default: 0
    },
    revealedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    snapshot: {
      type: [leaderboardRevealEntrySchema],
      default: []
    }
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema({

  name: {
    type: String,
    default: "Techfest CodeVerse"
  },

  isLive: {
    type: Boolean,
    default: false
  },

  leaderboardReveal: {
    type: leaderboardRevealSchema,
    default: () => ({})
  }

}, { timestamps: true });

const Event = mongoose.model("Event", eventSchema);

export default Event;
