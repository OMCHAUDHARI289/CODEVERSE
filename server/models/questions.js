import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true
    },
    output: {
      type: String,
      required: true
    },
    ignoreOrder: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    round: {
      type: Number,
      required: true,
      enum: [1, 2, 3]
    },

    subRound: {
      type: String
    },

    // Common
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    constraints: [String],
    inputFormat: String,
    outputFormat: String,

    // 🟡 ROUND 1 (MCQ)
    codeSnippet: String,
    options: [String],
    correctAnswer: Number,

    // 🔵 ROUND 2 (Coding)
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"]
    },
    starterCode: {
      cpp: String,
      java: String
    },
    runnerTemplate: {
      cpp: String,
      java: String,
      default: String
    },
    visibleTestCases: [testCaseSchema],
    hiddenTestCases: [testCaseSchema],
    testCases: [testCaseSchema], // legacy

    // 🔴 ROUND 3 (Debugging)
    buggyCode: String,
    language: {
      type: String,
      enum: ["cpp", "java"]
    },
    expectedOutput: String,

    // 🎯 Scoring
    marks: {
      type: Number,
      default: 10
    }
  },
  { timestamps: true }
);

// 🚨 CONDITIONAL VALIDATION (VERY IMPORTANT)
questionSchema.pre("validate", function (next) {
  // ROUND 1
  if (this.round === 1) {
    if (!this.options || this.options.length < 2) {
      return next(new Error("MCQ must have at least 2 options"));
    }
    if (this.correctAnswer === undefined) {
      return next(new Error("MCQ must have correctAnswer"));
    }
  }

  // ROUND 2
  if (this.round === 2) {
    if (
      (!this.hiddenTestCases || this.hiddenTestCases.length === 0) &&
      (!this.testCases || this.testCases.length === 0)
    ) {
      return next(new Error("Coding question must have test cases"));
    }
  }

  // ROUND 3
  if (this.round === 3) {
    if (!this.buggyCode || !this.expectedOutput) {
      return next(new Error("Debugging question missing required fields"));
    }
  }

  next();
});

const Question = mongoose.model("Question", questionSchema);

export default Question;