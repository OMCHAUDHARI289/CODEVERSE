import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  addRound1Warning,
  getRound1Status,
  submitRound1
} from "../../api/round1Api";
import { getApiErrorMessage } from "../../api/httpClient";
import { ROUND_CONFIG } from "../../data/roundConfig";

/* ─── UTILS ─── */
const formatTime = (s) => {
  const safe = Math.max(0, s);
  return `${String(Math.floor(safe / 60)).padStart(2,"0")}:${String(safe % 60).padStart(2,"0")}`;
};

/* ─── TOKENS ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#38bdf8" }) {
  return (
    <motion.div
      animate={{ top: ["0%","100%"] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
      style={{ position:"absolute", left:0, right:0, height:"1px", pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,0.2)},transparent)` }}
    />
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, sub, pulse }) {
  return (
    <div style={{ ...card, padding:"16px 20px", position:"relative", overflow:"hidden",
      border:`1px solid ${hex2rgba(accent,0.2)}` }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,0.65)},transparent)` }}/>
      <p style={lbl}>{label}</p>
      <motion.p key={value}
        initial={pulse ? { scale:1.18, color:accent } : false}
        animate={{ scale:1, color:"#f1f5f9" }}
        transition={{ duration:0.45 }}
        style={{ ...mono, fontSize:"24px", fontWeight:700, marginTop:"8px",
          letterSpacing:"-0.01em", color:"#f1f5f9" }}
      >{value}</motion.p>
      {sub && <p style={{ ...lbl, marginTop:"4px", fontSize:"8px", color:hex2rgba(accent,0.55) }}>{sub}</p>}
    </div>
  );
}

/* ─── OPTION BUTTON ─── */
function OptionBtn({ label, letter, selected, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.button type="button" whileTap={{ scale:0.98 }}
      onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:"13px",
        padding:"13px 16px", borderRadius:"11px", textAlign:"left",
        cursor:"pointer", transition:"all 0.14s", position:"relative", overflow:"hidden",
        background: selected ? "rgba(56,189,248,0.1)" : hov ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        border: selected ? "1px solid rgba(56,189,248,0.45)" : hov ? "1px solid rgba(255,255,255,0.11)" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: selected ? "0 0 14px rgba(56,189,248,0.1)" : "none",
      }}
    >
      <AnimatePresence>
        {selected && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"absolute", inset:0, pointerEvents:"none",
              background:"linear-gradient(135deg,rgba(56,189,248,0.07),transparent)" }}/>
        )}
      </AnimatePresence>
      <div style={{
        width:"28px", height:"28px", borderRadius:"8px", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        ...mono, fontSize:"11px", fontWeight:700, transition:"all 0.14s",
        background: selected ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.05)",
        border: selected ? "1px solid rgba(56,189,248,0.4)" : "1px solid rgba(255,255,255,0.08)",
        color: selected ? "#38bdf8" : "rgba(148,163,184,0.5)",
      }}>{selected ? "✓" : letter}</div>
      <span style={{ ...mono, fontSize:"13px", fontWeight:selected?600:400,
        color:selected?"#bae6fd":"rgba(226,232,240,0.75)",
        transition:"color 0.14s", position:"relative", zIndex:1, flex:1 }}>
        {label}
      </span>
    </motion.button>
  );
}

/* ─── QUESTION MAP ─── */
function QuestionMap({ questions, answers, currentIndex, onJump }) {
  const maxScore = ROUND_CONFIG.round1.maxScore;
  const total     = questions.length || 0;
  const attempted = Object.keys(answers).length;
  const pending   = total - attempted;

  return (
    <div style={{ ...card, display:"flex", flexDirection:"column", overflow:"hidden",
      position:"relative", height:"fit-content" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)" }}/>

      {/* Header */}
      <div style={{ padding:"13px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ ...lbl, color:"rgba(167,139,250,0.65)" }}>Question Map</p>
      </div>

      {/* Legend */}
      <div style={{ padding:"9px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)",
        display:"flex", gap:"12px", flexWrap:"wrap" }}>
        {[
          { color:"#38bdf8", glow:true,  label:"Current"  },
          { color:"#34d399", glow:false, label:"Answered"  },
          { color:"rgba(255,255,255,0.07)", border:"rgba(255,255,255,0.11)", label:"Pending" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"3px",
              background:l.color, border:l.border?`1px solid ${l.border}`:"none",
              boxShadow:l.glow?"0 0 6px rgba(56,189,248,0.8)":"none" }}/>
            <span style={{ ...lbl, fontSize:"7px" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding:"13px 16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"6px" }}>
          {questions.map((q, i) => {
            const isCurr = i === currentIndex;
            const isDone = answers[i + 1] !== undefined;
            return (
              <motion.button key={q._id ?? i}
                whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                onClick={() => onJump(i)}
                style={{
                  position:"relative", width:"100%", aspectRatio:"1",
                  borderRadius:"8px", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  ...mono, fontSize:"10px", fontWeight:isCurr?700:isDone?600:400,
                  border: isCurr ? "1px solid rgba(56,189,248,0.6)"
                    : isDone    ? "1px solid rgba(52,211,153,0.35)"
                    :              "1px solid rgba(255,255,255,0.09)",
                  background: isCurr ? "rgba(56,189,248,0.18)"
                    : isDone    ? "rgba(52,211,153,0.1)"
                    :              "rgba(255,255,255,0.03)",
                  color: isCurr ? "#38bdf8" : isDone ? "#34d399" : "rgba(148,163,184,0.38)",
                  boxShadow: isCurr ? "0 0 10px rgba(56,189,248,0.3)" : "none",
                  transition:"all 0.14s",
                }}
              >
                {isCurr && (
                  <motion.div animate={{ opacity:[0.5,0,0.5], scale:[1,1.4,1] }}
                    transition={{ duration:1.8, repeat:Infinity }}
                    style={{ position:"absolute", inset:"-3px", borderRadius:"10px",
                      border:"1px solid rgba(56,189,248,0.4)", pointerEvents:"none" }}/>
                )}
                {isDone && !isCurr ? "✓" : i + 1}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"12px 16px",
        display:"flex", flexDirection:"column", gap:"8px", background:"rgba(0,0,0,0.2)" }}>
        {[
          { label:"Answered", count:attempted, total, accent:"#34d399", grad:"#34d399,#38bdf8" },
          { label:"Pending",  count:pending,   total, accent:"#fb923c", grad:"#fb923c,#f472b6" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
              <span style={{ ...lbl, fontSize:"8px", color:hex2rgba(s.accent,0.6) }}>{s.label}</span>
              <span style={{ ...mono, fontSize:"10px", fontWeight:700, color:s.accent }}>{s.count}</span>
            </div>
            <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"999px", overflow:"hidden" }}>
              <motion.div animate={{ width:`${total?((s.count/total)*100):0}%` }}
                transition={{ duration:0.4 }}
                style={{ height:"100%", background:`linear-gradient(90deg,${s.grad})`, borderRadius:"999px" }}/>
            </div>
          </div>
        ))}
        <div style={{ marginTop:"4px", padding:"8px 10px", borderRadius:"8px",
          background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.18)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ ...lbl, fontSize:"8px", color:"rgba(167,139,250,0.6)" }}>Est. Score</span>
          <span style={{ ...mono, fontSize:"13px", fontWeight:700, color:"#a78bfa" }}>
            {total ? Math.round((attempted / total) * maxScore) : 0}
            {" / "}{maxScore}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── ANTI-CHEAT TOAST ─── */
function AntiCheatToast({ warningCount, maxWarnings }) {
  return (
    <motion.div
      key={warningCount}
      initial={{ opacity:0, y:-20, scale:0.95 }}
      animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:-20 }}
      style={{
        position:"fixed", top:"16px", left:"50%", transform:"translateX(-50%)",
        zIndex:200, padding:"10px 20px", borderRadius:"10px",
        background:"rgba(15,10,8,0.97)", border:"1px solid rgba(248,113,113,0.45)",
        boxShadow:"0 0 24px rgba(248,113,113,0.18)",
        display:"flex", alignItems:"center", gap:"10px", ...mono,
        whiteSpace:"nowrap",
      }}
    >
      <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.9, repeat:3 }}
        style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#f87171",
          boxShadow:"0 0 8px rgba(248,113,113,0.9)", flexShrink:0 }}/>
      <span style={{ fontSize:"10px", letterSpacing:"0.16em", textTransform:"uppercase", color:"#fca5a5" }}>
        Tab switch detected · Warning {warningCount}/{maxWarnings}
      </span>
    </motion.div>
  );
}

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ ...card, padding:"16px 20px" }}>
            <motion.div animate={{ opacity:[0.2,0.45,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.1 }}
              style={{ height:"8px", borderRadius:"4px", background:"rgba(255,255,255,0.08)", width:"50%", marginBottom:"12px" }}/>
            <motion.div animate={{ opacity:[0.2,0.45,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.1+0.1 }}
              style={{ height:"24px", borderRadius:"6px", background:"rgba(255,255,255,0.06)", width:"70%" }}/>
          </div>
        ))}
      </div>
      <div style={{ ...card, padding:"26px 28px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[60,85,50,75,65].map((w,i) => (
            <motion.div key={i} animate={{ opacity:[0.2,0.4,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.12 }}
              style={{ height:"11px", borderRadius:"5px", background:"rgba(255,255,255,0.07)", width:`${w}%` }}/>
          ))}
        </div>
        <div style={{ ...lbl, marginTop:"24px", display:"flex", alignItems:"center", gap:"8px",
          color:"rgba(56,189,248,0.5)" }}>
          <motion.span animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>◌</motion.span>
          Loading arena...
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function Round1ArenaPage() {
  const navigate = useNavigate();
  const config   = ROUND_CONFIG.round1;

  /* ── State ── */
  const [loading,           setLoading]           = useState(true);
  const [submitting,        setSubmitting]         = useState(false);
  const [error,             setError]             = useState("");
  const [questions,         setQuestions]         = useState([]);
  const [currentIndex,      setCurrentIndex]      = useState(0);
  const [answers,           setAnswers]           = useState({});
  const [remainingSeconds,  setRemainingSeconds]  = useState(config.durationSeconds);
  const [warningCount,      setWarningCount]      = useState(0);
  const [showWarning,       setShowWarning]       = useState(false);
  const [warnKey,           setWarnKey]           = useState(0);

  const currentQuestion = questions[currentIndex] ?? null;
  const answeredCount   = Object.keys(answers).length;
  const total           = questions.length;
  const lowTimeSeconds = config.lowTimeSeconds ?? Math.floor(config.durationSeconds / 6);
  const warningTimeSeconds = config.warningTimeSeconds ?? Math.floor(config.durationSeconds / 3);
  const isLow           = remainingSeconds < lowTimeSeconds;
  const timerAccent     = isLow ? "#f87171" : remainingSeconds < warningTimeSeconds ? "#fb923c" : "#38bdf8";

  /* ── Load status ── */
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getRound1Status();
      if (status.submitted) {
        navigate(config.routes.result, { replace:true, state: status.result || {} });
        return;
      }
      if (!status.started) {
        navigate(config.routes.terms, { replace:true });
        return;
      }
      setQuestions(status.questions || []);
      setRemainingSeconds(Number.isFinite(status.remainingSeconds) ? status.remainingSeconds : config.durationSeconds);
      setWarningCount(status.warningCount || 0);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load Round 1."));
    } finally {
      setLoading(false);
    }
  }, [config.durationSeconds, config.routes.result, config.routes.terms, navigate]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  /* ── Timer ── */
  useEffect(() => {
    if (loading || submitting) return;
    const id = setInterval(() => {
      setRemainingSeconds(p => {
        if (p <= 1) { clearInterval(id); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loading, submitting]);

  /* ── Auto-submit on timer end ── */
  useEffect(() => {
    if (loading || submitting || remainingSeconds > 0) return;
    void handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, loading, submitting]);

  /* ── Anti-cheat blur ── */
  useEffect(() => {
    if (loading || submitting) return;
    const handleBlur = async () => {
      try {
        const data = await addRound1Warning({ reason:"tab_switch" });
        const next  = data.warningCount || 0;
        setWarningCount(next);
        setWarnKey(k => k + 1);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3500);
        if (data.shouldAutoSubmit) void handleSubmit(true);
      } catch (err) {
        setError(getApiErrorMessage(err, "Unable to sync warning status."));
      }
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, submitting]);

  /* ── Handlers ── */
  const setAnswer = (optionIndex) => {
    setAnswers(prev => ({ ...prev, [currentIndex + 1]: optionIndex }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (submitting || !questions.length) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = Array.from({ length: questions.length }, (_, i) => answers[i+1] ?? null);
      const result  = await submitRound1({ answers: payload, autoSubmit });
      navigate(config.routes.result, {
        replace: true,
        state: { score: result.score, correctCount: result.correct, totalQuestions: result.totalQuestions },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Submission failed."));
      setSubmitting(false);
    }
  };

  const progress = useMemo(() =>
    total ? Math.round((answeredCount / total) * 100) : 0,
  [answeredCount, total]);

  /* ── Render: loading ── */
  if (loading) return <Skeleton />;

  /* ── Render: main ── */
  return (
    <>
      {/* Anti-cheat toast */}
      <AnimatePresence>
        {showWarning && (
          <AntiCheatToast key={warnKey} warningCount={warningCount} maxWarnings={config.maxWarnings} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.3 }}
        style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
      >
        {/* ── STAT TILES ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
          <StatTile label="Timer"    accent={timerAccent} pulse={isLow}
            value={formatTime(remainingSeconds)}
            sub={isLow ? "⚠ Low time" : "Remaining"} />
          <StatTile label="Answered" accent="#34d399"
            value={`${answeredCount}/${total}`}
            sub={`${progress}% done`} />
          <StatTile label="Progress" accent="#a78bfa"
            value={`${progress}%`}
            sub={`${total - answeredCount} remaining`} />
          <StatTile
            label="Warnings"
            accent={warningCount >= config.maxWarnings ? "#f87171" : warningCount > 0 ? "#fb923c" : "#34d399"}
            pulse={warningCount > 0}
            value={`${warningCount}/${config.maxWarnings}`}
            sub={warningCount === 0 ? "No violations" : `${config.maxWarnings - warningCount} left`} />
        </div>

        {/* ── ERROR BANNER ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ padding:"10px 16px", borderRadius:"10px",
                background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.3)",
                display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ color:"#f87171", fontSize:"12px", flexShrink:0 }}>⚠</span>
              <span style={{ fontSize:"12px", color:"#fca5a5", flex:1 }}>{error}</span>
              <button onClick={()=>setError("")} style={{ background:"none", border:"none",
                color:"rgba(148,163,184,0.5)", cursor:"pointer", fontSize:"14px", padding:0 }}>✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── QUESTION GRID ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 220px", gap:"12px", alignItems:"start" }}>

          {/* Left: question + nav */}
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>

            {/* Question card */}
            <div style={{ ...card, padding:"24px 26px", position:"relative", overflow:"hidden" }}>
              <ScanLine />
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
                background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.45),transparent)" }}/>

              {/* Header row */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div style={{ padding:"5px 12px", borderRadius:"999px",
                    background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.25)",
                    ...mono, fontSize:"11px", fontWeight:700, color:"#38bdf8" }}>
                    Q{String(currentIndex+1).padStart(2,"0")}
                  </div>
                  <span style={{ ...lbl, fontSize:"8px" }}>of {total} questions</span>
                </div>

                {/* Progress bar */}
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <span style={{ ...lbl, fontSize:"8px", color:"rgba(52,211,153,0.6)" }}>
                    {answeredCount} answered
                  </span>
                  <div style={{ width:"100px", height:"4px", background:"rgba(255,255,255,0.06)",
                    borderRadius:"999px", overflow:"hidden" }}>
                    <motion.div animate={{ width:`${progress}%` }} transition={{ duration:0.4 }}
                      style={{ height:"100%", borderRadius:"999px",
                        background:"linear-gradient(90deg,#38bdf8,#34d399)" }}/>
                  </div>
                  <span style={{ ...mono, fontSize:"10px", color:"rgba(56,189,248,0.65)" }}>
                    {progress}%
                  </span>
                </div>
              </div>

              {/* Question body */}
              <AnimatePresence mode="wait">
                <motion.div key={currentIndex}
                  initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-10 }}
                  transition={{ duration:0.22 }}
                  style={{ marginTop:"20px" }}
                >
                  <div style={{ padding:"20px 22px", borderRadius:"12px",
                    background:"rgba(56,189,248,0.04)", border:"1px solid rgba(56,189,248,0.14)" }}>
                    <p style={{ fontSize:"14px", lineHeight:1.8, color:"rgba(226,232,240,0.9)",
                      fontFamily:"'Inter',sans-serif" }}>
                      {currentQuestion?.question}
                    </p>
                  </div>

                  {/* Code snippet */}
                  {currentQuestion?.codeSnippet && (
                    <pre style={{
                      ...mono, fontSize:"12px", lineHeight:1.75,
                      color:"rgba(52,211,153,0.8)",
                      background:"rgba(0,0,0,0.45)", border:"1px solid rgba(255,255,255,0.07)",
                      borderRadius:"10px", padding:"14px 16px",
                      overflowX:"auto", marginTop:"12px",
                    }}>
                      {currentQuestion.codeSnippet}
                    </pre>
                  )}

                  {/* Options */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
                    gap:"10px", marginTop:"18px" }}>
                    {(currentQuestion?.options ?? []).map((opt, i) => (
                      <OptionBtn
                        key={`${currentQuestion?._id}-${i}`}
                        label={opt}
                        letter={String.fromCharCode(65 + i)}
                        selected={answers[currentIndex + 1] === i}
                        onClick={() => setAnswer(i)}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Nav bar */}
            <div style={{ ...card, padding:"12px 18px", display:"flex",
              alignItems:"center", justifyContent:"space-between", gap:"12px" }}>

              {/* Prev */}
              <motion.button type="button" whileTap={{ scale:0.97 }}
                onClick={() => setCurrentIndex(p => Math.max(0, p-1))}
                disabled={currentIndex === 0}
                style={{
                  padding:"9px 18px", borderRadius:"9px", ...mono,
                  fontSize:"11px", fontWeight:600,
                  letterSpacing:"0.12em", textTransform:"uppercase",
                  cursor:currentIndex===0?"not-allowed":"pointer",
                  border:"1px solid rgba(255,255,255,0.08)", background:"transparent",
                  color:currentIndex===0?"rgba(255,255,255,0.2)":"rgba(148,163,184,0.65)",
                  transition:"all 0.15s",
                }}
                onMouseEnter={e=>{if(currentIndex>0){e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="#e2e8f0";}}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=currentIndex===0?"rgba(255,255,255,0.2)":"rgba(148,163,184,0.65)";}}
              >← Prev</motion.button>

              <span style={{ ...lbl, fontSize:"8px" }}>{currentIndex+1} / {total}</span>

              {/* Next or Submit */}
              {currentIndex < total - 1 ? (
                <motion.button type="button" whileTap={{ scale:0.97 }}
                  onClick={() => setCurrentIndex(p => Math.min(total-1, p+1))}
                  style={{
                    padding:"9px 22px", borderRadius:"9px", ...mono,
                    fontSize:"11px", fontWeight:700,
                    letterSpacing:"0.16em", textTransform:"uppercase",
                    cursor:"pointer",
                    border:"1px solid rgba(56,189,248,0.35)",
                    background:"rgba(56,189,248,0.12)", color:"#7dd3fc",
                    transition:"all 0.15s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(56,189,248,0.2)";e.currentTarget.style.boxShadow="0 0 14px rgba(56,189,248,0.15)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(56,189,248,0.12)";e.currentTarget.style.boxShadow="none";}}
                >Next →</motion.button>
              ) : (
                <motion.button type="button" whileTap={{ scale:0.97 }}
                  onClick={() => void handleSubmit(false)}
                  disabled={submitting}
                  style={{
                    padding:"9px 22px", borderRadius:"9px", ...mono,
                    fontSize:"11px", fontWeight:700,
                    letterSpacing:"0.16em", textTransform:"uppercase",
                    cursor:submitting?"not-allowed":"pointer",
                    border:"1px solid rgba(52,211,153,0.35)",
                    background:"rgba(52,211,153,0.12)", color:"#6ee7b7",
                    transition:"all 0.15s",
                    display:"flex", alignItems:"center", gap:"7px",
                  }}
                  onMouseEnter={e=>{if(!submitting){e.currentTarget.style.background="rgba(52,211,153,0.22)";e.currentTarget.style.boxShadow="0 0 16px rgba(52,211,153,0.15)";}}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(52,211,153,0.12)";e.currentTarget.style.boxShadow="none";}}
                >
                  {submitting
                    ? <><motion.span animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}>◌</motion.span> Submitting...</>
                    : "Submit →"}
                </motion.button>
              )}
            </div>
          </div>

          {/* Right: Question map */}
          <QuestionMap
            questions={questions}
            answers={answers}
            currentIndex={currentIndex}
            onJump={setCurrentIndex}
          />
        </div>
      </motion.div>
    </>
  );
}
