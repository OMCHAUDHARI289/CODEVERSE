import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { readFile } from "fs/promises";

import Admin from "../models/admin.js";

const { MONGO_URI } = process.env;

const loadAdmins = async () => {
  const fileUrl = new URL("./data/admin.json", import.meta.url);
  const raw = await readFile(fileUrl, "utf-8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [data];
};

const seedAdmin = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required to seed admins");
  }

  await mongoose.connect(MONGO_URI);

  const admins = await loadAdmins();

  for (const admin of admins) {
    if (!admin?.email || !admin?.password) {
      throw new Error("Admin seed requires email and password");
    }

    const adminData = {
      ...admin,
      password: await bcrypt.hash(admin.password, 10)
    };

    await Admin.findOneAndUpdate(
      { email: adminData.email },
      adminData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await mongoose.disconnect();
};

seedAdmin()
  .then(() => {
    console.log("Admin seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
