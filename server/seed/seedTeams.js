import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { readFile } from "fs/promises";

import Team from "../models/teams.js";

const { MONGO_URI } = process.env;

const loadTeams = async () => {
  const fileUrl = new URL("./data/teams.json", import.meta.url);
  const raw = await readFile(fileUrl, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Teams seed must be an array");
  }
  return data;
};

const seedTeams = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required to seed teams");
  }

  await mongoose.connect(MONGO_URI);

  const defaultPassword = process.env.TEAM_PASSWORD || "Team@123";
  const teams = await loadTeams();

  for (const team of teams) {
    if (!team?.teamId) {
      throw new Error("Each team requires teamId");
    }

    const plainPassword = team.password || defaultPassword;
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const teamData = {
      ...team,
      password: passwordHash
    };

    await Team.findOneAndUpdate(
      { teamId: teamData.teamId },
      teamData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await mongoose.disconnect();
};

seedTeams()
  .then(() => {
    console.log("Team seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
