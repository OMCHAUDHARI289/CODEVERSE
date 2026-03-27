import mongoose from "mongoose";

const lifelineRequestSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },

    round: {
      type: String,
      enum: ["round2", "round3"],
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    requestedAt: {
      type: Date,
      default: Date.now
    },

    resolvedAt: {
      type: Date
    },

    note: {
      type: String,
      trim: true
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    }
  },
  { timestamps: true }
);

// 📊 Indexes (performance)
lifelineRequestSchema.index({ team: 1, round: 1, status: 1, requestedAt: -1 });
lifelineRequestSchema.index({ status: 1, requestedAt: -1 });

// 🚫 Prevent multiple pending requests per team across both rounds
lifelineRequestSchema.index(
  { team: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

// ⏱️ Auto-set resolvedAt + enforce reviewedBy
lifelineRequestSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status !== "pending") {
    this.resolvedAt = new Date();

    if (!this.reviewedBy) {
      return next(new Error("reviewedBy is required when resolving request"));
    }
  }
  next();
});

const LifelineRequest = mongoose.model(
  "LifelineRequest",
  lifelineRequestSchema
);

export default LifelineRequest;
