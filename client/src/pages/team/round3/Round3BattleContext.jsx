import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  fetchRound3BuggyCode,
  fetchRound3Progress,
  addRound3Warning,
  requestRound3Hint,
  runRound3Debugging,
  submitRound3Debugging
} from "../../../api/round3MockApi";
import { getApiErrorMessage } from "../../../api/httpClient";
import { markLifelineRoundStart } from "../../../api/lifelineApi";
import {
  ROUND3_DURATION_SECONDS,
  ROUND3_HINT_COOLDOWN_SECONDS,
  ROUND3_POINTS_PER_BUG,
  ROUND3_TOTAL_BUGS,
  getRound3Challenge
} from "./round3ChallengeData";

const Round3BattleContext = createContext(null);
const ROUND3_MAX_WARNINGS = 3;
const ROUND3_MAX_RUNS = 10;
const defaultHintState = {
  usedCount: 0,
  revealedBugIds: [],
  cooldownSeconds: ROUND3_HINT_COOLDOWN_SECONDS,
  nextAvailableAt: null,
  remainingSeconds: 0,
  availableNow: true
};

const normalizeRound3Result = (payload, mode = "run") => {
  if (!payload) return null;

  const passed = Number(payload.passed ?? payload.fixedBugs) || 0;
  const total = Number(payload.total ?? payload.totalBugs) || ROUND3_TOTAL_BUGS;

  return {
    passed,
    total,
    score: Number(payload.score) || 0,
    rawScore: Number(payload.rawScore) || 0,
    penaltyPoints: Number(payload.penaltyPoints) || 0,
    usedLifelines: Number(payload.usedLifelines) || 0,
    fixedBugIds: Array.isArray(payload.fixedBugIds) ? payload.fixedBugIds : [],
    remainingBugIds: Array.isArray(payload.remainingBugIds)
      ? payload.remainingBugIds
      : [],
    title: payload.title || "",
    mode: payload.mode || mode,
    verdict:
      payload.verdict ||
      (mode === "submit"
        ? passed === total
          ? "accepted"
          : "partial"
        : "analysis-complete"),
    reason: payload.reason || payload.submitReason || "",
    submittedAt: payload.submittedAt || null
  };
};

const normalizeHintState = (payload) => ({
  usedCount: Number(payload?.usedCount) || 0,
  revealedBugIds: Array.isArray(payload?.revealedBugIds) ? payload.revealedBugIds : [],
  cooldownSeconds: Number(payload?.cooldownSeconds) || ROUND3_HINT_COOLDOWN_SECONDS,
  nextAvailableAt: payload?.nextAvailableAt || null,
  remainingSeconds: Number(payload?.remainingSeconds) || 0,
  availableNow:
    typeof payload?.availableNow === "boolean"
      ? payload.availableNow
      : (Number(payload?.remainingSeconds) || 0) <= 0
});

export function Round3BattleProvider({ children }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [code, setCode] = useState("");
  const [challengeMeta, setChallengeMeta] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ROUND3_DURATION_SECONDS);
  const [roundStartedAt, setRoundStartedAt] = useState(null);
  const [warnings, setWarnings] = useState(0);
  const [isSuspicious, setIsSuspicious] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(true);
  const [isRound3Active, setIsRound3Active] = useState(false); // FIX: Track if Round 3 ongoing
  const [hintState, setHintState] = useState(defaultHintState);
  const autoSubmitLock = useRef(false);

  // ===== FIX: Restore Round 3 progress on mount =====
  useEffect(() => {
    const restoreProgress = async () => {
      try {
        const progress = await fetchRound3Progress();
        const hasAnyRound3State =
          Boolean(progress.selectedLanguage) ||
          Boolean(progress.code) ||
          Boolean(progress.isStarted) ||
          Boolean(progress.isSubmitted);

        if (hasAnyRound3State) {
          setAgreedToTerms(true);
        }

        if (progress.selectedLanguage) {
          setSelectedLanguage(progress.selectedLanguage);
        }
        if (typeof progress.code === "string") {
          setCode(progress.code);
        }

        setWarnings(Number(progress.warnings) || 0);
        setIsSuspicious(Boolean(progress.isSuspicious));
        setRunCount(Number(progress.runCount) || 0);
        setRoundStartedAt(progress.startedAt || null);
        setChallengeMeta(progress.challenge || null);
        setHintState(normalizeHintState(progress.hint));

        if (Number.isFinite(Number(progress.remainingSeconds))) {
          setTimeLeft(Math.max(0, Number(progress.remainingSeconds)));
        }

        const restoredLastRun = normalizeRound3Result(progress.lastRun, "run");
        if (restoredLastRun) {
          setRunResult(restoredLastRun);
        }

        if (progress.isSubmitted) {
          const finalPayload =
            normalizeRound3Result(progress.finalResult, "submit") ||
            normalizeRound3Result(progress.result, "submit");
          if (finalPayload) {
            setSubmitResult(finalPayload);
            setRunResult(finalPayload);
          }
          setTimerStarted(false);
          setIsRound3Active(false);
        } else if (progress.isStarted) {
          setTimerStarted(true);
          setIsRound3Active(true);
        }
      } catch (error) {
        console.warn("Failed to restore Round 3 progress", error);
      } finally {
        setIsHydrated(true);
      }
    };

    void restoreProgress();
  }, []);

  // ===== FIX: Disable logout while timer is running =====
  useEffect(() => {
    setIsRound3Active(timerStarted && !submitResult);
  }, [timerStarted, submitResult]);

  // ===== FIX: Live progress ONLY from actual run/submit results =====
  // Do NOT calculate from code changes - only show after running!
  const liveProgress = useMemo(() => {
    // Use actual run/submit results
    if (runResult) {
      return {
        passed: runResult.passed,
        total: runResult.total,
        score: runResult.score,
        fixedBugIds: runResult.fixedBugIds || [],
        remainingBugIds: runResult.remainingBugIds || []
      };
    }

    if (submitResult) {
      return {
        passed: submitResult.passed,
        total: submitResult.total,
        score: submitResult.score,
        fixedBugIds: submitResult.fixedBugIds || [],
        remainingBugIds: submitResult.remainingBugIds || []
      };
    }

    // Default: zero progress until user runs code
    return {
      passed: 0,
      total: ROUND3_TOTAL_BUGS,
      score: 0,
      fixedBugIds: [],
      remainingBugIds: Array.from({ length: ROUND3_TOTAL_BUGS }, (_, index) => index + 1)
    };
  }, [runResult, submitResult]);

  const acceptTerms = useCallback((value) => {
    setAgreedToTerms(Boolean(value));
  }, []);

  const loadChallenge = useCallback(async (language) => {
    // FIX: Lock language after first selection
    if (selectedLanguage) {
      setStatusMessage("Language is locked once selected. You cannot change it.");
      return null; // Prevent language change
    }

    setIsChallengeLoading(true);
    setStatusMessage("");

    try {
      const payload = await fetchRound3BuggyCode(language);
      setAgreedToTerms(true);
      setSelectedLanguage(payload.selectedLanguage || payload.language || language);
      setCode(payload.code || "");
      setChallengeMeta(payload);

      setWarnings(Number(payload.warnings) || 0);
      setIsSuspicious(Boolean(payload.isSuspicious));
      setRunCount(Number(payload.runCount) || 0);
      setHintState(normalizeHintState(payload.hint));

      if (payload.startedAt) {
        setRoundStartedAt(payload.startedAt);
      }

      if (Number.isFinite(Number(payload.remainingSeconds))) {
        setTimeLeft(Math.max(0, Number(payload.remainingSeconds)));
      } else {
        setTimeLeft(ROUND3_DURATION_SECONDS);
      }

      const restoredLastRun = normalizeRound3Result(payload.lastRun, "run");
      setRunResult(restoredLastRun);

      if (payload.submitted) {
        const finalPayload =
          normalizeRound3Result(payload.finalResult, "submit") ||
          normalizeRound3Result(payload.lastRun, "submit");
        if (finalPayload) {
          setSubmitResult(finalPayload);
          setRunResult(finalPayload);
        }
        setTimerStarted(false);
        setIsRound3Active(false);
      } else {
        setSubmitResult(null);
        setTimerStarted(Boolean(payload.started));
        setIsRound3Active(Boolean(payload.started));
        autoSubmitLock.current = false;
        void markLifelineRoundStart("round3").catch(() => {});
      }

      return payload;
    } finally {
      setIsChallengeLoading(false);
    }
  }, [selectedLanguage]);

  const startTimer = useCallback(() => {
    setTimerStarted((prev) => {
      if (prev) return prev;
      const startedAt = new Date().toISOString();
      setRoundStartedAt((existing) => existing || startedAt);
      setIsRound3Active(true);
      void markLifelineRoundStart("round3").catch(() => {});
      return true;
    });
  }, []);

  const updateCode = useCallback((nextCode) => {
    setCode(nextCode || "");
  }, []);

  const resetCode = useCallback(() => {
    if (!selectedLanguage) return;

    const originalCode = challengeMeta?.code || getRound3Challenge(selectedLanguage).buggyCode;
    setCode(originalCode);
    setChallengeMeta((previous) =>
      previous
        ? {
            ...previous,
            code: originalCode
          }
        : previous
    );
    setRunResult(null);
    setStatusMessage("Editor reset to the original buggy code.");
  }, [challengeMeta?.code, selectedLanguage]);

  const revealHint = useCallback(async () => {
    if (!selectedLanguage || isRunning || isSubmitting || submitResult) return null;

    setStatusMessage("");

    try {
      const payload = await requestRound3Hint({
        language: selectedLanguage,
        code
      });
      setCode(payload.code || "");
      setHintState(normalizeHintState(payload.hint));
      setChallengeMeta((previous) =>
        previous
          ? {
              ...previous,
              code: payload.code || previous.code
            }
          : previous
      );
      setStatusMessage("Hint added in the editor.");
      return payload;
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Hint is not available right now."));
      throw error;
    }
  }, [selectedLanguage, code, isRunning, isSubmitting, submitResult]);

  const runCode = useCallback(async () => {
    if (!selectedLanguage || isRunning || isSubmitting) return null;

    setIsRunning(true);
    setStatusMessage("");

    try {
      const payload = await runRound3Debugging({
        language: selectedLanguage,
        code
      });
      const normalized = normalizeRound3Result(payload, "run");
      setRunResult(normalized);
      setRunCount((previous) => previous + 1);
      setStatusMessage(
        `Run complete. ${normalized.passed}/${normalized.total} bugs fixed for ${normalized.score} marks.`
      );
      return normalized;
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, "Run failed. Please try again."));
      throw error;
    } finally {
      setIsRunning(false);
    }
  }, [selectedLanguage, code, isRunning, isSubmitting]);

  const submitCode = useCallback(
    async ({ reason = "manual" } = {}) => {
      if (!selectedLanguage || isSubmitting || autoSubmitLock.current || submitResult) {
        return submitResult;
      }

      autoSubmitLock.current = true;
      setIsSubmitting(true);
      setStatusMessage("");
      let submitted = false;

      try {
        const payload = await submitRound3Debugging({
          language: selectedLanguage,
          code,
          reason
        });
        const normalized = normalizeRound3Result(payload, "submit");
        setSubmitResult(normalized);
        setRunResult(normalized);
        setStatusMessage(
          reason === "timeout"
            ? "Timer expired. Your patch was auto-submitted."
            : "Patch submitted successfully."
        );
        submitted = true;
        setIsRound3Active(false);
        return normalized;
      } catch (error) {
        setStatusMessage(getApiErrorMessage(error, "Submit failed. Please try again."));
        throw error;
      } finally {
        if (!submitted) {
          autoSubmitLock.current = false;
        }
        setIsSubmitting(false);
      }
    },
    [selectedLanguage, code, isSubmitting, submitResult]
  );

  const registerTabSwitch = useCallback(() => {
    setWarnings((prev) => {
      const next = prev + 1;
      if (next > ROUND3_MAX_WARNINGS) {
        setIsSuspicious(true);
      }
      return next;
    });

    void addRound3Warning()
      .then((payload) => {
        setWarnings(Number(payload.warnings) || 0);
        setIsSuspicious(Boolean(payload.isSuspicious));
      })
      .catch(() => {});
  }, []);

  const markRestrictions = useCallback((value) => {
    setRestrictionsEnabled(Boolean(value));
  }, []);

  useEffect(() => {
    if (!timerStarted || submitResult) return undefined;

    const intervalId = window.setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timerStarted, submitResult]);

  useEffect(() => {
    if (!timerStarted || submitResult || isSubmitting || timeLeft > 0 || autoSubmitLock.current) {
      return;
    }

    void submitCode({ reason: "timeout" });
  }, [timerStarted, submitResult, isSubmitting, timeLeft, submitCode]);

  const contextValue = useMemo(
    () => ({
      agreedToTerms,
      isHydrated,
      selectedLanguage,
      code,
      challengeMeta,
      timeLeft,
      roundStartedAt,
      warnings,
      isSuspicious,
      runCount,
      maxRuns: ROUND3_MAX_RUNS,
      isChallengeLoading,
      isRunning,
      isSubmitting,
      timerStarted,
      runResult,
      submitResult,
      statusMessage,
      restrictionsEnabled,
      liveProgress,
      isRound3Active,
      hintState,
      totalBugs: ROUND3_TOTAL_BUGS,
      pointsPerBug: ROUND3_POINTS_PER_BUG,
      acceptTerms,
      loadChallenge,
      startTimer,
      updateCode,
      resetCode,
      revealHint,
      runCode,
      submitCode,
      registerTabSwitch,
      markRestrictions,
      setStatusMessage
    }),
    [
      agreedToTerms,
      isHydrated,
      selectedLanguage,
      code,
      challengeMeta,
      timeLeft,
      roundStartedAt,
      warnings,
      isSuspicious,
      runCount,
      isChallengeLoading,
      isRunning,
      isSubmitting,
      timerStarted,
      runResult,
      submitResult,
      statusMessage,
      restrictionsEnabled,
      liveProgress,
      isRound3Active,
      hintState,
      acceptTerms,
      loadChallenge,
      startTimer,
      updateCode,
      resetCode,
      revealHint,
      runCode,
      submitCode,
      registerTabSwitch,
      markRestrictions
    ]
  );

  return (
    <Round3BattleContext.Provider value={contextValue}>
      {children}
    </Round3BattleContext.Provider>
  );
}

export function useRound3Battle() {
  const value = useContext(Round3BattleContext);

  if (!value) {
    throw new Error("useRound3Battle must be used within Round3BattleProvider");
  }

  return value;
}
