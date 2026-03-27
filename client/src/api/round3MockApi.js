import {
  ROUND3_HINT_COOLDOWN_SECONDS,
  ROUND3_TOTAL_BUGS
} from "../pages/team/round3/round3ChallengeData";
import httpClient from "./httpClient";

const defaultHintState = {
  usedCount: 0,
  revealedBugIds: [],
  cooldownSeconds: ROUND3_HINT_COOLDOWN_SECONDS,
  nextAvailableAt: null,
  remainingSeconds: 0,
  availableNow: true
};

/**
 * Fetch previous Round 3 progress and state from backend
 * Returns: { code, language, selectedLanguage, submission state, run results }
 */
export const fetchRound3Progress = async () => {
  try {
    const response = await httpClient.get("/api/round/round3/status");
    const data = response?.data || {};
    
    // Backend returns flat structure from buildStatusPayload, not nested submission
    return {
      code: data.challenge?.code || "",
      language: data.selectedLanguage || "",
      selectedLanguage: data.selectedLanguage || "",
      isStarted: Boolean(data.started),
      isSubmitted: Boolean(data.submitted),
      runCount: Number(data.runCount) || 0,
      warnings: Number(data.warnings) || 0,
      isSuspicious: Boolean(data.isSuspicious),
      startedAt: data.startedAt || null,
      submittedAt: data.submittedAt || null,
      durationSeconds: Number(data.durationSeconds) || 0,
      elapsedSeconds: Number(data.elapsedSeconds) || 0,
      remainingSeconds: Number(data.remainingSeconds) || 0,
      lastRun: data.lastRun || null,
      challenge: data.challenge || null,
      hint: data.hint || defaultHintState,
      // FIX: Return finalResult if submitted, otherwise null
      finalResult: data.finalResult || null,
      result: data.result || null,
      // For backwards compatibility, also include direct fields
      score: data.result?.score || 0,
      fixedBugs: data.result?.fixedBugs || 0,
      totalBugs: data.result?.totalBugs || ROUND3_TOTAL_BUGS,
      fixedBugIds: data.result?.fixedBugIds || data.finalResult?.fixedBugIds || [],
      remainingBugIds: data.result?.remainingBugIds || data.finalResult?.remainingBugIds || []
    };
  } catch (error) {
    // If endpoint fails or team hasn't started round 3, return empty state
    console.warn("Could not fetch Round 3 progress:", error.message);
    return {
      code: "",
      language: "",
      selectedLanguage: "",
      isStarted: false,
      isSubmitted: false,
      runCount: 0,
      warnings: 0,
      isSuspicious: false,
      startedAt: null,
      submittedAt: null,
      durationSeconds: 0,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      lastRun: null,
      challenge: null,
      hint: defaultHintState,
      finalResult: null,
      result: null,
      score: 0,
      fixedBugs: 0,
      totalBugs: ROUND3_TOTAL_BUGS,
      fixedBugIds: [],
      remainingBugIds: []
    };
  }
};

/**
 * Fetch Round 3 result specifically from backend
 * Called when user navigates to result page to ensure fresh data
 */
export const fetchRound3Result = async () => {
  try {
    const response = await httpClient.get("/api/round/round3/result");
    const data = response?.data || {};

    // Backend returns flat structure from getRound3ResultPayload
    return {
      round: 3,
      submitted: Boolean(data.submitted),
      maxScore: Number(data.maxScore) || 150,
      totalBugs: Number(data.totalBugs) || 30,
      pointsPerBug: Number(data.pointsPerBug) || 5,
      selectedLanguage: data.selectedLanguage || "",
      startedAt: data.startedAt || null,
      submittedAt: data.submittedAt || null,
      score: Number(data.score) || 0,
      rawScore: Number(data.rawScore) || 0,
      penaltyPoints: Number(data.penaltyPoints) || 0,
      usedLifelines: Number(data.usedLifelines) || 0,
      fixedBugs: Number(data.fixedBugs) || 0,
      warnings: Number(data.warnings) || 0,
      isSuspicious: Boolean(data.isSuspicious),
      submitReason: data.submitReason || "",
      hint: data.hint || defaultHintState,
      lastRun: data.lastRun || null,
      finalResult: data.finalResult || null
    };
  } catch (error) {
    console.warn("Could not fetch Round 3 result:", error.message);
    return {
      round: 3,
      submitted: false,
      maxScore: 150,
      totalBugs: ROUND3_TOTAL_BUGS,
      pointsPerBug: 5,
      selectedLanguage: "",
      startedAt: null,
      submittedAt: null,
      score: 0,
      rawScore: 0,
      penaltyPoints: 0,
      usedLifelines: 0,
      fixedBugs: 0,
      warnings: 0,
      isSuspicious: false,
      submitReason: "",
      hint: defaultHintState,
      lastRun: null,
      finalResult: null
    };
  }
};

export const fetchRound3BuggyCode = async (language) => {
  const { data } = await httpClient.post("/api/round/round3/start", { language });
  const challenge = data?.challenge || {};

  return {
    language: data?.selectedLanguage || challenge.language || language || "",
    selectedLanguage: data?.selectedLanguage || challenge.language || language || "",
    label: challenge.label || "",
    title: challenge.title || "",
    subtitle: challenge.subtitle || "",
    systems: Array.isArray(challenge.systems) ? challenge.systems : [],
    totalBugs: Number(data?.totalBugs) || Number(challenge.totalBugs) || ROUND3_TOTAL_BUGS,
    pointsPerBug: Number(data?.pointsPerBug) || 5,
    code: challenge.code || "",
    started: Boolean(data?.started),
    submitted: Boolean(data?.submitted),
    startedAt: data?.startedAt || null,
    elapsedSeconds: Number(data?.elapsedSeconds) || 0,
    remainingSeconds: Number(data?.remainingSeconds) || 0,
    warnings: Number(data?.warnings) || 0,
    isSuspicious: Boolean(data?.isSuspicious),
    runCount: Number(data?.runCount) || 0,
    hint: data?.hint || defaultHintState,
    lastRun: data?.lastRun || null,
    finalResult: data?.finalResult || null
  };
};

export const requestRound3Hint = async ({ language, code }) => {
  const { data } = await httpClient.post("/api/round/round3/hint", {
    language,
    code
  });

  return {
    code: data?.code || code || "",
    bugId: Number(data?.bugId) || 0,
    comment: data?.comment || "",
    hint: data?.hint || defaultHintState
  };
};

export const runRound3Debugging = async ({ language, code }) => {
  const { data } = await httpClient.post("/api/round/round3/run", {
    language,
    code
  });

  return {
    passed: Number(data?.passed) || 0,
    total: Number(data?.total) || ROUND3_TOTAL_BUGS,
    score: Number(data?.score) || 0,
    rawScore: Number(data?.rawScore) || 0,
    penaltyPoints: Number(data?.penaltyPoints) || 0,
    usedLifelines: Number(data?.usedLifelines) || 0,
    fixedBugIds: data?.fixedBugIds || [],
    remainingBugIds: data?.remainingBugIds || [],
    title: data?.title || "",
    mode: data?.mode || "run",
    verdict: data?.verdict || "analysis-complete"
  };
};

export const submitRound3Debugging = async ({ language, code, reason = "manual" }) => {
  const { data } = await httpClient.post("/api/round/round3/submit", {
    language,
    code,
    reason
  });

  return {
    passed: Number(data?.passed) || 0,
    total: Number(data?.total) || ROUND3_TOTAL_BUGS,
    score: Number(data?.score) || 0,
    rawScore: Number(data?.rawScore) || 0,
    penaltyPoints: Number(data?.penaltyPoints) || 0,
    usedLifelines: Number(data?.usedLifelines) || 0,
    fixedBugIds: data?.fixedBugIds || [],
    remainingBugIds: data?.remainingBugIds || [],
    title: data?.title || "",
    mode: data?.mode || "submit",
    reason: data?.reason || reason,
    submittedAt: data?.submittedAt || new Date().toISOString(),
    verdict: data?.verdict || (Number(data?.passed) === Number(data?.total) ? "accepted" : "partial")
  };
};

export const addRound3Warning = async () => {
  const { data } = await httpClient.post("/api/round/round3/warn");
  return {
    warnings: Number(data?.warnings) || 0,
    maxWarnings: Number(data?.maxWarnings) || 3,
    isSuspicious: Boolean(data?.isSuspicious)
  };
};
