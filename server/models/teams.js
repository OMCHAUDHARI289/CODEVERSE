import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String }
  },
  { _id: false }
);

const round2SubSchema = new mongoose.Schema(
  {
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    difficulty: { type: String, enum: ["easy", "medium", "hard"] },
    language: { type: String, enum: ["cpp", "java"] },
    code: { type: String, default: "" },
    passed: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    isStarted: { type: Boolean, default: false },
    isSubmitted: { type: Boolean, default: false },
    startedAt: Date,
    submittedAt: Date
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true
    },
    teamId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    members: {
      type: [memberSchema],
      validate: [(arr) => arr.length <= 3, "Max 3 members allowed"]
    },
    currentRound: {
      type: Number,
      default: 1
    },
    scores: {
      round1: { type: Number, default: 0 },
      round2: { type: Number, default: 0 },
      round3: { type: Number, default: 0 }
    },
    totalScore: {
      type: Number,
      default: 0
    },
    submissions: {
      round1: {
        answers: [Number],
        isSubmitted: { type: Boolean, default: false },
        submittedAt: Date,
        score: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 }
      },
      round2: {
        subA: {
          type: round2SubSchema,
          default: () => ({})
        },
        subB: {
          type: round2SubSchema,
          default: () => ({})
        },
        totalScore: {
          type: Number,
          default: 0
        },
        startedAt: Date,
        submittedAt: Date
      },
      round3: {
        code: String,
        language: String,
        score: { type: Number, default: 0 },
        isSubmitted: { type: Boolean, default: false },
        submittedAt: Date,
        testResults: Number
      }
    },
    lifelines: {
      round2Used: { type: Boolean, default: false },
      round3Used: { type: Boolean, default: false }
    },
    isLoggedIn: {
      type: Boolean,
      default: false
    },
    roundRuntime: {
      round1: {
        questionOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
        startedAt: Date,
        warningCount: { type: Number, default: 0 }
      }
    },
    completedAt: Date
  },
  { timestamps: true }
);

const Team = mongoose.model("Team", teamSchema);

export default Team;
