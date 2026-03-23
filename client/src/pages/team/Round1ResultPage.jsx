import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getRound1Status } from "../../api/round1Api";
import { getApiErrorMessage } from "../../api/httpClient";
import { ROUND_CONFIG } from "../../data/roundConfig";

/* ─── TOKENS ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

/* ─── ANIMATED COUNTER ─── */
function Counter({ target, duration = 1.4, style }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const pct = Math.min((ts - start) / (duration * 1000), 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - pct, 3);
      setVal(Math.round(ease * target));
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <span style={style}>{val}</span>;
}

/* ─── RADIAL SCORE RING ─── */
function ScoreRing({ score, max, accent, size = 110 }) {
  const r        = (size - 14) / 2;
  const circ     = 2 * Math.PI * r;
  const pct      = max ? Math.min(score / max, 1) : 0;
  const dashArr  = circ;
  const dashOff  = circ * (1 - pct);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
        {/* Progress */}
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={accent} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={dashArr}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: dashOff }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          style={{ filter:`drop-shadow(0 0 6px ${hex2rgba(accent,0.7)})` }}
        />
      </svg>
      {/* Center label */}
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        <span style={{ ...mono, fontSize:"22px", fontWeight:700, color:"#f1f5f9",
          lineHeight:1, letterSpacing:"-0.02em" }}>
          <Counter target={score} />
        </span>
        <span style={{ ...lbl, fontSize:"7px", marginTop:"3px", color:hex2rgba(accent,0.6) }}>pts</span>
      </div>
    </div>
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.35 }}
      style={{ ...card, padding:"18px 20px", position:"relative", overflow:"hidden",
        border:`1px solid ${hex2rgba(accent,0.2)}` }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,0.65)},transparent)` }}/>
      <p style={lbl}>{label}</p>
      <p style={{ ...mono, fontSize:"26px", fontWeight:700, marginTop:"8px",
        letterSpacing:"-0.01em", color:accent }}>
        <Counter target={typeof value === "number" ? value : 0} />
        {typeof value !== "number" && value}
      </p>
      {sub && <p style={{ ...lbl, marginTop:"5px", fontSize:"8px", color:hex2rgba(accent,0.55) }}>{sub}</p>}
    </motion.div>
  );
}

/* ─── ACCURACY BAR ─── */
function AccuracyBar({ correct, total, accent }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const grade =
    pct >= 90 ? { label:"Excellent", color:"#34d399" } :
    pct >= 70 ? { label:"Good",      color:"#38bdf8"  } :
    pct >= 50 ? { label:"Average",   color:"#fb923c"  } :
                { label:"Needs Work",color:"#f87171"  };
  return (
    <div style={{ ...card, padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
        <p style={{ ...lbl, color:hex2rgba(accent,0.65) }}>Accuracy</p>
        <span style={{ padding:"3px 10px", borderRadius:"999px",
          ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.14em",
          color:grade.color, background:hex2rgba(grade.color,0.1),
          border:`1px solid ${hex2rgba(grade.color,0.28)}` }}>
          {grade.label}
        </span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <div style={{ flex:1, height:"6px", background:"rgba(255,255,255,0.06)",
          borderRadius:"999px", overflow:"hidden" }}>
          <motion.div
            initial={{ width:0 }} animate={{ width:`${pct}%` }}
            transition={{ duration:1.4, ease:"easeOut", delay:0.4 }}
            style={{ height:"100%", borderRadius:"999px",
              background:`linear-gradient(90deg,${accent},${grade.color})`,
              boxShadow:`0 0 8px ${hex2rgba(grade.color,0.5)}` }}
          />
        </div>
        <span style={{ ...mono, fontSize:"16px", fontWeight:700, color:grade.color, minWidth:"44px", textAlign:"right" }}>
          <Counter target={pct} duration={1.4} /><span style={{ fontSize:"11px" }}>%</span>
        </span>
      </div>
      <p style={{ ...lbl, fontSize:"8px", marginTop:"8px", color:"rgba(100,116,139,0.5)" }}>
        {correct} correct out of {total} questions
      </p>
    </div>
  );
}

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono }}>
      <div style={{ ...card, padding:"28px 26px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[40,65,50].map((w,i) => (
            <motion.div key={i} animate={{ opacity:[0.2,0.45,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.12 }}
              style={{ height:"11px", borderRadius:"5px", background:"rgba(255,255,255,0.07)", width:`${w}%` }}/>
          ))}
        </div>
        <div style={{ ...lbl, marginTop:"22px", display:"flex", alignItems:"center", gap:"8px",
          color:"rgba(52,211,153,0.5)" }}>
          <motion.span animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>◌</motion.span>
          Loading result...
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function Round1ResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const config   = ROUND_CONFIG.round1;

  const [loading, setLoading] = useState(!location.state);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(() =>
    location.state ? {
      score:          location.state.score          || 0,
      correctCount:   location.state.correctCount   || location.state.correct || 0,
      totalQuestions: location.state.totalQuestions || config.fallbackQuestions,
    } : null
  );

  useEffect(() => {
    if (result) return;
    const load = async () => {
      setLoading(true);
      try {
        const status = await getRound1Status();
        if (!status.submitted) {
          navigate(status.started ? config.routes.arena : config.routes.terms, { replace:true });
          return;
        }
        setResult({
          score:          status.result?.score          || 0,
          correctCount:   status.result?.correctCount   || 0,
          totalQuestions: status.totalQuestions         || config.fallbackQuestions,
        });
      } catch (err) {
        setError(getApiErrorMessage(err, "Unable to load round result."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [config.fallbackQuestions, config.routes.arena, config.routes.terms, navigate, result]);

  const maxScore  = config.maxScore;
  const accuracy  = result?.totalQuestions
    ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0;
  const isPerfect = accuracy === 100;
  const isPassing = accuracy >= 50;

  /* ── Loading ── */
  if (loading) return <Skeleton />;

  /* ── Error ── */
  if (error) return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      style={{ ...card, padding:"24px 26px", border:"1px solid rgba(248,113,113,0.3)",
        display:"flex", flexDirection:"column", gap:"12px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ color:"#f87171", fontSize:"14px" }}>⚠</span>
        <p style={{ fontSize:"13px", color:"#fca5a5", ...mono }}>{error}</p>
      </div>
      <button onClick={() => window.location.reload()} style={{
        ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase",
        padding:"8px 18px", borderRadius:"9px", cursor:"pointer",
        border:"1px solid rgba(248,113,113,0.3)", background:"rgba(248,113,113,0.08)",
        color:"#f87171", width:"fit-content", transition:"all 0.15s",
      }}>Retry</button>
    </motion.div>
  );

  /* ── Result ── */
  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.35 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >
      {/* ── HERO CARD ── */}
      <div style={{ ...card, padding:"28px 30px", position:"relative", overflow:"hidden" }}>
        {/* Top accent */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:`linear-gradient(90deg,transparent,${isPassing?"rgba(52,211,153,0.6)":"rgba(251,146,60,0.6)"},transparent)` }}/>
        {/* Left glow bar */}
        <motion.div
          animate={{ height:["30%","70%","30%"] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
            width:"3px", borderRadius:"0 3px 3px 0",
            background:`linear-gradient(to bottom,transparent,${isPassing?"#34d399":"#fb923c"},transparent)` }}
        />
        {/* Ambient glow */}
        <motion.div
          animate={{ opacity:[0.2,0.4,0.2] }} transition={{ duration:3.5, repeat:Infinity }}
          style={{ position:"absolute", top:"-60px", right:"-60px",
            width:"220px", height:"220px", borderRadius:"50%", pointerEvents:"none",
            background: isPassing ? "rgba(52,211,153,0.09)" : "rgba(251,146,60,0.08)",
            filter:"blur(60px)" }}
        />

        <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center",
          gap:"28px", flexWrap:"wrap" }}>
          {/* Score ring */}
          <ScoreRing score={result?.score ?? 0} max={maxScore}
            accent={isPassing ? "#34d399" : "#fb923c"} />

          {/* Text */}
          <div style={{ flex:1, minWidth:"200px" }}>
            <p style={{ ...lbl, color:isPassing?"rgba(52,211,153,0.65)":"rgba(251,146,60,0.65)" }}>
              Round 1 · Submission Complete
            </p>
            <h2 style={{ fontSize:"22px", fontWeight:700, color:"#f1f5f9",
              marginTop:"6px", letterSpacing:"-0.01em" }}>
              {isPerfect ? "Perfect Score! 🎯" : isPassing ? "Round Complete ✓" : "Submitted"}
            </h2>
            <p style={{ fontSize:"12.5px", lineHeight:1.75, color:"rgba(203,213,225,0.55)",
              marginTop:"7px", fontFamily:"'Inter',sans-serif" }}>
              {isPerfect
                ? "Outstanding. You answered every question correctly."
                : isPassing
                  ? "You've cleared Round 1. Proceed to Round 2 when ready."
                  : "Your answers have been recorded. Review and proceed."}
            </p>

            {/* Status chips */}
            <div style={{ display:"flex", gap:"8px", marginTop:"14px", flexWrap:"wrap" }}>
              <span style={{ padding:"4px 12px", borderRadius:"999px",
                ...lbl, fontSize:"8px",
                color: isPassing?"#34d399":"#fb923c",
                background: isPassing?"rgba(52,211,153,0.08)":"rgba(251,146,60,0.08)",
                border:`1px solid ${isPassing?"rgba(52,211,153,0.25)":"rgba(251,146,60,0.25)"}` }}>
                {isPassing ? "✓ Passed" : "○ Submitted"}
              </span>
              <span style={{ padding:"4px 12px", borderRadius:"999px",
                ...lbl, fontSize:"8px",
                color:"#a78bfa", background:"rgba(167,139,250,0.08)",
                border:"1px solid rgba(167,139,250,0.25)" }}>
                {accuracy}% accuracy
              </span>
              <span style={{ padding:"4px 12px", borderRadius:"999px",
                ...lbl, fontSize:"8px",
                color:"rgba(148,163,184,0.5)", background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.08)" }}>
                {result?.score ?? 0} / {maxScore} pts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STAT TILES ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px" }}>
        <StatTile label="Score"     value={result?.score ?? 0}
          accent="#34d399" sub={`out of ${maxScore}`}   delay={0.1} />
        <StatTile label="Correct"   value={result?.correctCount ?? 0}
          accent="#38bdf8" sub={`of ${result?.totalQuestions} questions`} delay={0.18} />
        <StatTile label="Questions" value={result?.totalQuestions ?? 0}
          accent="#a78bfa" sub="total attempted"         delay={0.26} />
      </div>

      {/* ── ACCURACY BAR ── */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.32 }}>
        <AccuracyBar
          correct={result?.correctCount ?? 0}
          total={result?.totalQuestions ?? 0}
          accent="#38bdf8"
        />
      </motion.div>

      {/* ── ACTION BUTTONS ── */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
        transition={{ delay:0.4 }}
        style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}
      >
        {/* Go to Round 2 */}
        <motion.button type="button" whileTap={{ scale:0.97 }}
          onClick={() => navigate(config.routes.nextRound)}
          style={{
            padding:"11px 26px", borderRadius:"10px", cursor:"pointer",
            ...mono, fontSize:"11px", fontWeight:700,
            letterSpacing:"0.16em", textTransform:"uppercase",
            border:"1px solid rgba(52,211,153,0.38)",
            background:"rgba(52,211,153,0.12)", color:"#6ee7b7",
            transition:"all 0.15s",
            display:"flex", alignItems:"center", gap:"8px",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(52,211,153,0.22)";e.currentTarget.style.boxShadow="0 0 18px rgba(52,211,153,0.18)";}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(52,211,153,0.12)";e.currentTarget.style.boxShadow="none";}}
        >
          Go to Round 2
          <motion.span animate={{ x:[0,4,0] }} transition={{ duration:1.2, repeat:Infinity }}>→</motion.span>
        </motion.button>

        {/* Back to Dashboard */}
        <motion.button type="button" whileTap={{ scale:0.97 }}
          onClick={() => navigate("/team")}
          style={{
            padding:"11px 22px", borderRadius:"10px", cursor:"pointer",
            ...mono, fontSize:"11px", fontWeight:600,
            letterSpacing:"0.14em", textTransform:"uppercase",
            border:"1px solid rgba(255,255,255,0.08)",
            background:"transparent", color:"rgba(148,163,184,0.65)",
            transition:"all 0.15s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.borderColor="rgba(255,255,255,0.15)";e.currentTarget.style.color="#e2e8f0";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(148,163,184,0.65)";}}
        >← Dashboard</motion.button>
      </motion.div>
    </motion.div>
  );
}
