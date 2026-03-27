import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/httpClient";
import { getMyLifelineStatus, requestLifeline } from "../../api/lifelineApi";
import {
  getRound2Result,
  runRound2SubA,
  runRound2SubB,
  startRound2SubA,
  startRound2SubB,
  submitRound2SubA,
  submitRound2SubB,
} from "../../api/round2Api";
import { ROUND_CONFIG } from "../../data/roundConfig";

/* ─── CONSTANTS ─── */
const SUBS = [
  { key: "subA", label: "Sub A" },
  { key: "subB", label: "Sub B" },
];

const LANGUAGE_META = {
  cpp:  { label: "C++",  monaco: "cpp"  },
  java: { label: "Java", monaco: "java" },
};

const DEFAULT_SELECT = {
  subA: { difficulty: "easy", language: "cpp" },
  subB: { difficulty: "easy", language: "cpp" },
};

const EMPTY_CONSOLE_DATA = { subA: null, subB: null };
const LIFELINE_UNLOCK_DELAY_SECONDS = 15 * 60;
const LIFELINE_STATUS_POLL_MS = 15000;
const VISIBLE_TEST_CASES_REQUIRED = 3;

const getSubMeta = (status, subKey) => {
  const sub = status?.[subKey];

  if (!sub) {
    return {
      isStarted: false, isSubmitted: false, passed: false,
      score: 0, difficulty: null, language: null,
    };
  }

  return {
    ...sub,
    passed:
      Number(sub.visiblePassed) >= VISIBLE_TEST_CASES_REQUIRED ||
      Boolean(sub.passed),
  };
};

const isOutputSuccess = (c) =>
  Boolean(c?.mode === "run" && c?.passed) ||
  Boolean(c?.mode === "submit" && c?.passed);

/* ─── DESIGN TOKENS ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (h, a) => {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};
const DIFF_ACCENT = { easy: "#34d399", medium: "#fb923c", hard: "#f87171" };

const formatCountdown = (seconds) => {
  const s = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
};

/* ─── DIFFICULTY CONFIG ─── */
const DIFFICULTY_META = {
  easy: {
    label: "Easy", badge: "Introductory",
    desc: "Fundamental algorithms, basic data structures. Ideal for warm-up.",
    accent: "#34d399", badgeBg: "rgba(52,211,153,0.12)", badgeBorder: "rgba(52,211,153,0.3)",
  },
  medium: {
    label: "Medium", badge: "Intermediate",
    desc: "Requires pattern recognition, moderate optimization thinking.",
    accent: "#fb923c", badgeBg: "rgba(251,146,60,0.12)", badgeBorder: "rgba(251,146,60,0.3)",
  },
  hard: {
    label: "Hard", badge: "Advanced",
    desc: "Complex graph, DP, or systems problems. High risk, high reward.",
    accent: "#f87171", badgeBg: "rgba(248,113,113,0.12)", badgeBorder: "rgba(248,113,113,0.3)",
  },
};

/* ─── LANGUAGE CONFIG ─── */
const LANGUAGE_DETAIL = {
  cpp: {
    label: "C++", shortLabel: "C++",
    desc: "Low-level control, fastest runtime",
    tags: ["STL", "Pointers", "Fast I/O"],
    accent: "#a78bfa", tagBg: "rgba(167,139,250,0.1)", tagBorder: "rgba(167,139,250,0.25)",
  },
  java: {
    label: "Java", shortLabel: "Java",
    desc: "Verbose but structured, rich stdlib",
    tags: ["Collections", "OOP", "Scanner"],
    accent: "#fb923c", tagBg: "rgba(251,146,60,0.1)", tagBorder: "rgba(251,146,60,0.25)",
  },
};

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#a78bfa" }) {
  return (
    <motion.div
      animate={{ top: ["0%","100%"] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
      style={{
        position:"absolute", left:0, right:0, height:"1px",
        pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,.2)},transparent)`,
      }}
    />
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, sub, pulse }) {
  return (
    <div style={{ ...card, padding:"16px 20px", position:"relative", overflow:"hidden",
      border:`1px solid ${hex2rgba(accent, 0.2)}` }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent, 0.65)},transparent)` }}/>
      <p style={lbl}>{label}</p>
      <motion.p key={value}
        initial={pulse ? { scale:1.18, color:accent } : false}
        animate={{ scale:1, color:"#f1f5f9" }}
        transition={{ duration:0.45 }}
        style={{ ...mono, fontSize:"24px", fontWeight:700, marginTop:"8px",
          letterSpacing:"-0.01em", color:"#f1f5f9" }}
      >{value}</motion.p>
      {sub && <p style={{ ...lbl, marginTop:"4px", fontSize:"8px", color:hex2rgba(accent, 0.55) }}>{sub}</p>}
    </div>
  );
}

/* ─── SKELETON ─── */
function LoadingSkeleton() {
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
          color:"rgba(167,139,250,0.5)" }}>
          <motion.span animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>◌</motion.span>
          Loading Round 2...
        </div>
      </div>
    </div>
  );
}

/* ─── ACTION BUTTON ─── */
function ActionBtn({ accent="#38bdf8", onClick, disabled, children }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled}
      whileHover={!disabled ? { y:-1 } : {}} whileTap={!disabled ? { scale:0.97 } : {}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.14em",
        textTransform:"uppercase", padding:"10px 20px", borderRadius:"10px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.42 : 1,
        border:`1px solid ${hex2rgba(accent, hov&&!disabled ? .55 : .35)}`,
        background: hov&&!disabled ? hex2rgba(accent,.16) : hex2rgba(accent,.09),
        color: accent, transition:"all 0.15s",
        boxShadow: hov&&!disabled ? `0 0 18px ${hex2rgba(accent,.22)}` : "none",
        display:"flex", alignItems:"center", gap:"7px",
      }}>
      {children}
    </motion.button>
  );
}

/* ─── CONSOLE RESULT ROW ─── */
function ConsoleRow({ item }) {
  return (
    <motion.div
      initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
      style={{
        borderRadius:"9px", padding:"10px 13px",
        border: item.passed ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(248,113,113,0.25)",
        background: item.passed ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)",
        position:"relative", overflow:"hidden",
      }}>
      <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%", width:"3px",
        borderRadius:"0 3px 3px 0",
        background: item.passed ? "#34d399" : "#f87171",
        boxShadow: item.passed ? "0 0 6px rgba(52,211,153,0.7)" : "0 0 6px rgba(248,113,113,0.7)",
      }}/>
      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
        <span style={{ ...mono, fontSize:"11px", fontWeight:700,
          color: item.passed ? "#34d399" : "#f87171" }}>
          {item.passed ? "✓" : "✗"} Case {item.caseNo}
        </span>
        <span style={{ ...lbl, fontSize:"8px",
          color: item.passed ? "rgba(52,211,153,0.55)" : "rgba(248,113,113,0.55)" }}>
          {item.status}
        </span>
      </div>
      {!item.passed && item.error && (
        <pre style={{ marginTop:"7px", fontSize:"10px", whiteSpace:"pre-wrap",
          color:"rgba(252,165,165,0.8)", lineHeight:1.55 }}>{item.error}</pre>
      )}
    </motion.div>
  );
}

/* ─── CONFIGURE PANEL ─── */
function ConfigurePanel({ activeSub, selection, difficultyOptions, allowedLanguages, onSelect, onStart, busy, timeExpired, subBLocked }) {
  const [hovDiff, setHovDiff] = useState(null);
  const [hovLang, setHovLang] = useState(null);

  const selectedDiff = selection[activeSub].difficulty;
  const selectedLang = selection[activeSub].language;

  return (
    <motion.div
      key={`configure-${activeSub}`}
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
      style={{ display:"flex", flexDirection:"column", gap:"12px" }}
    >

      {/* ── DIFFICULTY CARD ── */}
      <div style={{ ...card, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <ScanLine color="#38bdf8" />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(56,189,248,.4),transparent)" }}/>

        <p style={{ ...lbl, color:"rgba(56,189,248,.65)", marginBottom:"14px" }}>Difficulty</p>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:"10px" }}>
          {difficultyOptions.map(item => {
            const meta   = DIFFICULTY_META[item.key] || {};
            const active = selectedDiff === item.key;
            const hov    = hovDiff === item.key;

            return (
              <motion.div
                key={item.key}
                whileTap={{ scale:0.98 }}
                onMouseEnter={() => setHovDiff(item.key)}
                onMouseLeave={() => setHovDiff(null)}
                onClick={() => onSelect("difficulty", item.key)}
                style={{
                  borderRadius:"12px", padding:"16px 18px",
                  cursor:"pointer", transition:"all 0.16s",
                  position:"relative", overflow:"hidden",
                  border: active
                    ? `1px solid ${hex2rgba(meta.accent,.55)}`
                    : hov ? `1px solid ${hex2rgba(meta.accent,.28)}` : "1px solid rgba(255,255,255,.07)",
                  background: active
                    ? hex2rgba(meta.accent,.08)
                    : hov ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.02)",
                  boxShadow: active ? `0 0 20px ${hex2rgba(meta.accent,.12)}` : "none",
                }}
              >
                {active && (
                  <motion.div
                    animate={{ opacity:[0.3,0.6,0.3] }} transition={{ duration:2.5, repeat:Infinity }}
                    style={{ position:"absolute", inset:0, pointerEvents:"none",
                      background:`radial-gradient(ellipse at 50% 0%,${hex2rgba(meta.accent,.1)},transparent 70%)` }}
                  />
                )}

                {/* Name + badge */}
                <div style={{ display:"flex", alignItems:"flex-start",
                  justifyContent:"space-between", gap:"8px", position:"relative", zIndex:1 }}>
                  <span style={{ ...mono, fontSize:"14px", fontWeight:700,
                    color: active ? meta.accent : "rgba(226,232,240,.85)", transition:"color 0.15s" }}>
                    {meta.label}
                  </span>
                  <span style={{
                    ...mono, fontSize:"9px", fontWeight:600, letterSpacing:"0.08em",
                    padding:"3px 9px", borderRadius:"999px", whiteSpace:"nowrap", flexShrink:0,
                    background: active ? meta.badgeBg : "rgba(255,255,255,.05)",
                    border: active ? `1px solid ${meta.badgeBorder}` : "1px solid rgba(255,255,255,.1)",
                    color: active ? meta.accent : "rgba(148,163,184,.55)",
                    transition:"all 0.15s",
                  }}>
                    {meta.badge}
                  </span>
                </div>

                {/* Description */}
                <p style={{
                  fontSize:"11.5px", lineHeight:1.6, color:"rgba(148,163,184,.55)",
                  fontFamily:"'Inter',sans-serif", marginTop:"8px", marginBottom:"14px",
                  position:"relative", zIndex:1,
                }}>
                  {meta.desc}
                </p>

                {/* Points + check */}
                <div style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between", position:"relative", zIndex:1 }}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:"4px" }}>
                    <span style={{ ...mono, fontSize:"24px", fontWeight:700,
                      color: active ? meta.accent : "rgba(226,232,240,.28)", transition:"color 0.15s" }}>
                      {item.points}
                    </span>
                    <span style={{ ...lbl, fontSize:"9px",
                      color: active ? hex2rgba(meta.accent,.6) : "rgba(100,116,139,.35)" }}>pts</span>
                  </div>
                  <div style={{
                    width:"22px", height:"22px", borderRadius:"50%",
                    border: active ? "none" : "1px solid rgba(255,255,255,.15)",
                    background: active ? meta.accent : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.18s",
                    boxShadow: active ? `0 0 12px ${hex2rgba(meta.accent,.55)}` : "none",
                  }}>
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
                          exit={{ scale:0 }}
                          transition={{ type:"spring", stiffness:400, damping:20 }}
                          style={{ color:"#fff", fontSize:"11px", lineHeight:1, fontWeight:700 }}>
                          ✓
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── LANGUAGE CARD ── */}
      <div style={{ ...card, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(167,139,250,.4),transparent)" }}/>

        <p style={{ ...lbl, color:"rgba(167,139,250,.65)", marginBottom:"14px" }}>Language</p>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:"10px" }}>
          {allowedLanguages.map(langKey => {
            const meta   = LANGUAGE_DETAIL[langKey] || {};
            const active = selectedLang === langKey;
            const hov    = hovLang === langKey;

            return (
              <motion.div
                key={langKey}
                whileTap={{ scale:0.98 }}
                onMouseEnter={() => setHovLang(langKey)}
                onMouseLeave={() => setHovLang(null)}
                onClick={() => onSelect("language", langKey)}
                style={{
                  borderRadius:"12px", padding:"16px 18px",
                  cursor:"pointer", transition:"all 0.16s",
                  position:"relative", overflow:"hidden",
                  border: active
                    ? `1px solid ${hex2rgba(meta.accent,.55)}`
                    : hov ? `1px solid ${hex2rgba(meta.accent,.28)}` : "1px solid rgba(255,255,255,.07)",
                  background: active
                    ? hex2rgba(meta.accent,.08)
                    : hov ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.02)",
                  boxShadow: active ? `0 0 20px ${hex2rgba(meta.accent,.12)}` : "none",
                }}
              >
                {active && (
                  <motion.div
                    animate={{ opacity:[0.3,0.6,0.3] }} transition={{ duration:2.5, repeat:Infinity }}
                    style={{ position:"absolute", inset:0, pointerEvents:"none",
                      background:`radial-gradient(ellipse at 50% 0%,${hex2rgba(meta.accent,.1)},transparent 70%)` }}
                  />
                )}

                {/* Top row: icon + name + check */}
                <div style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between", gap:"10px", position:"relative", zIndex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                    <div style={{
                      width:"38px", height:"38px", borderRadius:"10px", flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      ...mono, fontSize:"11px", fontWeight:700,
                      background: active ? hex2rgba(meta.accent,.18) : "rgba(255,255,255,.05)",
                      border: active
                        ? `1px solid ${hex2rgba(meta.accent,.35)}`
                        : "1px solid rgba(255,255,255,.09)",
                      color: active ? meta.accent : "rgba(148,163,184,.45)",
                      transition:"all 0.16s",
                    }}>
                      {meta.shortLabel}
                    </div>
                    <div>
                      <p style={{ ...mono, fontSize:"14px", fontWeight:700,
                        color: active ? meta.accent : "rgba(226,232,240,.85)",
                        margin:0, transition:"color 0.15s" }}>
                        {meta.label}
                      </p>
                      <p style={{ fontSize:"11.5px", color:"rgba(148,163,184,.55)",
                        fontFamily:"'Inter',sans-serif", margin:"3px 0 0" }}>
                        {meta.desc}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    width:"22px", height:"22px", borderRadius:"50%", flexShrink:0,
                    border: active ? "none" : "1px solid rgba(255,255,255,.15)",
                    background: active ? meta.accent : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.18s",
                    boxShadow: active ? `0 0 12px ${hex2rgba(meta.accent,.55)}` : "none",
                  }}>
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
                          exit={{ scale:0 }}
                          transition={{ type:"spring", stiffness:400, damping:20 }}
                          style={{ color:"#fff", fontSize:"11px", lineHeight:1, fontWeight:700 }}>
                          ✓
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap",
                  marginTop:"12px", position:"relative", zIndex:1 }}>
                  {meta.tags?.map(tag => (
                    <span key={tag} style={{
                      ...mono, fontSize:"10px", fontWeight:600,
                      padding:"3px 9px", borderRadius:"999px",
                      background: active ? meta.tagBg : "rgba(255,255,255,.04)",
                      border: active ? `1px solid ${meta.tagBorder}` : "1px solid rgba(255,255,255,.08)",
                      color: active ? meta.accent : "rgba(148,163,184,.4)",
                      transition:"all 0.15s",
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── SUMMARY + START ── */}
      <div style={{ ...card, padding:"16px 22px", display:"flex",
        alignItems:"center", gap:"20px", flexWrap:"wrap" }}>
        {[
          { label:"Sub",        value: activeSub.toUpperCase(),
            accent:"rgba(56,189,248,.8)" },
          { label:"Difficulty", value: DIFFICULTY_META[selectedDiff]?.label ?? selectedDiff,
            accent: DIFFICULTY_META[selectedDiff]?.accent ?? "#38bdf8" },
          { label:"Language",   value: LANGUAGE_DETAIL[selectedLang]?.label ?? selectedLang,
            accent: LANGUAGE_DETAIL[selectedLang]?.accent ?? "#a78bfa" },
          { label:"Points",     value: `${difficultyOptions.find(d => d.key === selectedDiff)?.points ?? "?"} pts`,
            accent:"#fb923c" },
        ].map(s => (
          <div key={s.label} style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
            <span style={{ ...lbl, fontSize:"8px" }}>{s.label}</span>
            <span style={{ ...mono, fontSize:"13px", fontWeight:700, color:s.accent }}>{s.value}</span>
          </div>
        ))}

        <div style={{ flex:1 }} />

        <ActionBtn
          accent="#38bdf8"
          disabled={busy || timeExpired || subBLocked}
          onClick={onStart}
        >
          {busy
            ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Starting...</>
            : `Start ${activeSub.toUpperCase()} →`}
        </ActionBtn>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function Round2ArenaPage() {
  const navigate     = useNavigate();
  const round2Config = ROUND_CONFIG.round2;

  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState("");
  const [status,      setStatus]      = useState(null);
  const [redirectingToResult, setRedirectingToResult] = useState(false);
  const [activeSub,   setActiveSub]   = useState("subA");
  const [selection,   setSelection]   = useState(DEFAULT_SELECT);
  const [problem,     setProblem]     = useState(null);
  const [code,        setCode]        = useState("");
  const [consoleData, setConsoleData] = useState(EMPTY_CONSOLE_DATA);
  const [lifeline,    setLifeline]    = useState(null);
  const [lifelineBusy,setLifelineBusy]= useState(false);
  const [saved,       setSaved]       = useState(false);
  const [tick,        setTick]        = useState(Date.now());
  const saveTimer = useMemo(() => ({ current: null }), []);

  const subStatus         = getSubMeta(status, activeSub);
  const activeConsoleData = consoleData?.[activeSub] || null;
  const subBUnlocked      = Boolean(status?.subA?.isSubmitted);
  const visibleSubs       = subBUnlocked ? SUBS : [SUBS[0]];

  const fetchStatus = useCallback(async () => {
    const payload = await getRound2Result();
    setStatus(payload);
    if (payload?.activeSub === "subB" && !payload?.subA?.isSubmitted) setActiveSub("subA");
    else if (payload?.activeSub) setActiveSub(payload.activeSub);
    return payload;
  }, []);

  const syncLifeline = useCallback(async () => {
    const payload = await getMyLifelineStatus("round2");
    setLifeline(payload);
    return payload;
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const [payload] = await Promise.all([fetchStatus(), syncLifeline()]);
        if (!active) return;
        if (payload?.subA?.isSubmitted && payload?.subB?.isSubmitted) {
          navigate("/team/round2/result", { replace: true });
          return;
        }
        const initialSub       = payload?.activeSub || "subA";
        const initialSubStatus = getSubMeta(payload, initialSub);
        if (initialSubStatus.isStarted && !initialSubStatus.isSubmitted) {
          const startApi = initialSub === "subA" ? startRound2SubA : startRound2SubB;
          const p = await startApi({});
          if (!active) return;
          setProblem(p.problem || null);
          setCode(p.code || p.problem?.starterCode || "");
          setSelection(prev => ({
            ...prev,
            [initialSub]: {
              difficulty: p.sub?.difficulty || prev[initialSub].difficulty,
              language:   p.sub?.language   || prev[initialSub].language,
            },
          }));
        }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load Round 2."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, [fetchStatus, navigate, syncLifeline]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      if (loading || !status) return;
      if (activeSub === "subB" && !subBUnlocked) { setActiveSub("subA"); return; }
      const current = getSubMeta(status, activeSub);
      if (!current.isStarted || current.isSubmitted) { setProblem(null); setCode(""); return; }
      try {
        const startApi = activeSub === "subA" ? startRound2SubA : startRound2SubB;
        const payload  = await startApi({});
        if (!active) return;
        setProblem(payload.problem || null);
        setCode(payload.code || payload.problem?.starterCode || "");
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to restore coding session."));
      }
    };
    void hydrate();
    return () => { active = false; };
  }, [activeSub, loading, status, subBUnlocked]);

  const difficultyOptions = useMemo(
    () => Object.entries(round2Config.difficultyPoints).map(([key, points]) => ({
      key, label: key.charAt(0).toUpperCase() + key.slice(1), points,
    })),
    [round2Config.difficultyPoints]
  );

  const currentLanguageKey = subStatus.language || selection[activeSub].language;
  const monacoLanguage     = LANGUAGE_META[currentLanguageKey]?.monaco || "cpp";
  const bothSubmitted      = Boolean(status?.subA?.isSubmitted && status?.subB?.isSubmitted);
  const canMoveRound3      = Boolean(status?.subB?.isSubmitted);
  const lockSelection      = subStatus.isStarted;
  const roundStartedAtMs   = status?.startedAt ? new Date(status.startedAt).getTime() : null;
  const timerStarted       = Number.isFinite(roundStartedAtMs);

  const timeLeftSeconds = useMemo(() => {
    if (bothSubmitted) return 0;
    if (!timerStarted) return round2Config.durationSeconds;
    const elapsed = Math.floor((tick - roundStartedAtMs) / 1000);
    return Math.max(0, round2Config.durationSeconds - elapsed);
  }, [bothSubmitted, round2Config.durationSeconds, roundStartedAtMs, tick, timerStarted]);

  const timeExpired = timerStarted && timeLeftSeconds <= 0 && !bothSubmitted;
  const isLow       = timeLeftSeconds < round2Config.durationSeconds / 6;
  const isWarn      = timeLeftSeconds < round2Config.durationSeconds / 3;
  const timerAccent = timeExpired || isLow ? "#f87171" : isWarn ? "#fb923c" : "#38bdf8";
  const lifelineUnlockAtMs = roundStartedAtMs
    ? roundStartedAtMs + LIFELINE_UNLOCK_DELAY_SECONDS * 1000
    : null;
  const lifelineUnlocked = Boolean(lifelineUnlockAtMs && tick >= lifelineUnlockAtMs);
  const lifelineWaitSeconds = lifelineUnlockAtMs
    ? Math.max(0, Math.ceil((lifelineUnlockAtMs - tick) / 1000))
    : LIFELINE_UNLOCK_DELAY_SECONDS;
  const lifelineRemaining = Number(lifeline?.remainingCount ?? 1);
  const lifelineUsedCount = Number(lifeline?.usedCount ?? 0);
  const lifelinePending = lifeline?.request?.status === "pending";
  const lifelineApproved = lifeline?.request?.status === "approved";
  const lifelineRejected = lifeline?.request?.status === "rejected";
  const lifelinePenalty = Number(lifeline?.penaltyPoints ?? 10);

  const subAMeta = getSubMeta(status, "subA");
  const subBMeta = getSubMeta(status, "subB");

  useEffect(() => {
    if (!timerStarted || bothSubmitted) return undefined;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [bothSubmitted, timerStarted]);

  useEffect(() => {
    if (!timerStarted || bothSubmitted) return undefined;
    const id = window.setInterval(() => {
      void syncLifeline().catch(() => {});
    }, LIFELINE_STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [bothSubmitted, syncLifeline, timerStarted]);

  const handleSelect = (field, value) => {
    if (lockSelection) return;
    setSelection(prev => ({ ...prev, [activeSub]: { ...prev[activeSub], [field]: value } }));
  };

  const handleStart = async () => {
    if (timeExpired) return;
    setBusy(true); setError("");
    setConsoleData(prev => ({ ...prev, [activeSub]: null }));
    try {
      const startApi = activeSub === "subA" ? startRound2SubA : startRound2SubB;
      const payload  = await startApi({
        difficulty: selection[activeSub].difficulty,
        language:   selection[activeSub].language,
      });
      setProblem(payload.problem || null);
      setCode(payload.code || payload.problem?.starterCode || "");
      await Promise.all([fetchStatus(), syncLifeline()]);
    } catch (err) {
      setError(getApiErrorMessage(err, `Unable to start ${activeSub}.`));
    } finally { setBusy(false); }
  };

  const handleExecute = async (mode) => {
    if (!problem || timeExpired) return;
    setBusy(true); setError("");
    setConsoleData(prev => ({ ...prev, [activeSub]: null }));
    try {
      const executeApi =
        mode === "run"
          ? activeSub === "subA"
            ? runRound2SubA
            : runRound2SubB
          : activeSub === "subA"
            ? submitRound2SubA
            : submitRound2SubB;
      const payload = await executeApi({ code });
      setConsoleData(prev => ({ ...prev, [activeSub]: { ...payload, subKey: activeSub } }));
      if (mode === "submit") {
        const nextStatus = await getRound2Result();
        const isRoundComplete = Boolean(
          nextStatus?.subA?.isSubmitted && nextStatus?.subB?.isSubmitted
        );
        if (isRoundComplete) {
          setRedirectingToResult(true);
        }
        setStatus(nextStatus);
        void syncLifeline().catch(() => {});
        if (isRoundComplete)
          navigate("/team/round2/result", { replace: true });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Execution failed."));
    } finally { setBusy(false); }
  };

  const handleLifelineRequest = async () => {
    if (!lifelineUnlocked || lifelineRemaining <= 0 || lifelinePending || timeExpired) return;
    setLifelineBusy(true);
    setError("");
    try {
      await requestLifeline("round2");
      await syncLifeline();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to request a lifeline."));
    } finally {
      setLifelineBusy(false);
    }
  };

  const handleCodeChange = (val) => {
    setCode(val || "");
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaved(true), 1500);
  };

  if (loading) return <LoadingSkeleton />;

  if (redirectingToResult) {
    return (
      <motion.div
        initial={{ opacity:0, y:8 }}
        animate={{ opacity:1, y:0 }}
        style={{ ...card, padding:"24px 26px", color:"#e2e8f0", ...mono }}
      >
        <p style={{ ...lbl, color:"rgba(167,139,250,.65)" }}>Round 2 Complete</p>
        <p style={{ marginTop:"10px", fontSize:"16px", fontWeight:700, color:"#a78bfa" }}>
          Opening final result...
        </p>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", color:"#e2e8f0", ...mono }}
    >

      {/* ══ STAT TILES ══ */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
        <StatTile
          label="Timer" accent={timerAccent} pulse={isLow || timeExpired}
          value={formatCountdown(timeLeftSeconds)}
          sub={timeExpired ? "⚠ Time expired" : isLow ? "⚠ Low time" : "Remaining"}
        />
        <StatTile
          label="Total Score" accent="#a78bfa"
          value={`${status?.totalScore || 0}`}
          sub={`/ ${round2Config.maxScore} pts`}
        />
        <StatTile
          label="Sub A"
          accent={subAMeta.isSubmitted ? "#34d399" : subAMeta.isStarted ? "#38bdf8" : "rgba(100,116,139,0.8)"}
          pulse={subAMeta.isStarted && !subAMeta.isSubmitted}
          value={subAMeta.isSubmitted ? `${subAMeta.score} pts` : subAMeta.isStarted ? "Active" : "Pending"}
          sub={subAMeta.isSubmitted ? (subAMeta.passed ? "Passed ✓" : "Failed ✗") : subAMeta.isStarted ? "In progress" : "Not started"}
        />
        <StatTile
          label="Sub B"
          accent={subBMeta.isSubmitted ? "#34d399" : subBUnlocked ? "#38bdf8" : "rgba(100,116,139,0.8)"}
          pulse={subBMeta.isStarted && !subBMeta.isSubmitted}
          value={subBMeta.isSubmitted ? `${subBMeta.score} pts` : subBUnlocked ? (subBMeta.isStarted ? "Active" : "Unlocked") : "Locked"}
          sub={subBMeta.isSubmitted ? (subBMeta.passed ? "Passed ✓" : "Failed ✗") : subBUnlocked ? (subBMeta.isStarted ? "In progress" : "Submit Sub A to start") : "Complete Sub A first"}
        />
      </div>

      {/* ══ HEADER CARD ══ */}
      <div style={{ ...card, padding:"20px 26px", position:"relative", overflow:"hidden" }}>
        <ScanLine color="#a78bfa" />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(167,139,250,.5),rgba(56,189,248,.3),transparent)" }}/>
        <motion.div animate={{ height:["30%","70%","30%"] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
            width:"3px", borderRadius:"0 3px 3px 0",
            background:"linear-gradient(to bottom,transparent,#a78bfa,transparent)" }}/>

        <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center",
          justifyContent:"space-between", flexWrap:"wrap", gap:"14px" }}>
          <div>
            <p style={{ ...lbl, color:"rgba(167,139,250,.65)" }}>Team · Round 2</p>
            <h2 style={{ fontSize:"20px", fontWeight:700, color:"#f1f5f9",
              marginTop:"5px", letterSpacing:"-0.01em" }}>Coding Engine</h2>
          </div>
          {canMoveRound3 && (
            <ActionBtn accent="#34d399" onClick={() => navigate("/team/round3")}>
              <motion.span animate={{ x:[0,3,0] }} transition={{ duration:1.2, repeat:Infinity }}>→</motion.span>
              Round 3
            </ActionBtn>
          )}
        </div>
      </div>

      {/* ══ ERROR BANNERS ══ */}
      <div style={{
        ...card,
        padding:"16px 20px",
        border: lifelinePending
          ? "1px solid rgba(251,146,60,.28)"
          : lifelineRemaining <= 0
            ? "1px solid rgba(248,113,113,.22)"
            : "1px solid rgba(56,189,248,.22)"
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"14px", flexWrap:"wrap" }}>
          <div>
            <p style={{ ...lbl, color:"rgba(56,189,248,.62)" }}>Round 2 Lifeline</p>
            <p style={{ fontSize:"12px", color:"rgba(203,213,225,.72)", marginTop:"6px", fontFamily:"'Inter',sans-serif" }}>
              Send an admin request after 15 minutes. Each approved lifeline deducts {lifelinePenalty} points. You can use {lifeline?.maxRequests ?? 1} shared lifeline across Round 2 and Round 3.
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            <div style={{ padding:"9px 14px", borderRadius:"10px", background:"rgba(56,189,248,.08)", border:"1px solid rgba(56,189,248,.2)" }}>
              <p style={{ ...lbl, fontSize:"8px", color:"rgba(56,189,248,.6)", marginBottom:"4px" }}>Usage</p>
              <p style={{ ...mono, fontSize:"16px", fontWeight:700, color:"#7dd3fc" }}>
                {lifelineUsedCount} / {lifeline?.maxRequests ?? 1}
              </p>
            </div>
            <div style={{ padding:"9px 14px", borderRadius:"10px", background:"rgba(167,139,250,.08)", border:"1px solid rgba(167,139,250,.2)" }}>
              <p style={{ ...lbl, fontSize:"8px", color:"rgba(167,139,250,.6)", marginBottom:"4px" }}>Remaining</p>
              <p style={{ ...mono, fontSize:"16px", fontWeight:700, color:"#c4b5fd" }}>{lifelineRemaining}</p>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", flexWrap:"wrap", marginTop:"14px" }}>
          <div>
            <p style={{ fontSize:"12px", color:"rgba(148,163,184,.78)", fontFamily:"'Inter',sans-serif" }}>
              {!timerStarted
                ? "Lifeline unlocks once Round 2 starts."
                : !lifelineUnlocked
                  ? `Lifeline request unlocks in ${formatCountdown(lifelineWaitSeconds)}.`
                  : lifelinePending
                    ? "Your latest request is pending admin approval."
                    : lifelineRemaining <= 0
                      ? "Your shared lifeline has already been used."
                      : lifelineApproved
                        ? "Approved lifeline applied. No lifelines remain."
                        : lifelineRejected
                          ? "Last request was rejected. You can try again if the shared lifeline is still unused."
                          : "Lifeline is unlocked and ready to request."}
            </p>
            {lifeline?.request?.requestedAt && (
              <p style={{ ...lbl, fontSize:"8px", marginTop:"6px", color:"rgba(148,163,184,.4)" }}>
                Latest request: {lifeline.request.status} � {new Date(lifeline.request.requestedAt).toLocaleString()}
              </p>
            )}
          </div>

          {lifelineUnlocked && lifelineRemaining > 0 && !lifelinePending && (
            <ActionBtn
              accent={lifelineBusy ? "#fb923c" : "#38bdf8"}
              onClick={() => void handleLifelineRequest()}
              disabled={lifelineBusy || busy || timeExpired}
            >
              {lifelineBusy
                ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>...</motion.span> Requesting...</>
                : "Request Lifeline"}
            </ActionBtn>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ padding:"10px 16px", borderRadius:"10px",
              background:"rgba(248,113,113,.08)", border:"1px solid rgba(248,113,113,.3)",
              display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ color:"#f87171", fontSize:"12px", flexShrink:0 }}>⚠</span>
            <span style={{ fontSize:"12px", color:"#fca5a5", flex:1 }}>{error}</span>
            <button onClick={()=>setError("")} style={{ background:"none", border:"none",
              color:"rgba(148,163,184,.5)", cursor:"pointer", fontSize:"14px", padding:0 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {timeExpired && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ padding:"10px 16px", borderRadius:"10px",
              background:"rgba(248,113,113,.08)", border:"1px solid rgba(248,113,113,.3)",
              display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ color:"#f87171", fontSize:"12px", flexShrink:0 }}>⌛</span>
            <span style={{ fontSize:"12px", color:"#fca5a5", flex:1 }}>
              Round 2 time is over. Start, run, and submit actions are locked on this page.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ SUB TABS ══ */}
      <div style={{ ...card, padding:"14px 18px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px",
          background:"linear-gradient(90deg,transparent,rgba(56,189,248,.25),transparent)" }}/>
        <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
          <p style={{ ...lbl, marginRight:"4px" }}>Sub-problem</p>

          {visibleSubs.map(sub => {
            const meta   = getSubMeta(status, sub.key);
            const active = activeSub === sub.key;
            return (
              <motion.button key={sub.key} type="button"
                whileHover={{ y:-2 }} whileTap={{ scale:0.97 }}
                onClick={() => setActiveSub(sub.key)}
                style={{
                  ...mono, borderRadius:"11px", padding:"11px 18px",
                  cursor:"pointer", textAlign:"left", minWidth:"165px",
                  transition:"all 0.18s",
                  border: active ? "1px solid rgba(56,189,248,.45)" : "1px solid rgba(255,255,255,.08)",
                  background: active ? "rgba(56,189,248,.1)" : "rgba(255,255,255,.02)",
                  boxShadow: active ? "0 0 14px rgba(56,189,248,.14)" : "none",
                }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <motion.span
                    animate={{ opacity:[1,.3,1], scale:meta.isSubmitted?[1,1,1]:[1,.7,1] }}
                    transition={{ duration: meta.isSubmitted?4:1.8, repeat:Infinity }}
                    style={{ width:"7px", height:"7px", borderRadius:"50%", flexShrink:0,
                      background: meta.isSubmitted ? "#34d399" : meta.isStarted ? "#38bdf8" : "rgba(100,116,139,.55)",
                      boxShadow: meta.isStarted && !meta.isSubmitted ? "0 0 8px rgba(56,189,248,.9)" : "none",
                    }}/>
                  <span style={{ fontSize:"12px", fontWeight:700,
                    color: active ? "#7dd3fc" : "rgba(226,232,240,.8)" }}>
                    {sub.label}
                  </span>
                  {meta.isSubmitted && (
                    <motion.span initial={{ scale:0 }} animate={{ scale:1 }}
                      transition={{ type:"spring", stiffness:400, damping:18 }}
                      style={{ fontSize:"11px", color:"#34d399" }}>✓</motion.span>
                  )}
                </div>
                <p style={{ ...lbl, fontSize:"8px", marginTop:"5px",
                  color: meta.isSubmitted ? "rgba(52,211,153,.7)"
                    : meta.isStarted ? "rgba(56,189,248,.6)" : "rgba(100,116,139,.5)" }}>
                  {meta.isSubmitted ? `Submitted · ${meta.score} pts` : meta.isStarted ? "In Progress" : "Not Started"}
                </p>
              </motion.button>
            );
          })}

          {!subBUnlocked && (
            <div style={{ ...mono, borderRadius:"11px", padding:"11px 18px", minWidth:"165px",
              border:"1px dashed rgba(148,163,184,.18)", background:"rgba(255,255,255,.01)", opacity:.55 }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"11px", color:"rgba(148,163,184,.4)" }}>○</span>
                <span style={{ fontSize:"12px", fontWeight:700, color:"rgba(148,163,184,.45)" }}>Sub B</span>
              </div>
              <p style={{ ...lbl, fontSize:"8px", marginTop:"5px" }}>Submit Sub A to unlock</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ CONFIGURE PANEL ══ */}
      <AnimatePresence mode="wait">
        {!subStatus.isStarted && (
          <ConfigurePanel
            activeSub={activeSub}
            selection={selection}
            difficultyOptions={difficultyOptions}
            allowedLanguages={round2Config.allowedLanguages}
            onSelect={handleSelect}
            onStart={handleStart}
            busy={busy}
            timeExpired={timeExpired}
            subBLocked={activeSub === "subB" && !status?.subA?.isSubmitted}
          />
        )}
      </AnimatePresence>

      {/* ══ CODING AREA ══ */}
      <AnimatePresence>
        {subStatus.isStarted && !subStatus.isSubmitted && (
          <motion.div key="editor"
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:"12px" }}>

            {/* ── PROBLEM PANEL ── */}
            <div style={{ ...card, display:"flex", flexDirection:"column",
              overflow:"hidden", maxHeight:"720px", position:"relative" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
                background:"linear-gradient(90deg,transparent,rgba(56,189,248,.4),transparent)" }}/>

              <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,.07)",
                background:"rgba(255,255,255,.02)", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ ...lbl, fontSize:"8px", color:"rgba(56,189,248,.6)" }}>
                    {activeSub.toUpperCase()} · Problem
                  </span>
                  {problem?.difficulty && (
                    <span style={{ ...mono, fontSize:"8px", fontWeight:700,
                      padding:"2px 8px", borderRadius:"999px",
                      color: DIFF_ACCENT[problem.difficulty.toLowerCase()] || "#fb923c",
                      background: hex2rgba(DIFF_ACCENT[problem.difficulty.toLowerCase()] || "#fb923c", .1),
                      border:`1px solid ${hex2rgba(DIFF_ACCENT[problem.difficulty.toLowerCase()] || "#fb923c", .25)}` }}>
                      {problem.difficulty}
                    </span>
                  )}
                </div>
                <p style={{ ...mono, fontSize:"15px", fontWeight:700, color:"#f1f5f9", marginTop:"6px" }}>
                  {problem?.title || "Loading…"}
                </p>
              </div>

              <div style={{ padding:"16px 18px", overflowY:"auto", flex:1,
                scrollbarWidth:"thin", scrollbarColor:"rgba(255,255,255,.07) transparent" }}>
                <p style={{ fontSize:"12.5px", lineHeight:1.8,
                  color:"rgba(203,213,225,.82)", fontFamily:"'Inter',sans-serif" }}>
                  {problem?.description}
                </p>

                {[
                  { key:"inputFormat",  label:"Input Format"  },
                  { key:"outputFormat", label:"Output Format" },
                ].map(({ key, label }) => problem?.[key] && (
                  <div key={key} style={{ marginTop:"16px" }}>
                    <p style={{ ...lbl, fontSize:"8px", marginBottom:"8px" }}>{label}</p>
                    <pre style={{ borderRadius:"9px",
                      background:"rgba(167,139,250,.05)", border:"1px solid rgba(167,139,250,.18)",
                      padding:"11px 13px", fontSize:"11.5px", whiteSpace:"pre-wrap",
                      color:"rgba(203,213,225,.8)", ...mono }}>
                      {problem[key]}
                    </pre>
                  </div>
                ))}

                {Array.isArray(problem?.visibleTestCases) && problem.visibleTestCases.length > 0 && (
                  <div style={{ marginTop:"18px", display:"flex", flexDirection:"column", gap:"10px" }}>
                    <p style={{ ...lbl, fontSize:"8px" }}>Visible Test Cases</p>
                    {problem.visibleTestCases.map((tc, idx) => (
                      <div key={`${activeSub}-visible-${idx}`} style={{
                        borderRadius:"9px", background:"rgba(56,189,248,.04)",
                        border:"1px solid rgba(56,189,248,.18)", padding:"12px 14px" }}>
                        <p style={{ ...lbl, fontSize:"7px", marginBottom:"6px", color:"rgba(56,189,248,.6)" }}>
                          Case {idx+1} · Input
                        </p>
                        <pre style={{ fontSize:"11px", whiteSpace:"pre-wrap",
                          color:"rgba(203,213,225,.8)", ...mono }}>{tc.input}</pre>
                        <p style={{ ...lbl, fontSize:"7px", margin:"10px 0 6px", color:"rgba(52,211,153,.6)" }}>
                          Expected Output
                        </p>
                        <pre style={{ fontSize:"11px", whiteSpace:"pre-wrap",
                          color:"rgba(167,243,208,.85)", ...mono }}>{tc.output}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── EDITOR PANEL ── */}
            <div style={{ ...card, overflow:"hidden", display:"flex",
              flexDirection:"column", position:"relative" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
                background:"linear-gradient(90deg,transparent,rgba(167,139,250,.45),transparent)" }}/>

              {/* Toolbar */}
              <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,.07)",
                background:"rgba(255,255,255,.02)", display:"flex",
                alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <span style={{ ...lbl, fontSize:"8px" }}>Language</span>
                  <span style={{ ...mono, fontSize:"11px", fontWeight:700, color:"#a78bfa",
                    padding:"3px 10px", borderRadius:"999px",
                    background:"rgba(167,139,250,.1)", border:"1px solid rgba(167,139,250,.25)" }}>
                    {LANGUAGE_META[currentLanguageKey]?.label || currentLanguageKey}
                  </span>
                </div>
                <motion.span
                  animate={{ opacity:saved?1:[0.4,.8,.4] }}
                  transition={{ duration:saved?0:1.5, repeat:saved?0:Infinity }}
                  style={{ ...lbl, fontSize:"8px",
                    color:saved?"rgba(52,211,153,.7)":"rgba(251,146,60,.6)" }}>
                  {saved ? "◉ Auto-saved" : "◌ Saving..."}
                </motion.span>
              </div>

              {/* Monaco */}
              <div style={{ flex:1, minHeight:0, height:"430px" }}>
                <Editor
                  height="100%"
                  language={monacoLanguage}
                  theme="vs-dark"
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    minimap:{ enabled:false }, fontSize:13,
                    automaticLayout:true, scrollBeyondLastLine:false,
                    readOnly: subStatus.isSubmitted,
                    fontFamily:"'DM Mono','Fira Code',monospace",
                    padding:{ top:14, bottom:14 },
                    lineNumbersMinChars:3,
                    renderLineHighlight:"gutter",
                  }}
                />
              </div>

              {/* Action bar */}
              <div style={{ borderTop:"1px solid rgba(255,255,255,.07)",
                padding:"12px 16px", display:"flex", gap:"8px", flexWrap:"wrap",
                background:"rgba(0,0,0,.22)", flexShrink:0, alignItems:"center" }}>
                <ActionBtn accent="rgba(203,213,225,.75)"
                  onClick={() => void handleExecute("run")}
                  disabled={busy || timeExpired || subStatus.isSubmitted}>
                  {busy
                    ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Running...</>
                    : <><span>▶</span> Run Tests</>}
                </ActionBtn>
                <ActionBtn accent="#38bdf8"
                  onClick={() => void handleExecute("submit")}
                  disabled={busy || timeExpired || subStatus.isSubmitted}>
                  {busy
                    ? <><motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}>◌</motion.span> Submitting...</>
                    : "Submit Final →"}
                </ActionBtn>
                <div style={{ flex:1 }}/>
                <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,.4)" }}>
                  {code.split("\n").length} lines
                </span>
              </div>

              {/* Console */}
              <div style={{ borderTop:"1px solid rgba(255,255,255,.07)",
                padding:"14px 16px", background:"rgba(0,0,0,.3)", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                  <p style={{ ...lbl, fontSize:"8px",
                    color: activeConsoleData
                      ? isOutputSuccess(activeConsoleData) ? "rgba(52,211,153,.8)" : "rgba(248,113,113,.8)"
                      : "rgba(148,163,184,.45)" }}>
                    Output Console
                  </p>
                  <AnimatePresence>
                    {activeConsoleData && (
                      <motion.span initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0 }}
                        style={{ padding:"2px 9px", borderRadius:"999px",
                          ...mono, fontSize:"8px", fontWeight:700,
                          color: isOutputSuccess(activeConsoleData) ? "#34d399" : "#f87171",
                          background: isOutputSuccess(activeConsoleData) ? "rgba(52,211,153,.1)" : "rgba(248,113,113,.1)",
                          border:`1px solid ${isOutputSuccess(activeConsoleData) ? "rgba(52,211,153,.3)" : "rgba(248,113,113,.3)"}` }}>
                        {isOutputSuccess(activeConsoleData) ? "✓ Passed" : "✗ Failed"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {busy && (
                    <motion.span animate={{ rotate:360 }} transition={{ duration:.8, repeat:Infinity, ease:"linear" }}
                      style={{ color:"rgba(56,189,248,.6)", fontSize:"12px" }}>◌</motion.span>
                  )}
                </div>

                {!activeConsoleData && !busy && (
                  <p style={{ fontSize:"12px", color:"rgba(148,163,184,.45)" }}>
                    Run or submit to see test results.
                  </p>
                )}

                {activeConsoleData && (
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {activeConsoleData?.visible?.results?.map(item => (
                      <ConsoleRow
                        key={`${activeSub}-${activeConsoleData.mode}-${item.caseNo}`}
                        item={item}
                      />
                    ))}

                    {activeConsoleData.mode === "submit" && (
                      <>
                        <div style={{ padding:"9px 12px", borderRadius:"8px",
                          background:"rgba(167,139,250,.06)", border:"1px solid rgba(167,139,250,.2)" }}>
                          <p style={{ ...mono, fontSize:"11px", color:"rgba(167,139,250,.85)" }}>
                            Hidden tests: {activeConsoleData.hidden?.passed||0} / {activeConsoleData.hidden?.total||0} passed
                          </p>
                        </div>
                        <div style={{ padding:"9px 12px", borderRadius:"8px",
                          background:"rgba(56,189,248,.06)", border:"1px solid rgba(56,189,248,.22)" }}>
                          <p style={{ ...mono, fontSize:"11px", color:"#7dd3fc" }}>
                            {activeConsoleData.message || "Submission processed."}
                          </p>
                          <p style={{ ...mono, fontSize:"10px", color:"rgba(125,211,252,.8)", marginTop:"4px" }}>
                            Base: {activeConsoleData.baseScore ?? activeConsoleData.score ?? 0} pts
                            {" · "}Bonus: {activeConsoleData.bonusPoints||0} pts
                            {" · "}Total: {activeConsoleData.score||0} pts
                          </p>
                        </div>
                        {activeConsoleData.complexity && (
                          <div style={{ padding:"9px 12px", borderRadius:"8px",
                            background:"rgba(52,211,153,.05)", border:"1px solid rgba(52,211,153,.2)" }}>
                            <p style={{ ...mono, fontSize:"10px", color:"rgba(52,211,153,.9)" }}>
                              Time: {activeConsoleData.complexity.timeComplexity||"N/A"}
                              {" · "}Space: {activeConsoleData.complexity.spaceComplexity||"N/A"}
                            </p>
                            {activeConsoleData.complexity.explanation && (
                              <p style={{ ...mono, fontSize:"10px", color:"rgba(167,243,208,.85)", marginTop:"4px" }}>
                                {activeConsoleData.complexity.explanation}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ RESULT BANNER ══ */}
      <AnimatePresence>
        {subStatus.isSubmitted && !bothSubmitted && (
          <motion.div key="result"
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ ...card, padding:"20px 24px", position:"relative", overflow:"hidden",
              border:`1px solid ${subStatus.passed ? "rgba(52,211,153,.28)" : "rgba(248,113,113,.22)"}` }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
              background: subStatus.passed
                ? "linear-gradient(90deg,transparent,rgba(52,211,153,.55),transparent)"
                : "linear-gradient(90deg,transparent,rgba(248,113,113,.45),transparent)" }}/>
            <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%", width:"3px",
              borderRadius:"0 3px 3px 0",
              background: subStatus.passed ? "#34d399" : "#f87171",
              boxShadow:`0 0 8px ${subStatus.passed ? "rgba(52,211,153,.7)" : "rgba(248,113,113,.7)"}` }}/>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              flexWrap:"wrap", gap:"12px" }}>
              <div>
                <p style={{ ...lbl, fontSize:"8px", marginBottom:"6px",
                  color: subStatus.passed ? "rgba(52,211,153,.6)" : "rgba(248,113,113,.6)" }}>
                  {activeSub.toUpperCase()} · Submission Result
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <motion.span initial={{ scale:.8 }} animate={{ scale:1 }}
                    transition={{ type:"spring", stiffness:360, damping:20 }}
                    style={{ ...mono, fontSize:"16px", fontWeight:700,
                      color: subStatus.passed ? "#34d399" : "#f87171" }}>
                    {subStatus.passed ? "✓ Passed" : "✗ Failed"}
                  </motion.span>
                  <span style={{ ...mono, fontSize:"22px", fontWeight:700,
                    color: subStatus.passed ? "#34d399" : "#f87171", letterSpacing:"-0.01em" }}>
                    {subStatus.score}
                    <span style={{ fontSize:"11px", fontWeight:400,
                      color:"rgba(203,213,225,.5)", marginLeft:"4px" }}>pts</span>
                  </span>
                </div>
              </div>

              {bothSubmitted && (
                <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
                  transition={{ delay:.2, type:"spring", stiffness:300 }}
                  style={{ padding:"12px 20px", borderRadius:"11px",
                    background:"rgba(167,139,250,.09)", border:"1px solid rgba(167,139,250,.25)" }}>
                  <p style={{ ...lbl, fontSize:"8px", color:"rgba(167,139,250,.6)", marginBottom:"5px" }}>
                    Round 2 Complete ✓
                  </p>
                  <p style={{ ...mono, fontSize:"20px", fontWeight:700, color:"#a78bfa", letterSpacing:"-0.01em" }}>
                    {status?.totalScore||0}
                    <span style={{ fontSize:"11px", fontWeight:400,
                      color:"rgba(167,139,250,.45)" }}>&nbsp;/ {round2Config.maxScore} pts</span>
                  </p>
                </motion.div>
              )}
            </div>

            {subStatus.isSubmitted && activeConsoleData?.mode === "submit" && (
              <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:.15 }}
                style={{ marginTop:"14px", display:"grid",
                  gridTemplateColumns:"1fr 1fr auto", gap:"8px" }}>
                <div style={{ padding:"10px 12px", borderRadius:"9px",
                  background:"rgba(167,139,250,.06)", border:"1px solid rgba(167,139,250,.2)" }}>
                  <p style={{ ...lbl, fontSize:"7px", marginBottom:"4px" }}>Hidden Tests</p>
                  <p style={{ ...mono, fontSize:"12px", color:"rgba(167,139,250,.9)" }}>
                    {activeConsoleData.hidden?.passed||0} / {activeConsoleData.hidden?.total||0} passed
                  </p>
                </div>
                <div style={{ padding:"10px 12px", borderRadius:"9px",
                  background:"rgba(56,189,248,.06)", border:"1px solid rgba(56,189,248,.2)" }}>
                  <p style={{ ...lbl, fontSize:"7px", marginBottom:"4px" }}>Score Breakdown</p>
                  <p style={{ ...mono, fontSize:"11px", color:"#7dd3fc" }}>
                    {activeConsoleData.baseScore??0} + {activeConsoleData.bonusPoints||0} bonus
                  </p>
                </div>
                {activeConsoleData.complexity && (
                  <div style={{ padding:"10px 12px", borderRadius:"9px",
                    background:"rgba(52,211,153,.05)", border:"1px solid rgba(52,211,153,.2)" }}>
                    <p style={{ ...lbl, fontSize:"7px", marginBottom:"4px" }}>Complexity</p>
                    <p style={{ ...mono, fontSize:"11px", color:"rgba(52,211,153,.85)" }}>
                      {activeConsoleData.complexity.timeComplexity||"N/A"}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.section>
  );
}


