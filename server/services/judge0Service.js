import { ROUND_CONFIG } from "../config/roundConfig.js";
import AppError from "../utils/appError.js";

const { judge0: JUDGE0 } = ROUND_CONFIG.round2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBaseUrl = (url) => url.replace(/\/+$/, "");

const buildHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  if (JUDGE0.apiKey) {
    headers["X-Auth-Token"] = JUDGE0.apiKey;
  }
  return headers;
};

const requestJudge0 = async (path, options = {}) => {
  const url = `${normalizeBaseUrl(JUDGE0.baseUrl)}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    throw new AppError(
      `Judge0 request failed (${response.status})${detail ? `: ${detail}` : ""}`,
      502
    );
  }

  return response.json();
};

const isTerminalStatus = (statusId) => typeof statusId === "number" && statusId > 2;

export const executeWithJudge0 = async ({
  sourceCode,
  languageId,
  stdin,
  cpuTimeLimit,
  wallTimeLimit
}) => {
  if (!sourceCode?.trim()) {
    throw new AppError("Source code is required", 400);
  }

  if (!languageId) {
    throw new AppError("Invalid language id", 400);
  }

  const createPayload = {
    source_code: sourceCode,
    language_id: languageId,
    stdin: stdin || "",
    cpu_time_limit: cpuTimeLimit,
    wall_time_limit: wallTimeLimit
  };

  const createResponse = await requestJudge0("/submissions?base64_encoded=false&wait=false", {
    method: "POST",
    body: JSON.stringify(createPayload)
  });

  const token = createResponse?.token;
  if (!token) {
    throw new AppError("Judge0 did not return submission token", 502);
  }

  for (let attempt = 0; attempt < JUDGE0.maxPollAttempts; attempt++) {
    const result = await requestJudge0(
      `/submissions/${token}?base64_encoded=false&fields=status_id,status,stdout,stderr,compile_output,message,time,memory`
    );

    const statusId = result?.status?.id ?? result?.status_id;

    if (isTerminalStatus(statusId)) {
      return {
        statusId,
        status: result?.status?.description || "Unknown",
        stdout: result?.stdout || "",
        stderr: result?.stderr || "",
        compileOutput: result?.compile_output || "",
        message: result?.message || "",
        time: result?.time ? Number(result.time) : null,
        memory: result?.memory ? Number(result.memory) : null
      };
    }

    await sleep(JUDGE0.pollIntervalMs);
  }

  throw new AppError("Judge0 execution timed out", 504);
};
