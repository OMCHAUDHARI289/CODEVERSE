import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../../api/httpClient";
import { getMyLifelineStatus, requestLifeline } from "../../../api/lifelineApi";
import { useRound3Battle } from "./Round3BattleContext";

/* ─── DESIGN TOKENS ─── */
const mono     = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card     = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl      = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

/* Bug-theme accent palette */
const BUG = {
  red:    "#f87171",
  redDim: "rgba(248,113,113,",
  orange: "#fb923c",
  purple: "#a78bfa",
  cyan:   "#38bdf8",
  green:  "#34d399",
};

const formatTime = (timeLeft) => {
  const safe = Math.max(0, Number(timeLeft)||0);
  return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`;
};
const LIFELINE_UNLOCK_DELAY_SECONDS = 15 * 60;
const LIFELINE_STATUS_POLL_MS       = 15000;

/* ─── GLITCH TEXT ─── */
function GlitchText({ children, color="#f87171", size="20px" }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() > 0.7) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 120);
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.span
      style={{
        ...mono, fontSize: size, fontWeight: 800, color,
        letterSpacing: "-0.02em", lineHeight: 1,
        textShadow: glitch ? `3px 0 ${BUG.cyan}, -3px 0 ${BUG.red}` : "none",
        display: "inline-block",
        transition: "text-shadow 0.05s",
      }}
    >
      {children}
    </motion.span>
  );
}

/* ─── BUG SCAN LINE ─── */
function BugScanLine({ urgent=false }) {
  return (
    <motion.div
      animate={{ top: ["0%","100%"] }}
      transition={{ duration: urgent?2:3.5, repeat: Infinity, ease: "linear", repeatDelay: urgent?0.3:1.5 }}
      style={{
        position:"absolute", left:0, right:0, height:"2px",
        pointerEvents:"none", zIndex:2,
        background: urgent
          ? "linear-gradient(90deg,transparent,rgba(248,113,113,0.35),rgba(248,113,113,0.1),transparent)"
          : "linear-gradient(90deg,transparent,rgba(248,113,113,0.18),transparent)",
      }}
    />
  );
}

/* ─── CORRUPTED CORNER MARKS ─── */
function CorruptedCorners({ color="rgba(248,113,113,0.5)", size=12 }) {
  const style = { position:"absolute", width:`${size}px`, height:`${size}px`, pointerEvents:"none" };
  const line  = { stroke:color, strokeWidth:"1.5", fill:"none" };
  return (
    <>
      <div style={{ ...style, top:0, left:0 }}>
        <svg viewBox="0 0 12 12"><path d="M0 12 L0 0 L12 0" {...line}/></svg>
      </div>
      <div style={{ ...style, top:0, right:0 }}>
        <svg viewBox="0 0 12 12"><path d="M12 12 L12 0 L0 0" {...line}/></svg>
      </div>
      <div style={{ ...style, bottom:0, left:0 }}>
        <svg viewBox="0 0 12 12"><path d="M0 0 L0 12 L12 12" {...line}/></svg>
      </div>
      <div style={{ ...style, bottom:0, right:0 }}>
        <svg viewBox="0 0 12 12"><path d="M12 0 L12 12 L0 12" {...line}/></svg>
      </div>
    </>
  );
}

/* ─── BUG PROGRESS BAR ─── */
function BugProgressBar({ passed, total }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const color = pct >= 100 ? BUG.green : pct >= 60 ? BUG.purple : pct >= 30 ? BUG.orange : BUG.red;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"7px" }}>
        <span style={{ ...lbl, fontSize:"8px", color:`${color}99` }}>Bug Progress</span>
        <span style={{ ...mono, fontSize:"10px", fontWeight:700, color }}>
          {passed} / {total} fixed · {Math.round(pct)}%
        </span>
      </div>
      <div style={{ height:"6px", background:"rgba(255,255,255,0.06)", borderRadius:"999px", overflow:"hidden", position:"relative" }}>
        <motion.div
          initial={{ width:0 }} animate={{ width:`${pct}%` }}
          transition={{ duration:0.6, ease:"easeOut" }}
          style={{ height:"100%", borderRadius:"999px",
            background:`linear-gradient(90deg,${BUG.red},${color})`,
            boxShadow:`0 0 10px ${hex2rgba(color,0.6)}` }}
        />
      </div>
      {/* Tick marks */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"5px" }}>
        {Array.from({ length: Math.min(total, 10) }, (_,i)=>(
          <div key={i} style={{
            width:"6px", height:"6px", borderRadius:"2px",
            background: i < passed ? BUG.green : "rgba(255,255,255,0.08)",
            boxShadow: i < passed ? `0 0 5px ${hex2rgba(BUG.green,0.7)}` : "none",
            transition:"all 0.3s",
          }}/>
        ))}
      </div>
    </div>
  );
}

/* ─── SUBMIT CONFIRM MODAL ─── */
function SubmitConfirmModal({ onConfirm, onCancel, loading, score, total }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target===e.currentTarget && onCancel()}
      style={{
        position:"fixed", inset:0, zIndex:150, display:"flex", alignItems:"center",
        justifyContent:"center", background:"rgba(0,0,0,0.88)",
        backdropFilter:"blur(12px)", padding:"16px",
      }}
    >
      <motion.div initial={{ scale:0.93, y:20 }} animate={{ scale:1, y:0 }}
        exit={{ scale:0.93, y:20 }} transition={{ type:"spring", stiffness:360, damping:28 }}
        style={{
          ...card, width:"100%", maxWidth:"440px", overflow:"hidden",
          boxShadow:"0 40px 100px rgba(0,0,0,0.9), 0 0 40px rgba(248,113,113,0.08)",
          border:"1px solid rgba(248,113,113,0.3)", position:"relative",
        }}
      >
        <CorruptedCorners color="rgba(248,113,113,0.6)" size={14} />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(248,113,113,0.6),transparent)" }}/>

        {/* Header */}
        <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(248,113,113,0.05)" }}>
          <p style={{ ...lbl, color:"rgba(248,113,113,0.65)", marginBottom:"6px" }}>Round 3 · Final Lock</p>
          <h3 style={{ ...mono, fontSize:"16px", fontWeight:700, color:"#fca5a5", margin:0 }}>
            Submit your patch?
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding:"20px 22px" }}>
          <div style={{ display:"flex", gap:"12px", padding:"14px", borderRadius:"10px",
            background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.2)",
            marginBottom:"14px" }}>
            <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.9, repeat:Infinity }}
              style={{ width:"7px", height:"7px", borderRadius:"50%", background:BUG.red,
                boxShadow:`0 0 8px ${hex2rgba(BUG.red,0.9)}`, flexShrink:0, marginTop:"4px" }}/>
            <div>
              <p style={{ ...mono, fontSize:"11px", fontWeight:700, color:"#fca5a5", marginBottom:"5px" }}>
                This action is irreversible
              </p>
              <p style={{ fontSize:"12px", lineHeight:1.65, color:"rgba(203,213,225,0.6)",
                fontFamily:"'Inter',sans-serif", margin:0 }}>
                Your patch will be locked and scored. Live score is{" "}
                <strong style={{ color:BUG.purple }}>{score} / {total}</strong>.
                You cannot edit or re-submit after confirming.
              </p>
            </div>
          </div>
          <p style={{ fontSize:"11.5px", color:"rgba(148,163,184,0.45)", fontFamily:"'Inter',sans-serif" }}>
            Tip: Run your code first to check your fix count before locking.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 22px", borderTop:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(0,0,0,0.3)", display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding:"9px 20px", borderRadius:"9px", ...mono, fontSize:"10px", fontWeight:600,
              letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer",
              border:"1px solid rgba(255,255,255,0.09)", background:"transparent",
              color:"rgba(148,163,184,0.65)", transition:"all 0.14s" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="#e2e8f0";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(148,163,184,0.65)";}}
          >Keep Editing</button>

          <motion.button whileTap={{ scale:0.97 }} onClick={onConfirm} disabled={loading}
            style={{ padding:"9px 22px", borderRadius:"9px", ...mono, fontSize:"10px", fontWeight:700,
              letterSpacing:"0.14em", textTransform:"uppercase",
              cursor:loading?"not-allowed":"pointer",
              border:"1px solid rgba(248,113,113,0.45)", background:"rgba(248,113,113,0.14)",
              color:"#fca5a5", transition:"all 0.14s",
              display:"flex", alignItems:"center", gap:"7px", opacity:loading?0.7:1 }}
            onMouseEnter={e=>{if(!loading){e.currentTarget.style.background="rgba(248,113,113,0.25)";e.currentTarget.style.borderColor="rgba(248,113,113,0.65)";}}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(248,113,113,0.14)";e.currentTarget.style.borderColor="rgba(248,113,113,0.45)";}}
          >
            {loading
              ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Locking...</>
              : "🔒 Lock & Submit"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN — all logic untouched
══════════════════════════════════════════ */
export default function Round3ArenaPage() {
  const navigate = useNavigate();

  const {
    isHydrated, agreedToTerms, selectedLanguage, code, challengeMeta, timeLeft, roundStartedAt,
    warnings, isSuspicious, isChallengeLoading, isRunning, isSubmitting, timerStarted,
    runResult, submitResult, statusMessage, restrictionsEnabled, liveProgress,
    totalBugs, pointsPerBug, startTimer, updateCode, runCode, submitCode, registerTabSwitch,
  } = useRound3Battle();

  const [restrictionNotice,  setRestrictionNotice]  = useState("");
  const [lifeline,           setLifeline]           = useState(null);
  const [lifelineBusy,       setLifelineBusy]       = useState(false);
  const [saved,              setSaved]              = useState(true);
  const [showSubmitConfirm,  setShowSubmitConfirm]  = useState(false);
  const saveTimerRef = useRef(null);

  const syncLifeline = useCallback(async () => {
    const payload = await getMyLifelineStatus("round3");
    setLifeline(payload);
    return payload;
  }, []);

  /* Guards */
  useEffect(() => {
    if (!isHydrated) return;
    if (!agreedToTerms)    { navigate("/team/round3/terms",    { replace:true }); return; }
    if (!selectedLanguage) { navigate("/team/round3/language", { replace:true }); return; }
  }, [isHydrated, agreedToTerms, selectedLanguage, navigate]);

  /* Auto-start timer */
  useEffect(() => {
    if (!isHydrated) return;
    if (selectedLanguage && !timerStarted && !submitResult && !roundStartedAt) {
      startTimer();
    }
  }, [isHydrated, selectedLanguage, timerStarted, submitResult, roundStartedAt, startTimer]);

  useEffect(() => {
    if (!isHydrated || !selectedLanguage) return;
    void syncLifeline().catch(()=>{});
  }, [isHydrated, selectedLanguage, syncLifeline]);

  /* Navigate on submit */
  useEffect(() => {
    if (submitResult) navigate("/team/round3/result", { replace:true });
  }, [navigate, submitResult]);

  useEffect(() => {
    if (!timerStarted || submitResult) return undefined;
    const id = window.setInterval(() => { void syncLifeline().catch(()=>{}); }, LIFELINE_STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [submitResult, syncLifeline, timerStarted]);

  /* Tab-switch detection */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && !submitResult) {
        registerTabSwitch();
        window.setTimeout(() => window.alert("Tab switching detected. A warning has been recorded."), 0);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [registerTabSwitch, submitResult]);

  /* Restriction events */
  useEffect(() => {
    if (!restrictionsEnabled || submitResult) return undefined;
    const block = (e, msg) => { e.preventDefault(); setRestrictionNotice(msg); };
    const onContextMenu = e => block(e, "Right click is disabled in Round 3.");
    const onPaste       = e => block(e, "Paste is disabled while Round 3 is active.");
    const onCopy        = e => block(e, "Copy is restricted during the debugging battle.");
    const onCut         = e => block(e, "Cut is restricted during the debugging battle.");
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("paste",       onPaste);
    document.addEventListener("copy",        onCopy);
    document.addEventListener("cut",         onCut);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("paste",       onPaste);
      document.removeEventListener("copy",        onCopy);
      document.removeEventListener("cut",         onCut);
    };
  }, [restrictionsEnabled, submitResult]);

  useEffect(() => {
    if (!restrictionNotice) return undefined;
    const id = window.setTimeout(() => setRestrictionNotice(""), 2200);
    return () => window.clearTimeout(id);
  }, [restrictionNotice]);

  /* Derived */
  const currentResult  = useMemo(() => submitResult || runResult, [submitResult, runResult]);
  const monacoLanguage = selectedLanguage === "java" ? "java" : "cpp";
  const isUrgent       = timeLeft <= 300;
  const progressPct    = totalBugs > 0 ? (liveProgress.passed / totalBugs) * 100 : 0;

  const roundStartedAtMs = roundStartedAt ? new Date(roundStartedAt).getTime() : NaN;
  const elapsedSeconds   = Number.isFinite(roundStartedAtMs)
    ? Math.max(0, Math.floor((Date.now() - roundStartedAtMs) / 1000)) : 0;
  const lifelineUnlocked     = elapsedSeconds >= LIFELINE_UNLOCK_DELAY_SECONDS;
  const lifelineWaitSeconds  = Math.max(0, LIFELINE_UNLOCK_DELAY_SECONDS - elapsedSeconds);
  const lifelineRemaining    = Number(lifeline?.remainingCount ?? 2);
  const lifelineUsedCount    = Number(lifeline?.usedCount ?? 0);
  const lifelinePending      = lifeline?.request?.status === "pending";
  const lifelineApproved     = lifeline?.request?.status === "approved";
  const lifelineRejected     = lifeline?.request?.status === "rejected";
  const lifelinePenalty      = Number(lifeline?.penaltyPoints ?? 20);

  const handleCodeChange = (value) => {
    updateCode(value || "");
    setSaved(false);
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaved(true), 1200);
  };

  const handleSubmitClick = () => {
    if (isSubmitting || submitResult || isChallengeLoading) return;
    setShowSubmitConfirm(true);
  };

  const handleSubmitConfirm = async () => {
    try {
      await submitCode({ reason:"manual" });
      setShowSubmitConfirm(false);
    } catch {
      // keep modal open so the team can retry submit
    }
  };

  const handleLifelineRequest = async () => {
    if (!lifelineUnlocked || lifelineRemaining <= 0 || lifelinePending || submitResult) return;
    setLifelineBusy(true); setRestrictionNotice("");
    try {
      await requestLifeline("round3");
      await syncLifeline();
    } catch (err) {
      setRestrictionNotice(getApiErrorMessage(err, "Unable to request a lifeline."));
    } finally { setLifelineBusy(false); }
  };

  /* ══════════════ RENDER ══════════════ */
  return (
    <>
      <AnimatePresence>
        {showSubmitConfirm && (
          <SubmitConfirmModal
            loading={isSubmitting}
            score={liveProgress.score}
            total={totalBugs * pointsPerBug}
            onConfirm={handleSubmitConfirm}
            onCancel={() => !isSubmitting && setShowSubmitConfirm(false)}
          />
        )}
      </AnimatePresence>

      <motion.section
        initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
        style={{ display:"flex", flexDirection:"column", gap:"14px", color:"#e2e8f0", ...mono }}
      >

        {/* ══ HERO HEADER ══ */}
        <div style={{
          ...card, padding:"22px 28px", position:"relative", overflow:"hidden",
          border: isUrgent
            ? "1px solid rgba(248,113,113,0.35)"
            : "1px solid rgba(248,113,113,0.2)",
          background: "#13161e",
        }}>
          <BugScanLine urgent={isUrgent} />
          <CorruptedCorners color={isUrgent?"rgba(248,113,113,0.7)":"rgba(248,113,113,0.35)"} size={14} />

          {/* Ambient glow */}
          <motion.div
            animate={{ opacity:[0.2,0.45,0.2], scale:[1,1.1,1] }}
            transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
            style={{ position:"absolute", top:"-60px", right:"-60px",
              width:"240px", height:"240px", borderRadius:"50%",
              background:"rgba(248,113,113,0.1)", filter:"blur(60px)", pointerEvents:"none" }}
          />
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
            background:`linear-gradient(90deg,transparent,${isUrgent?"rgba(248,113,113,0.7)":"rgba(248,113,113,0.4)"},transparent)` }}/>

          <div style={{ position:"relative", zIndex:1, display:"flex",
            alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"16px" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
                <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.9, repeat:Infinity }}
                  style={{ width:"8px", height:"8px", borderRadius:"50%",
                    background:BUG.red, boxShadow:`0 0 10px ${hex2rgba(BUG.red,0.9)}`, flexShrink:0 }}/>
                <p style={{ ...lbl, color:"rgba(248,113,113,0.65)" }}>
                  Team · Round 3 — Bug Apocalypse
                </p>
              </div>
              <GlitchText color="#fca5a5" size="22px">Debugging Battle</GlitchText>
              <p style={{ marginTop:"7px", fontSize:"12px",
                color:"rgba(203,213,225,0.5)", fontFamily:"'Inter',sans-serif" }}>
                {challengeMeta?.subtitle || "Fix all bugs in the loaded program before time runs out."}
              </p>
            </div>

            {/* Stat cluster */}
            <div style={{ display:"flex", alignItems:"stretch", gap:"10px", flexWrap:"wrap" }}>

              {/* Timer */}
              <div style={{
                padding:"12px 18px", borderRadius:"11px", position:"relative", overflow:"hidden",
                background: isUrgent?"rgba(248,113,113,0.1)":"rgba(248,113,113,0.06)",
                border: isUrgent?"1px solid rgba(248,113,113,0.45)":"1px solid rgba(248,113,113,0.2)",
                boxShadow: isUrgent?"0 0 20px rgba(248,113,113,0.15)":"none",
              }}>
                {isUrgent && (
                  <motion.div animate={{ opacity:[0,0.3,0] }} transition={{ duration:0.5, repeat:Infinity }}
                    style={{ position:"absolute", inset:0, background:"rgba(248,113,113,0.12)", pointerEvents:"none" }}/>
                )}
                <p style={{ ...lbl, fontSize:"8px", color:"rgba(248,113,113,0.6)", marginBottom:"5px" }}>
                  ⏱ Timer
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  {isUrgent && (
                    <motion.span animate={{ opacity:[1,0.1,1] }} transition={{ duration:0.6, repeat:Infinity }}
                      style={{ width:"6px", height:"6px", borderRadius:"50%",
                        background:BUG.red, boxShadow:`0 0 8px ${hex2rgba(BUG.red,0.95)}`, flexShrink:0 }}/>
                  )}
                  <GlitchText color={isUrgent?BUG.red:"#fca5a5"} size="22px">
                    {formatTime(timeLeft)}
                  </GlitchText>
                </div>
              </div>

              {/* Warnings */}
              <div style={{ padding:"12px 18px", borderRadius:"11px",
                background: warnings>0?"rgba(248,113,113,0.08)":"rgba(255,255,255,0.03)",
                border: warnings>0?"1px solid rgba(248,113,113,0.25)":"1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ ...lbl, fontSize:"8px",
                  color:warnings>0?"rgba(248,113,113,0.6)":"rgba(148,163,184,0.45)", marginBottom:"5px" }}>
                  ⚠ Warnings
                </p>
                <GlitchText color={warnings>0?BUG.red:"rgba(203,213,225,0.7)"} size="22px">
                  {warnings}
                </GlitchText>
              </div>

              {/* Bug score */}
              <div style={{ padding:"12px 18px", borderRadius:"11px",
                background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.22)" }}>
                <p style={{ ...lbl, fontSize:"8px", color:"rgba(167,139,250,0.6)", marginBottom:"5px" }}>
                  🐛 Score
                </p>
                <div style={{ display:"flex", alignItems:"baseline", gap:"3px" }}>
                  <span style={{ ...mono, fontSize:"22px", fontWeight:800, color:BUG.purple, lineHeight:1 }}>
                    {liveProgress.score}
                  </span>
                  <span style={{ ...mono, fontSize:"11px", color:"rgba(167,139,250,0.4)" }}>
                    &nbsp;/ {totalBugs * pointsPerBug}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ ALERT / RESTRICTION BANNER ══ */}
        <AnimatePresence>
          {(statusMessage || restrictionNotice || isSuspicious) && (
            <motion.div
              initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{
                padding:"10px 16px", borderRadius:"10px",
                background: isSuspicious?"rgba(248,113,113,0.1)":"rgba(248,113,113,0.07)",
                border:`1px solid ${isSuspicious?"rgba(248,113,113,0.4)":"rgba(248,113,113,0.22)"}`,
                display:"flex", alignItems:"center", gap:"10px",
              }}>
              <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.8, repeat:Infinity }}
                style={{ width:"7px", height:"7px", borderRadius:"50%", background:BUG.red,
                  boxShadow:`0 0 8px ${hex2rgba(BUG.red,0.9)}`, flexShrink:0 }}/>
              <span style={{ fontSize:"12px", color:"#fca5a5", flex:1 }}>
                {restrictionNotice || statusMessage || ""}
                {isSuspicious ? " ⚠ Warning threshold exceeded — this session is flagged." : ""}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ MAIN GRID ══ */}
        <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:"12px" }}>

          {/* ── LEFT INTEL PANEL ── */}
          <div style={{
            ...card, display:"flex", flexDirection:"column", overflow:"hidden",
            maxHeight:"760px", position:"relative",
            border:"1px solid rgba(248,113,113,0.18)",
          }}>
            <BugScanLine />
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
              background:"linear-gradient(90deg,transparent,rgba(248,113,113,0.4),rgba(167,139,250,0.3),transparent)" }}/>

            {/* Panel header */}
            <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)",
              background:"rgba(248,113,113,0.04)", flexShrink:0 }}>
              <p style={{ ...lbl, fontSize:"8px", color:"rgba(248,113,113,0.55)" }}>◈ Arena Intel</p>
              <p style={{ marginTop:"6px", fontSize:"15px", fontWeight:700, color:"#f1f5f9" }}>
                {challengeMeta?.label || selectedLanguage || "Language"} Debugging Brief
              </p>
            </div>

            <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column",
              gap:"10px", overflowY:"auto", flex:1,
              scrollbarWidth:"thin", scrollbarColor:"rgba(248,113,113,0.15) transparent" }}>

              {/* Bug Progress */}
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.05 }}
                style={{ padding:"14px 16px", borderRadius:"11px",
                  background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.18)",
                  position:"relative", overflow:"hidden" }}>
                <BugProgressBar passed={liveProgress.passed} total={totalBugs} />
              </motion.div>

              {/* Instructions */}
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.08 }}
                style={{ padding:"12px 14px", borderRadius:"10px",
                  background:"rgba(56,189,248,0.04)", border:"1px solid rgba(56,189,248,0.16)" }}>
                <p style={{ ...lbl, fontSize:"8px", color:"rgba(56,189,248,0.5)", marginBottom:"6px" }}>
                  Instructions
                </p>
                <p style={{ fontSize:"12.5px", lineHeight:1.7, color:"rgba(226,232,240,0.78)",
                  fontFamily:"'Inter',sans-serif", margin:0 }}>
                  Fix all bugs in the loaded program. Run to check progress, then submit when ready.
                </p>
              </motion.div>

              {/* Lifeline */}
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.11 }}
                style={{ padding:"12px 14px", borderRadius:"10px", position:"relative",
                  background: lifelinePending?"rgba(251,146,60,0.07)":"rgba(255,255,255,0.02)",
                  border: lifelinePending?"1px solid rgba(251,146,60,0.25)":"1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ ...lbl, fontSize:"8px", color:"rgba(251,146,60,0.55)", marginBottom:"8px" }}>
                  ⚡ Lifeline
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
                  <span style={{ ...mono, fontSize:"26px", fontWeight:800, color:BUG.orange, lineHeight:1 }}>
                    {lifelineRemaining}
                  </span>
                  <div>
                    <p style={{ ...lbl, fontSize:"8px", color:"rgba(251,146,60,0.5)" }}>remaining</p>
                    <p style={{ ...lbl, fontSize:"7px", color:"rgba(100,116,139,0.5)", marginTop:"2px" }}>
                      {lifelineUsedCount} / {lifeline?.maxRequests??2} used · −{lifelinePenalty} pts
                    </p>
                  </div>
                </div>
                <p style={{ fontSize:"11.5px", color:"rgba(203,213,225,0.6)", lineHeight:1.65,
                  fontFamily:"'Inter',sans-serif", margin:0 }}>
                  {!timerStarted
                    ? "Lifeline unlocks once the battle timer starts."
                    : !lifelineUnlocked
                      ? `Unlocks in ${formatTime(lifelineWaitSeconds)}.`
                      : lifelinePending ? "Pending admin approval."
                      : lifelineRemaining<=0 ? "Both lifelines used."
                      : lifelineApproved ? "One approved. One remaining."
                      : lifelineRejected ? "Last request rejected. Retry if attempts remain."
                      : "Lifeline ready to request."}
                </p>
                {lifeline?.request?.requestedAt && (
                  <p style={{ ...lbl, fontSize:"7px", marginTop:"8px", color:"rgba(100,116,139,0.45)" }}>
                    Latest: {lifeline.request.status} · {new Date(lifeline.request.requestedAt).toLocaleString()}
                  </p>
                )}
                {lifelineUnlocked && lifelineRemaining > 0 && !lifelinePending && !submitResult && (
                  <motion.button whileTap={{ scale:0.97 }}
                    type="button" onClick={() => void handleLifelineRequest()}
                    disabled={lifelineBusy || isRunning || isSubmitting}
                    style={{ marginTop:"12px", ...mono, fontSize:"10px", fontWeight:700,
                      letterSpacing:"0.14em", textTransform:"uppercase",
                      padding:"10px 16px", borderRadius:"10px",
                      border:"1px solid rgba(251,146,60,0.38)", background:"rgba(251,146,60,0.12)",
                      color:lifelineBusy||isRunning||isSubmitting?"rgba(253,186,116,0.4)":"#fdba74",
                      cursor:lifelineBusy||isRunning||isSubmitting?"not-allowed":"pointer",
                      opacity:lifelineBusy||isRunning||isSubmitting?0.65:1,
                      display:"flex", alignItems:"center", gap:"7px", transition:"all 0.14s" }}
                    onMouseEnter={e=>{if(!lifelineBusy&&!isRunning&&!isSubmitting){e.currentTarget.style.background="rgba(251,146,60,0.22)";e.currentTarget.style.boxShadow="0 0 14px rgba(251,146,60,0.2)";}}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(251,146,60,0.12)";e.currentTarget.style.boxShadow="none";}}
                  >
                    {lifelineBusy
                      ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Requesting...</>
                      : "⚡ Request Lifeline"}
                  </motion.button>
                )}
              </motion.div>

              {/* Systems */}
              {(challengeMeta?.systems?.length??0) > 0 && (
                <motion.div
                  initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.14 }}
                  style={{ padding:"12px 14px", borderRadius:"10px",
                    background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.18)" }}>
                  <p style={{ ...lbl, fontSize:"8px", color:"rgba(52,211,153,0.55)", marginBottom:"8px" }}>
                    Systems Affected
                  </p>
                  <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                    {challengeMeta.systems.map((s,i)=>(
                      <motion.div key={s}
                        initial={{ opacity:0, x:-4 }} animate={{ opacity:1, x:0 }}
                        transition={{ delay:0.14+i*0.05 }}
                        style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <span style={{ width:"5px", height:"5px", borderRadius:"2px",
                          background:BUG.red, boxShadow:`0 0 4px ${hex2rgba(BUG.red,0.7)}`, flexShrink:0 }}/>
                        <span style={{ fontSize:"11.5px", color:"rgba(203,213,225,0.75)" }}>{s}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Run Console */}
              <motion.div
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.17 }}
                style={{ padding:"12px 14px", borderRadius:"10px",
                  background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                  <p style={{ ...lbl, fontSize:"8px", color:"rgba(148,163,184,0.4)" }}>Run Console</p>
                  <AnimatePresence>
                    {currentResult && (
                      <motion.span initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
                        style={{ padding:"2px 8px", borderRadius:"999px",
                          ...mono, fontSize:"8px", fontWeight:700,
                          color: currentResult.passed===currentResult.total ? BUG.green : BUG.red,
                          background: currentResult.passed===currentResult.total
                            ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                          border:`1px solid ${currentResult.passed===currentResult.total
                            ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}` }}>
                        {currentResult.passed===currentResult.total ? "✓ All Passed" : `${currentResult.passed}/${currentResult.total} Fixed`}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                  {!currentResult ? (
                    <motion.p key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      style={{ fontSize:"12px", color:"rgba(148,163,184,0.45)", margin:0 }}>
                      Run or submit to inspect your fix count.
                    </motion.p>
                  ) : (
                    <motion.div key="result" initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                      style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {[
                        { label:"Mode",   value:currentResult.mode,                             color:"#7dd3fc" },
                        { label:"Passed", value:`${currentResult.passed} / ${currentResult.total}`, color:"#f1f5f9" },
                        { label:"Score",  value:String(currentResult.score),                   color:BUG.purple },
                      ].map(({ label, value, color })=>(
                        <div key={label} style={{ display:"flex", alignItems:"center",
                          justifyContent:"space-between", padding:"5px 0",
                          borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ ...lbl, fontSize:"8px" }}>{label}</span>
                          <span style={{ ...mono, fontSize:"12px", fontWeight:700, color }}>{value}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>

          {/* ── RIGHT EDITOR PANEL ── */}
          <div style={{
            ...card, overflow:"hidden", display:"flex", flexDirection:"column",
            border:"1px solid rgba(248,113,113,0.15)", position:"relative",
          }}>
            <CorruptedCorners color="rgba(248,113,113,0.3)" size={12} />
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
              background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.4),rgba(248,113,113,0.3),transparent)" }}/>

            {/* Toolbar */}
            <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)",
              background:"rgba(248,113,113,0.03)", display:"flex",
              alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ ...lbl, fontSize:"8px" }}>Language</span>
                <span style={{ ...mono, fontSize:"11px", fontWeight:700, color:BUG.purple,
                  padding:"3px 10px", borderRadius:"999px",
                  background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.25)" }}>
                  {(selectedLanguage||"cpp").toUpperCase()}
                </span>
                {/* Bug corruption label */}
                <span style={{ ...mono, fontSize:"8px", fontWeight:700, letterSpacing:"0.1em",
                  padding:"2px 8px", borderRadius:"999px",
                  color:BUG.red, background:"rgba(248,113,113,0.08)",
                  border:"1px solid rgba(248,113,113,0.2)" }}>
                  🐛 BUGGED
                </span>
              </div>
              {/* Save indicator */}
              <AnimatePresence mode="wait">
                <motion.div key={saved?"saved":"saving"}
                  initial={{ opacity:0, x:4 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
                  style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                  <span style={{ width:"5px", height:"5px", borderRadius:"50%",
                    background:saved?BUG.green:BUG.orange,
                    boxShadow:saved?`0 0 5px ${hex2rgba(BUG.green,0.7)}`:"none" }}/>
                  <span style={{ ...lbl, fontSize:"8px",
                    color:saved?"rgba(52,211,153,0.7)":"rgba(251,146,60,0.6)" }}>
                    {saved?"Auto-saved":"Saving..."}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Monaco */}
            <div style={{ flex:1, minHeight:0, height:"430px", position:"relative" }}>
              {isChallengeLoading ? (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                  style={{ height:"100%", display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:"16px",
                    background:"#0d0f14" }}>
                  {/* Bug loading ring */}
                  <div style={{ position:"relative", width:"48px", height:"48px" }}>
                    <motion.div animate={{ rotate:360 }} transition={{ duration:1.2, repeat:Infinity, ease:"linear" }}
                      style={{ position:"absolute", inset:0, borderRadius:"50%",
                        border:"2px solid rgba(248,113,113,0.15)", borderTopColor:BUG.red }}/>
                    <motion.div animate={{ rotate:-360 }} transition={{ duration:2, repeat:Infinity, ease:"linear" }}
                      style={{ position:"absolute", inset:"6px", borderRadius:"50%",
                        border:"1px solid rgba(167,139,250,0.15)", borderTopColor:BUG.purple }}/>
                    <div style={{ position:"absolute", inset:0, display:"flex",
                      alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:"16px" }}>🐛</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                    <span style={{ ...mono, fontSize:"13px", color:"#fca5a5" }}>Injecting bugs...</span>
                    <span style={{ ...lbl, fontSize:"8px" }}>
                      Preparing your {(selectedLanguage||"").toUpperCase()} challenge
                    </span>
                  </div>
                </motion.div>
              ) : (
                <Editor
                  height="100%"
                  language={monacoLanguage}
                  theme="vs-dark"
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    minimap:{ enabled:false }, fontSize:13,
                    automaticLayout:true, scrollBeyondLastLine:false,
                    readOnly:Boolean(submitResult), contextmenu:false,
                    fontFamily:"'DM Mono','Fira Code',monospace",
                    padding:{ top:14, bottom:14 },
                    lineNumbersMinChars:3, renderLineHighlight:"gutter",
                  }}
                />
              )}
            </div>

            {/* Action bar */}
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", padding:"12px 16px",
              background:"rgba(0,0,0,0.25)", display:"flex", gap:"8px",
              flexWrap:"wrap", alignItems:"center", flexShrink:0 }}>

              {/* Change Language - LOCKED once selected */}
              <motion.button whileTap={{ scale:0.97 }} type="button"
                onClick={()=>!selectedLanguage&&navigate("/team/round3/language")}
                disabled={Boolean(selectedLanguage)||isChallengeLoading}
                style={{ ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.12em",
                  textTransform:"uppercase", padding:"10px 16px", borderRadius:"10px",
                  border:selectedLanguage?"1px solid rgba(255,255,255,0.05)":"1px solid rgba(255,255,255,0.09)",
                  background:selectedLanguage?"rgba(255,255,255,0.01)":"rgba(255,255,255,0.03)",
                  color:selectedLanguage?"rgba(203,213,225,0.3)":"rgba(203,213,225,0.7)",
                  cursor:selectedLanguage?"not-allowed":"pointer",
                  opacity:selectedLanguage?0.5:1,
                  transition:"all 0.14s" }}
                onMouseEnter={e=>{if(!selectedLanguage&&!isChallengeLoading){e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.borderColor="rgba(255,255,255,0.18)";} }}
                onMouseLeave={e=>{e.currentTarget.style.background=selectedLanguage?"rgba(255,255,255,0.01)":"rgba(255,255,255,0.03)";e.currentTarget.style.borderColor=selectedLanguage?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.09)";}}
                title={selectedLanguage?"Language is locked once selected":""}
              >{selectedLanguage?"🔒 Locked":"⟳ Language"}</motion.button>

              {/* Run Code */}
              <motion.button whileTap={{ scale:0.97 }} type="button"
                onClick={()=>void runCode()}
                disabled={isRunning||isSubmitting||isChallengeLoading}
                style={{ ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.12em",
                  textTransform:"uppercase", padding:"10px 18px", borderRadius:"10px",
                  border:`1px solid ${isRunning?"rgba(251,146,60,0.45)":"rgba(255,255,255,0.12)"}`,
                  background:isRunning?"rgba(251,146,60,0.1)":"rgba(255,255,255,0.03)",
                  color:isRunning||isSubmitting||isChallengeLoading?"rgba(203,213,225,0.4)":"rgba(226,232,240,0.85)",
                  cursor:isRunning||isSubmitting||isChallengeLoading?"not-allowed":"pointer",
                  opacity:isRunning||isSubmitting||isChallengeLoading?0.65:1,
                  transition:"all 0.14s",
                  display:"flex", alignItems:"center", gap:"7px" }}
                onMouseEnter={e=>{if(!isRunning&&!isSubmitting&&!isChallengeLoading){e.currentTarget.style.background="rgba(255,255,255,0.07)";}}}
                onMouseLeave={e=>{e.currentTarget.style.background=isRunning?"rgba(251,146,60,0.1)":"rgba(255,255,255,0.03)";}}
              >
                {isRunning
                  ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Running...</>
                  : <><span>▶</span> Run Code</>}
              </motion.button>

              {/* Submit */}
              <motion.button whileTap={{ scale:0.97 }} type="button"
                onClick={handleSubmitClick}
                disabled={isSubmitting||Boolean(submitResult)||isChallengeLoading}
                style={{ ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.14em",
                  textTransform:"uppercase", padding:"10px 20px", borderRadius:"10px",
                  border: submitResult
                    ? "1px solid rgba(52,211,153,0.35)"
                    : "1px solid rgba(248,113,113,0.45)",
                  background: submitResult
                    ? "rgba(52,211,153,0.1)"
                    : "rgba(248,113,113,0.12)",
                  color: isSubmitting||submitResult||isChallengeLoading
                    ? submitResult?"rgba(52,211,153,0.55)":"rgba(248,113,113,0.45)"
                    : "#fca5a5",
                  cursor:isSubmitting||submitResult||isChallengeLoading?"not-allowed":"pointer",
                  opacity:isSubmitting||submitResult||isChallengeLoading?0.7:1,
                  transition:"all 0.14s",
                  display:"flex", alignItems:"center", gap:"7px" }}
                onMouseEnter={e=>{if(!isSubmitting&&!submitResult&&!isChallengeLoading){e.currentTarget.style.background="rgba(248,113,113,0.22)";e.currentTarget.style.boxShadow="0 0 18px rgba(248,113,113,0.18)";}}}
                onMouseLeave={e=>{e.currentTarget.style.background=submitResult?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.12)";e.currentTarget.style.boxShadow="none";}}
              >
                {isSubmitting
                  ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Locking...</>
                  : submitResult ? "✓ Submitted" : "🔒 Submit Final"}
              </motion.button>

              <div style={{ flex:1 }}/>
              <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.4)" }}>
                {code.split("\n").length} lines
              </span>
            </div>
          </div>
        </div>

      </motion.section>
    </>
  );
}
