import { exec } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { ROUND_CONFIG } from "../config/roundConfig.js";
import AppError from "../utils/appError.js";

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_COMPILE_TIMEOUT_MS = 10000;
const MAX_BUFFER_SIZE = 1024 * 1024;
const LOCAL_EXECUTION_CONFIG = ROUND_CONFIG?.round2?.localExecution || {};
const EXECUTION_TIMEOUT_MS =
  Number(ROUND_CONFIG?.round2?.localExecution?.timeoutMs) || DEFAULT_TIMEOUT_MS;
const COMPILE_TIMEOUT_MS =
  Number(LOCAL_EXECUTION_CONFIG.compileTimeoutMs) || DEFAULT_COMPILE_TIMEOUT_MS;
const CPP_COMPILER = String(LOCAL_EXECUTION_CONFIG.cppCompiler || "g++");
const JAVAC_COMMAND = String(LOCAL_EXECUTION_CONFIG.javacCommand || "javac");
const JAVA_COMMAND = String(LOCAL_EXECUTION_CONFIG.javaCommand || "java");

const quoteExecutable = (value) => {
  const executable = String(value || "").trim();
  if (!executable) return "";
  if (executable.includes(" ")) {
    return `"${executable.replace(/"/g, '\\"')}"`;
  }
  return executable;
};

const LANGUAGE_CONFIG = {
  cpp: {
    sourceFile: "main.cpp",
    compileCommand: `${quoteExecutable(CPP_COMPILER)} main.cpp -o main`,
    runCommand: process.platform === "win32" ? "main.exe" : "./main"
  },
  java: {
    sourceFile: "Main.java",
    compileCommand: `${quoteExecutable(JAVAC_COMMAND)} Main.java`,
    runCommand: `${quoteExecutable(JAVA_COMMAND)} Main`
  }
};

const toText = (value) => (value === undefined || value === null ? "" : String(value));

const toSeconds = (startTimeNs) => {
  const elapsedNs = Number(process.hrtime.bigint() - startTimeNs);
  return Number((elapsedNs / 1e9).toFixed(4));
};

const isTimeoutError = (error) =>
  Boolean(error?.killed) && error?.code === null && Boolean(error?.signal);

const normalizeExitCode = (error) =>
  typeof error?.code === "number" ? Number(error.code) : 1;

const isMissingCommandError = ({ error, stderr = "", command = "" }) => {
  const lowerStderr = toText(stderr).toLowerCase();
  const lowerMessage = toText(error?.message).toLowerCase();

  if (error?.code === "ENOENT") return true;

  return (
    lowerStderr.includes("is not recognized as an internal or external command") ||
    lowerStderr.includes("command not found") ||
    lowerMessage.includes("enoent")
  );
};

const isPermissionDeniedError = ({ error, stderr = "" }) => {
  const lowerStderr = toText(stderr).toLowerCase();
  const lowerMessage = toText(error?.message).toLowerCase();
  const code = toText(error?.code).toUpperCase();

  return (
    code === "EACCES" ||
    code === "EPERM" ||
    lowerStderr.includes("permission denied") ||
    lowerStderr.includes("access is denied") ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("access is denied")
  );
};

const buildMissingCommandMessage = (language) => {
  if (language === "cpp") {
    return (
      "C++ compiler not found. Install g++ and add it to PATH, " +
      "or set CPP_COMPILER to the full executable path (example: C:\\msys64\\ucrt64\\bin\\g++.exe)."
    );
  }

  if (language === "java") {
    return (
      "Java compiler/runtime not found. Install JDK and add javac/java to PATH, " +
      "or set JAVAC_COMMAND and JAVA_COMMAND to full executable paths."
    );
  }

  return "Required compiler command not found.";
};

const buildPermissionDeniedMessage = (language) => {
  if (language === "cpp") {
    return (
      "Code execution blocked by system permissions while running C++ tools. " +
      "Allow compiler/process execution for this service and try again."
    );
  }

  if (language === "java") {
    return (
      "Code execution blocked by system permissions while running Java tools. " +
      "Allow compiler/process execution for this service and try again."
    );
  }

  return "Code execution blocked by system permissions.";
};

const runCommand = ({ command, cwd, input = "", timeoutMs = EXECUTION_TIMEOUT_MS }) =>
  new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    let child;
    try {
      child = exec(
        command,
        {
          cwd,
          timeout: timeoutMs,
          maxBuffer: MAX_BUFFER_SIZE,
          windowsHide: true
        },
        (error, stdout, stderr) => {
          resolve({
            error,
            stdout: toText(stdout),
            stderr: toText(stderr),
            time: toSeconds(startedAt)
          });
        }
      );
    } catch (error) {
      resolve({
        error,
        stdout: "",
        stderr: toText(error?.message),
        time: toSeconds(startedAt)
      });
      return;
    }

    if (child.stdin) {
      child.stdin.on("error", () => {});
      child.stdin.end(toText(input));
    }
  });

const throwIfInfrastructureError = ({ language, command, result }) => {
  const missingCommand = isMissingCommandError({
    error: result?.error,
    stderr: result?.stderr,
    command
  });

  if (missingCommand) {
    throw new AppError(buildMissingCommandMessage(language), 503);
  }

  const permissionDenied = isPermissionDeniedError({
    error: result?.error,
    stderr: result?.stderr
  });

  if (permissionDenied) {
    throw new AppError(buildPermissionDeniedMessage(language), 503);
  }
};

const buildCompileFailure = ({ compileResult }) => {
  const timedOut = isTimeoutError(compileResult.error);

  return {
    output: "",
    stderr: "",
    code: normalizeExitCode(compileResult.error),
    time: 0,
    status: timedOut ? "Compilation Time Limit Exceeded" : "Compilation Error",
    compileOutput: timedOut
      ? `Compilation timed out after ${COMPILE_TIMEOUT_MS} ms`
      : toText(compileResult.stderr || compileResult.error.message),
    signal: compileResult.error.signal || null
  };
};

const runPreparedProgram = async ({ language, cwd, input, timeoutMs }) => {
  const runResult = await runCommand({
    command: LANGUAGE_CONFIG[language].runCommand,
    cwd,
    input,
    timeoutMs
  });

  if (runResult.error) {
    throwIfInfrastructureError({
      language,
      command: LANGUAGE_CONFIG[language].runCommand,
      result: runResult
    });

    const timedOut = isTimeoutError(runResult.error);

    return {
      output: toText(runResult.stdout).trim(),
      stderr: timedOut
        ? `Execution timed out after ${timeoutMs} ms`
        : toText(runResult.stderr || runResult.error.message),
      code: normalizeExitCode(runResult.error),
      time: runResult.time,
      status: timedOut ? "Time Limit Exceeded" : "Runtime Error",
      compileOutput: "",
      signal: runResult.error.signal || null
    };
  }

  return {
    output: toText(runResult.stdout).trim(),
    stderr: toText(runResult.stderr),
    code: 0,
    time: runResult.time,
    status: "Accepted",
    compileOutput: "",
    signal: null
  };
};

const prepareExecutable = async ({ code, language }) => {
  const languageConfig = LANGUAGE_CONFIG[language];
  if (!languageConfig) {
    throw new AppError("Unsupported language", 400);
  }

  if (!toText(code).trim()) {
    throw new AppError("Code is required", 400);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeverse-exec-"));
  const sourcePath = path.join(tempDir, languageConfig.sourceFile);
  await fs.writeFile(sourcePath, toText(code), "utf8");

  const compileResult = await runCommand({
    command: languageConfig.compileCommand,
    cwd: tempDir,
    timeoutMs: COMPILE_TIMEOUT_MS
  });

  if (compileResult.error) {
    throwIfInfrastructureError({
      language,
      command: LANGUAGE_CONFIG[language]?.compileCommand,
      result: compileResult
    });

    return {
      tempDir,
      language,
      compileFailure: buildCompileFailure({ compileResult })
    };
  }

  return {
    tempDir,
    language,
    compileFailure: null
  };
};

const cleanupTempDir = async (tempDir) => {
  if (!tempDir) return;
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
};

export const executeCode = async ({ code, language, input = "" }) => {
  const languageConfig = LANGUAGE_CONFIG[language];
  if (!languageConfig) {
    throw new AppError("Unsupported language", 400);
  }

  if (!toText(code).trim()) {
    throw new AppError("Code is required", 400);
  }

  let tempDir = "";
  try {
    const prepared = await prepareExecutable({ code, language });
    tempDir = prepared.tempDir;

    if (prepared.compileFailure) {
      return prepared.compileFailure;
    }

    return await runPreparedProgram({
      language,
      cwd: tempDir,
      input,
      timeoutMs: EXECUTION_TIMEOUT_MS
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Local execution failed: ${error?.message || "Unknown error"}`,
      500
    );
  } finally {
    await cleanupTempDir(tempDir);
  }
};

export const executeAgainstTestCases = async ({
  code,
  language,
  testCases,
  timeoutMs = EXECUTION_TIMEOUT_MS
}) => {
  if (!Array.isArray(testCases) || !testCases.length) {
    throw new AppError("testCases must be a non-empty array", 400);
  }

  let tempDir = "";
  try {
    const prepared = await prepareExecutable({ code, language });
    tempDir = prepared.tempDir;

    if (prepared.compileFailure) {
      return testCases.map((testCase, index) => ({
        caseNo: index + 1,
        input: toText(testCase?.input),
        expectedOutput: toText(testCase?.output),
        ...prepared.compileFailure
      }));
    }

    const results = [];
    for (let index = 0; index < testCases.length; index += 1) {
      const testCase = testCases[index] || {};
      const execution = await runPreparedProgram({
        language,
        cwd: tempDir,
        input: toText(testCase.input),
        timeoutMs
      });

      results.push({
        caseNo: index + 1,
        input: toText(testCase.input),
        expectedOutput: toText(testCase.output),
        ...execution
      });
    }

    return results;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Local execution failed: ${error?.message || "Unknown error"}`,
      500
    );
  } finally {
    await cleanupTempDir(tempDir);
  }
};
