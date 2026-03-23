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
    resolvedAt: Date,
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

lifelineRequestSchema.index({ team: 1, round: 1, status: 1, requestedAt: -1 });
lifelineRequestSchema.index({ status: 1, requestedAt: -1 });

const LifelineRequest = mongoose.model("LifelineRequest", lifelineRequestSchema);

export default LifelineRequest;
