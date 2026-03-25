import { executeCode } from "../services/executorService.js";
import AppError from "../utils/appError.js";
import asyncHandler from "../utils/asyncHandler.js";

const SUPPORTED_LANGUAGES = new Set(["cpp", "java"]);

const buildErrorMessage = (execution) => {
  if (execution.compileOutput?.trim()) return execution.compileOutput;
  if (execution.stderr?.trim()) return execution.stderr;
  if (execution.signal) return `Terminated by signal ${execution.signal}`;
  if (typeof execution.code === "number" && execution.code !== 0) {
    return `Exited with code ${execution.code}`;
  }
  return "";
};

export const execute = asyncHandler(async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const language =
    typeof req.body?.language === "string"
      ? req.body.language.toLowerCase()
      : "";
  const input = req.body?.input === undefined ? "" : String(req.body.input);

  if (!code.trim()) {
    throw new AppError("Code is required", 400);
  }

  if (!SUPPORTED_LANGUAGES.has(language)) {
    throw new AppError("language must be one of: cpp, java", 400);
  }

  const execution = await executeCode({ code, language, input });
  const error = buildErrorMessage(execution);

  res.json({
    output: execution.output || "",
    error,
    status: error ? "error" : "success"
  });
});
