import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true }
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
    baseScore: { type: Number, default: 0 },
    bonusPoints: { type: Number, default: 0 },

    passedCount: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    visiblePassed: { type: Number, default: 0 },
    hiddenPassed: { type: Number, default: 0 },
    hiddenTotal: { type: Number, default: 0 },

    runCount: { type: Number, default: 0 },
    lastRunPassed: { type: Number, default: 0 },
    lastRunTotal: { type: Number, default: 0 },
    lastRunScore: { type: Number, default: 0 },
    lastRunAt: Date,

    verdict: { type: String, default: "" },
    message: { type: String, default: "" },

    timeComplexity: { type: String, default: "" },
    spaceComplexity: { type: String, default: "" },
    complexityExplanation: { type: String, default: "" },

    isStarted: { type: Boolean, default: false },
    isSubmitted: { type: Boolean, default: false },
    startedAt: Date,
    submittedAt: Date
  },
  { _id: false }
);

const round3ResultSchema = new mongoose.Schema(
  {
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 30 },
    score: { type: Number, default: 0 },
    rawScore: { type: Number, default: 0 },
    penaltyPoints: { type: Number, default: 0 },
    usedLifelines: { type: Number, default: 0 },
    verdict: { type: String, default: "" },
    fixedBugIds: { type: [Number], default: [] },
    remainingBugIds: { type: [Number], default: [] },
    recordedAt: Date
  },
  { _id: false }
);

const round3SubmissionSchema = new mongoose.Schema(
  {
    selectedLanguage: { type: String, enum: ["cpp", "java"] },
    language: { type: String, enum: ["cpp", "java"] },
    code: { type: String, default: "" },

    score: { type: Number, default: 0 },
    rawScore: { type: Number, default: 0 },
    penaltyPoints: { type: Number, default: 0 },
    usedLifelines: { type: Number, default: 0 },
    fixedBugs: { type: Number, default: 0 },
    totalBugs: { type: Number, default: 30 },

    warnings: { type: Number, default: 0 },
    runCount: { type: Number, default: 0 },
    hintCount: { type: Number, default: 0 },
    revealedHintBugIds: { type: [Number], default: [] },

    isSuspicious: { type: Boolean, default: false },
    isStarted: { type: Boolean, default: false },
    isSubmitted: { type: Boolean, default: false },

    submitReason: { type: String, default: "" },

    startedAt: Date,
    submittedAt: Date,
    lastRunAt: Date,
    nextHintAvailableAt: Date,
    lastActivityAt: Date,
    timeSpentSeconds: { type: Number, default: 0 },

    testResults: { type: Number, default: 0 },

    lastRun: {
      type: round3ResultSchema,
      default: () => ({})
    },

    finalResult: {
      type: round3ResultSchema,
      default: () => ({})
    }
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
        correctCount: { type: Number, default: 0 },
        timeSpentSeconds: { type: Number, default: 0 }
      },

      round2: {
        subA: { type: round2SubSchema, default: () => ({}) },
        subB: { type: round2SubSchema, default: () => ({}) },

        totalScore: { type: Number, default: 0 },
        startedAt: Date,
        lastActivityAt: Date,
        submittedAt: Date,
        timeSpentSeconds: { type: Number, default: 0 }
      },

      round3: {
        type: round3SubmissionSchema,
        default: () => ({})
      }
    },

    // ✅ simplified lifelines
    lifelines: {
      round2Used: { type: Boolean, default: false },
      round3Used: { type: Boolean, default: false },
      round2UsedCount: { type: Number, default: 0, min: 0 },
      round3UsedCount: { type: Number, default: 0, min: 0 }
    },

    isLoggedIn: {
      type: Boolean,
      default: false
    },

    roundRuntime: {
      round1: {
        questionOrder: [
          { type: mongoose.Schema.Types.ObjectId, ref: "Question" }
        ],
        startedAt: Date,
        warningCount: { type: Number, default: 0 }
      },

      round2: {
        activeSub: {
          type: String,
          enum: ["subA", "subB"],
          default: "subA"
        },
        lastRunAt: Date,
        lastSubmissionAt: Date
      },

      round3: {
        startedAt: Date,
        warningCount: { type: Number, default: 0 },
        lastRunAt: Date,
        lastSubmissionAt: Date
      }
    },

    completedAt: Date
  },
  { timestamps: true }
);

// ⚡ Keep totalScore consistent
teamSchema.pre("save", function (next) {
  this.totalScore =
    (this.scores.round1 || 0) +
    (this.scores.round2 || 0) +
    (this.scores.round3 || 0);
  next();
});

const Team = mongoose.model("Team", teamSchema);

export default Team;
