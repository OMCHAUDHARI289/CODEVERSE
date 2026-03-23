import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({

  name: {
    type: String,
    default: "Techfest CodeVerse"
  },

  isLive: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

const Event = mongoose.model("Event", eventSchema);

export default Event;
