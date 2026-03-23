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
    // Enable token-based comparison where order does not matter.
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
      required: true
    },
    subRound: {
      type: String
    },

    // Common fields
    title: String,
    description: String,
    constraints: [String],
    inputFormat: String,
    outputFormat: String,

    // Round 1 fields
    codeSnippet: String,
    options: [String],
    correctAnswer: Number,

    // Round 2 fields
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"]
    },
    starterCode: {
      cpp: String,
      java: String
    },
    visibleTestCases: [testCaseSchema],
    hiddenTestCases: [testCaseSchema],
    // Backward-compatible legacy test case field.
    testCases: [testCaseSchema],

    // Round 3 fields
    buggyCode: String,
    language: {
      type: String,
      enum: ["cpp", "java"]
    },
    expectedOutput: String,

    // Scoring
    marks: {
      type: Number,
      default: 10
    }
  },
  { timestamps: true }
);

const Question = mongoose.model("Question", questionSchema);

export default Question;
