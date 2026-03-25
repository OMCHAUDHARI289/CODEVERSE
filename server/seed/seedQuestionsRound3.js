import "dotenv/config";
import mongoose from "mongoose";

import Question from "../models/questions.js";
import round3Questions from "./data/questions_round3.js";

const { MONGO_URI } = process.env;

const validateQuestion = (question) => {
  if (question.round !== 3) {
    throw new Error("This seed file only accepts round=3 questions");
  }

  if (!question.title || !question.description) {
    throw new Error("Round3 question requires title and description");
  }

  if (!question.language || !question.buggyCode) {
    throw new Error(`Round3 question \"${question.title}\" requires language and buggyCode`);
  }
};

const seedQuestions = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required to seed questions");
  }

  await mongoose.connect(MONGO_URI);

  for (const question of round3Questions) {
    validateQuestion(question);

    await Question.findOneAndUpdate(
      {
        round: 3,
        title: question.title,
        language: question.language
      },
      question,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await mongoose.disconnect();
};

seedQuestions()
  .then(() => {
    console.log("Round 3 questions seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

