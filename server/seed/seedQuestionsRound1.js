import "dotenv/config";
import mongoose from "mongoose";
import { readFile } from "fs/promises";

import Question from "../models/questions.js";

const { MONGO_URI } = process.env;

const loadQuestions = async () => {
  const fileUrl = new URL("./data/questions_round1.json", import.meta.url);
  const raw = await readFile(fileUrl, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Questions seed must be an array");
  }
  return data;
};

const seedQuestions = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required to seed questions");
  }

  await mongoose.connect(MONGO_URI);

  const questions = await loadQuestions();

  for (const q of questions) {
    if (q.round !== 1) {
      throw new Error("This seed file is only for Round 1 questions");
    }

    if (!Array.isArray(q.options) || typeof q.correctAnswer !== "number") {
      throw new Error("Each question must include options[] and correctAnswer");
    }

    const filter = {
      round: 1,
      title: q.title,
      codeSnippet: q.codeSnippet || null
    };

    await Question.findOneAndUpdate(
      filter,
      q,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await mongoose.disconnect();
};

seedQuestions()
  .then(() => {
    console.log("Round 1 questions seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
