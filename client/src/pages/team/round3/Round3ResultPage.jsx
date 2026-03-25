import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { fetchRound3Result } from "../../../api/round3MockApi";
import { useRound3Battle } from "./Round3BattleContext";

/* ─── DESIGN TOKENS ─── */
const mono     = { fontFamily: "'DM Mono','Fira Code',monospace" };
const cardBase = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl      = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const formatTime = (timeLeft) => {
  const safe    = Math.max(0, Number(timeLeft) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#38bdf8" }) {
  return (
    <motion.div
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
      style={{
        position: "absolute", left: 0, right: 0, height: "1px",
        pointerEvents: "none", zIndex: 2,
        background: `linear-gradient(90deg,transparent,${hex2rgba(color, 0.2)},transparent)`,
      }}
    />
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, bg, border, delay = 0, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}
      style={{ ...cardBase, padding: "18px 20px", position: "relative", overflow: "hidden" }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: `linear-gradient(90deg,transparent,${bg.replace("0.06", "0.4").replace("0.08", "0.4")},transparent)`
      }} />
      <p style={{ ...lbl, color: accent, marginBottom: "8px" }}>{label}</p>
      {value !== undefined && (
        <p style={{ fontSize: "24px", fontWeight: 700, color: accent.replace("0.6", "1").replace("rgba(", "rgba(").replace(", 0.6)", ", 1)"), lineHeight: 1 }}>
          {value}
        </p>
      )}
      {children}
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function Round3ResultPage() {
  const navigate = useNavigate();
  const {
    isHydrated,
    agreedToTerms,
    selectedLanguage,
    warnings,
    isSuspicious,
    timeLeft,
    submitResult,
    totalBugs,
    pointsPerBug,
  } = useRound3Battle();
  
  const [freshResult, setFreshResult] = useState(submitResult);
  const [resultReady, setResultReady] = useState(Boolean(submitResult));

  useEffect(() => {
    let active = true;

    const resolveResult = async () => {
      if (!isHydrated) return;

      if (!agreedToTerms) {
        navigate("/team/round3/terms", { replace: true });
        return;
      }

      if (submitResult) {
        if (!active) return;
        setFreshResult(submitResult);
        setResultReady(true);
        return;
      }

      try {
        const result = await fetchRound3Result();
        if (!active) return;

        if (result.finalResult || result.submitted) {
          setFreshResult({
            passed: Number(result.fixedBugs) || 0,
            total: Number(result.totalBugs) || 30,
            score: Number(result.score) || 0,
            rawScore: Number(result.rawScore) || 0,
            penaltyPoints: Number(result.penaltyPoints) || 0,
            usedLifelines: Number(result.usedLifelines) || 0,
            verdict:
              result.finalResult?.verdict ||
              ((Number(result.fixedBugs) || 0) === (Number(result.totalBugs) || 30)
                ? "accepted"
                : "partial"),
            fixedBugIds: result.finalResult?.fixedBugIds || [],
            remainingBugIds: result.finalResult?.remainingBugIds || [],
            mode: "submit",
            reason: result.submitReason,
            submittedAt: result.submittedAt
          });
          setResultReady(true);
          return;
        }
      } catch (error) {
        console.warn("Failed to fetch fresh result:", error.message);
      }

      if (!active) return;
      setResultReady(true);
      navigate(selectedLanguage ? "/team/round3/arena" : "/team/round3/language", {
        replace: true
      });
    };

    void resolveResult();
    return () => {
      active = false;
    };
  }, [isHydrated, agreedToTerms, selectedLanguage, submitResult, navigate]);

  // Use fresh result if available, otherwise use context
  const displayResult = freshResult || submitResult;

  if (!resultReady || !displayResult) return null;

  const maxScore    = totalBugs * pointsPerBug;
  const scoreRatio  = maxScore > 0 ? displayResult.score / maxScore : 0;
  const progressPct = maxScore > 0 ? (displayResult.passed / displayResult.total) * 100 : 0;
  const isAccepted  = displayResult.verdict === "accepted";

  /* Score tier coloring */
  const scoreTone = scoreRatio >= 0.8
    ? { accent: "#34d399", bg: "rgba(52,211,153,.08)",  border: "rgba(52,211,153,.22)"  }
    : scoreRatio >= 0.5
    ? { accent: "#38bdf8", bg: "rgba(56,189,248,.08)",  border: "rgba(56,189,248,.22)"  }
    : { accent: "#fb923c", bg: "rgba(251,146,60,.08)",  border: "rgba(251,146,60,.22)"  };

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: "14px", color: "#e2e8f0", ...mono }}
    >

      {/* ── HERO RESULT CARD ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        style={{ ...cardBase, padding: "26px 28px", position: "relative", overflow: "hidden" }}
      >
        <ScanLine color={scoreTone.accent} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg,transparent,${scoreTone.border.replace("0.22", "0.55")},transparent)`
        }} />
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{
            position: "absolute", top: "-50px", right: "-50px", width: "220px", height: "220px",
            borderRadius: "50%", background: scoreTone.bg.replace("0.08", "0.12"), filter: "blur(60px)", pointerEvents: "none"
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <p style={{ ...lbl, color: "rgba(56,189,248,.65)" }}>Round 3 — Bug Apocalypse</p>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", marginTop: "8px", letterSpacing: "-0.01em" }}>
                Debugging Battle Result
              </h2>
            </div>

            {/* Verdict badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px",
              borderRadius: "999px",
              background: isAccepted ? "rgba(52,211,153,.08)" : "rgba(248,113,113,.08)",
              border: `1px solid ${isAccepted ? "rgba(52,211,153,.25)" : "rgba(248,113,113,.25)"}`
            }}>
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
                style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: isAccepted ? "#34d399" : "#f87171",
                  boxShadow: `0 0 6px ${isAccepted ? "rgba(52,211,153,.8)" : "rgba(248,113,113,.8)"}`,
                }}
              />
              <span style={{ ...mono, fontSize: "11px", fontWeight: 700, color: isAccepted ? "#34d399" : "#f87171" }}>
                {(displayResult.verdict || "submitted").toUpperCase()}
              </span>
            </div>
          </div>

          {/* Score display */}
          <div style={{ marginTop: "20px", display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
              style={{ fontSize: "52px", fontWeight: 700, color: scoreTone.accent, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {displayResult.score}
            </motion.span>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "16px", color: "rgba(148,163,184,.55)" }}>/ {maxScore}</span>
              <p style={{ ...lbl, fontSize: "8px", marginTop: "4px" }}>total points</p>
            </div>
          </div>

          {/* Score progress bar */}
          <div style={{ marginTop: "14px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scoreRatio * 100}%` }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.25 }}
              style={{ height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,#38bdf8,${scoreTone.accent})` }}
            />
          </div>
          <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ ...lbl, fontSize: "8px", color: "rgba(148,163,184,.3)" }}>0</span>
            <span style={{ ...lbl, fontSize: "8px", color: scoreTone.accent.replace("1)", "0.6)") }}>
              {Math.round(scoreRatio * 100)}% of max score
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── TOP STAT TILES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
        {/* Bugs Fixed */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ ...cardBase, padding: "18px 20px", position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,rgba(56,189,248,.35),transparent)" }} />
          <p style={{ ...lbl, color: "rgba(56,189,248,.6)", marginBottom: "8px" }}>Bugs Fixed</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#7dd3fc", lineHeight: 1 }}>{displayResult.passed}</span>
            <span style={{ fontSize: "13px", color: "rgba(56,189,248,.45)" }}>/ {displayResult.total}</span>
          </div>
          {/* Mini progress bar */}
          <div style={{ marginTop: "10px", height: "4px", borderRadius: "999px", background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
              style={{ height: "100%", background: "linear-gradient(90deg,#38bdf8,#7dd3fc)", borderRadius: "999px" }}
            />
          </div>
        </motion.div>

        {/* Language */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ ...cardBase, padding: "18px 20px", position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,rgba(167,139,250,.35),transparent)" }} />
          <p style={{ ...lbl, color: "rgba(167,139,250,.6)", marginBottom: "8px" }}>Language</p>
          <span style={{ fontSize: "24px", fontWeight: 700, color: "#c4b5fd", lineHeight: 1 }}>
            {(selectedLanguage || "cpp").toUpperCase()}
          </span>
        </motion.div>

        {/* Integrity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ ...cardBase, padding: "18px 20px", position: "relative", overflow: "hidden" }}
        >
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: `linear-gradient(90deg,transparent,${isSuspicious ? "rgba(248,113,113,.35)" : "rgba(52,211,153,.35)"},transparent)`
          }} />
          <p style={{ ...lbl, color: isSuspicious ? "rgba(248,113,113,.6)" : "rgba(52,211,153,.6)", marginBottom: "8px" }}>Integrity</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <motion.span
              animate={{ opacity: isSuspicious ? [1, 0.3, 1] : 1 }}
              transition={{ duration: 1.2, repeat: isSuspicious ? Infinity : 0 }}
              style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: isSuspicious ? "#f87171" : "#34d399",
                boxShadow: `0 0 6px ${isSuspicious ? "rgba(248,113,113,.7)" : "rgba(52,211,153,.7)"}`,
                flexShrink: 0
              }}
            />
            <span style={{ fontSize: "24px", fontWeight: 700, color: isSuspicious ? "#f87171" : "#86efac", lineHeight: 1 }}>
              {isSuspicious ? "Flagged" : "Clean"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* ── DETAIL CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>

        {/* Session Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ ...cardBase, overflow: "hidden", position: "relative" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,rgba(251,146,60,.3),transparent)" }} />
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            <p style={{ ...lbl, color: "rgba(251,146,60,.55)" }}>◈ Session Stats</p>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Warnings",  value: warnings,            color: warnings > 0 ? "#fdba74" : "rgba(226,232,240,.78)" },
              { label: "Time Left", value: formatTime(timeLeft), color: "#f1f5f9" },
              { label: "Verdict",   value: displayResult.verdict || "submitted", color: isAccepted ? "#86efac" : "#fca5a5" },
            ].map(({ label, value, color }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.06 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)" }}
              >
                <span style={{ ...lbl, fontSize: "8px" }}>{label}</span>
                <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color }}>{value}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Submission Info */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ ...cardBase, overflow: "hidden", position: "relative" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,rgba(52,211,153,.3),transparent)" }} />
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            <p style={{ ...lbl, color: "rgba(52,211,153,.55)" }}>◈ Submission</p>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Reason",   value: displayResult.reason || "manual" },
              { label: "Mode",     value: displayResult.mode   || "submit" },
              { label: "Recorded", value: displayResult.submittedAt ? new Date(displayResult.submittedAt).toLocaleString() : "—" },
            ].map(({ label, value }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.33 + i * 0.06 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)" }}
              >
                <span style={{ ...lbl, fontSize: "8px" }}>{label}</span>
                <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color: "#86efac" }}>{value}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── ACTIONS ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
      >
        <motion.button whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => navigate("/team")}
          style={{
            ...mono, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            padding: "11px 20px", borderRadius: "10px",
            border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)",
            color: "#e2e8f0", cursor: "pointer", transition: "all 0.14s"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"; }}
        >
          Team Dashboard
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => navigate("/team/leaderboard")}
          style={{
            ...mono, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            padding: "11px 20px", borderRadius: "10px",
            border: "1px solid rgba(56,189,248,.35)", background: "rgba(56,189,248,.12)",
            color: "#7dd3fc", cursor: "pointer", transition: "all 0.14s",
            display: "flex", alignItems: "center", gap: "7px"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(56,189,248,.2)"; e.currentTarget.style.boxShadow = "0 0 18px rgba(56,189,248,.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(56,189,248,.12)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          Go To Leaderboard →
        </motion.button>

        {/* Status dot */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "2px" }}>
          <span style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: "#34d399", boxShadow: "0 0 6px rgba(52,211,153,.8)"
          }} />
          <span style={{ ...lbl, fontSize: "8px", color: "rgba(52,211,153,.6)" }}>Round 3 complete</span>
        </div>
      </motion.div>

    </motion.section>
  );
}
