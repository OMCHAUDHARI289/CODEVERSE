import "dotenv/config";
import mongoose from "mongoose";
import { readFile } from "fs/promises";

import Question from "../models/questions.js";

const { MONGO_URI } = process.env;
const MIN_VISIBLE_TEST_CASES = 3;

const loadQuestions = async () => {
  const fileUrl = new URL("./data/questions_round2.json", import.meta.url);
  const raw = await readFile(fileUrl, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("Round2 questions seed must be an array");
  }

  return data;
};

const validateQuestion = (question) => {
  if (question.round !== 2) {
    throw new Error("This seed file only accepts round=2 questions");
  }

  if (!question.title || !question.description) {
    throw new Error("Round2 question requires title and description");
  }

  if (!question.difficulty) {
    throw new Error("Round2 question requires difficulty");
  }

  if (
    !Array.isArray(question.visibleTestCases) ||
    question.visibleTestCases.length < MIN_VISIBLE_TEST_CASES
  ) {
    throw new Error(
      `Round2 question "${question.title}" requires at least ${MIN_VISIBLE_TEST_CASES} visible test cases`
    );
  }
};

const seedQuestions = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required to seed questions");
  }

  await mongoose.connect(MONGO_URI);

  const questions = await loadQuestions();

  for (const question of questions) {
    validateQuestion(question);

    await Question.findOneAndUpdate(
      {
        round: 2,
        title: question.title
      },
      question,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await mongoose.disconnect();
};

seedQuestions()
  .then(() => {
    console.log("Round 2 questions seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
