import asyncHandler from "../utils/asyncHandler.js";
import { judgeFinalSubmission } from "../services/judgeService.js";

export const finalSubmit = asyncHandler(async (req, res) => {
  const questionId =
    typeof req.body?.questionId === "string" ? req.body.questionId.trim() : "";
  const language =
    typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";

  const result = await judgeFinalSubmission({
    questionId,
    code,
    language
  });

  res.json(result);
});
