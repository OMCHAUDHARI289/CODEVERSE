import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/httpClient";
import {
  getRound2Result,
  startRound2SubA,
  startRound2SubB,
  submitRound2SubA,
  submitRound2SubB
} from "../../api/round2Api";
import { ROUND_CONFIG } from "../../data/roundConfig";

/* ─── original constants, untouched ─── */
const SUBS = [
  { key: "subA", label: "Sub A" },
  { key: "subB", label: "Sub B" }
];

const LANGUAGE_META = {
  cpp:  { label: "C++",  monaco: "cpp"  },
  java: { label: "Java", monaco: "java" }
};

const DEFAULT_SELECT = {
  subA: { difficulty: "easy", language: "cpp" },
  subB: { difficulty: "easy", language: "cpp" }
};

const getSubMeta = (status, subKey) =>
  status?.[subKey] || {
    isStarted: false, isSubmitted: false, passed: false,
    score: 0, difficulty: null, language: null
  };

const isOutputSuccess = (consoleData) =>
  Boolean(consoleData?.mode === "run"    && consoleData?.passed) ||
  Boolean(consoleData?.mode === "submit" && consoleData?.passed);

/* ─── DESIGN TOKENS (matching admin pages) ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (h, a) => { const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#a78bfa" }) {
  return (
    <motion.div
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
      style={{
        position: "absolute", left: 0, right: 0, height: "1px",
        pointerEvents: "none", zIndex: 2,
        background: `linear-gradient(90deg,transparent,${hex2rgba(color, 0.18)},transparent)`,
      }}
    />
  );
}

/* ─── SKELETON ─── */
function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ display: "flex", flexDirection: "column", gap: "12px", ...mono }}
    >
      {[["60%", "30%"], ["100%"], ["100%", "100%"]].map((cols, i) => (
        <div key={i} style={{ ...card, padding: "20px", display: "grid",
          gridTemplateColumns: cols.join(" "), gap: "12px" }}>
          {cols.map((_, j) => (
            <motion.div key={j}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 + j * 0.06 }}
              style={{ height: j === 0 && i === 0 ? "48px" : "180px",
                borderRadius: "8px", background: "rgba(255,255,255,0.07)" }}
            />
          ))}
        </div>
      ))}
    </motion.div>
  );
}

/* ─── PILL BUTTON (difficulty / language selector) ─── */
function PillBtn({ active, accent = "#38bdf8", onClick, disabled, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        ...mono, fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em",
        padding: "7px 13px", borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
        border: active
          ? `1px solid ${hex2rgba(accent, 0.55)}`
          : `1px solid ${hov && !disabled ? hex2rgba(accent, 0.3) : "rgba(255,255,255,0.1)"}`,
        background: active ? hex2rgba(accent, 0.14) : hov && !disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        color: active ? accent : "rgba(226,232,240,0.8)",
        boxShadow: active ? `0 0 10px ${hex2rgba(accent, 0.15)}` : "none",
      }}
    >
      {children}
    </button>
  );
}

/* ─── ACTION BUTTON ─── */
function ActionBtn({ accent = "#38bdf8", onClick, disabled, children }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.button
      type="button" onClick={onClick} disabled={disabled}
      whileHover={!disabled ? { y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        ...mono, fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", padding: "9px 18px", borderRadius: "9px",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.42 : 1,
        border: `1px solid ${hex2rgba(accent, hov && !disabled ? 0.55 : 0.35)}`,
        background: hov && !disabled ? hex2rgba(accent, 0.14) : hex2rgba(accent, 0.08),
        color: accent, transition: "all 0.15s",
        boxShadow: hov && !disabled ? `0 0 16px ${hex2rgba(accent, 0.2)}` : "none",
      }}
    >
      {children}
    </motion.button>
  );
}

/* ══════════════════════════════════════════
   MAIN — original logic untouched
══════════════════════════════════════════ */
export default function Round2Page() {
  const navigate = useNavigate();
  const round2Config = ROUND_CONFIG.round2;

  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState("");
  const [status,      setStatus]      = useState(null);
  const [activeSub,   setActiveSub]   = useState("subA");
  const [selection,   setSelection]   = useState(DEFAULT_SELECT);
  const [problem,     setProblem]     = useState(null);
  const [code,        setCode]        = useState("");
  const [consoleData, setConsoleData] = useState(null);

  const subStatus    = getSubMeta(status, activeSub);
  const subBUnlocked = Boolean(status?.subA?.isSubmitted);
  const visibleSubs  = subBUnlocked ? SUBS : [SUBS[0]];

  const fetchStatus = useCallback(async () => {
    const payload = await getRound2Result();
    setStatus(payload);
    if (payload?.activeSub === "subB" && !payload?.subA?.isSubmitted) {
      setActiveSub("subA");
    } else if (payload?.activeSub) {
      setActiveSub(payload.activeSub);
    }
    return payload;
  }, []);

  const loadStartedProblem = useCallback(async (subKey) => {
    const startApi = subKey === "subA" ? startRound2SubA : startRound2SubB;
    const payload  = await startApi({});
    setProblem(payload.problem || null);
    setCode(payload.code || payload.problem?.starterCode || "");
    setSelection((prev) => ({
      ...prev,
      [subKey]: {
        difficulty: payload.sub?.difficulty || prev[subKey].difficulty,
        language:   payload.sub?.language   || prev[subKey].language
      }
    }));
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const payload     = await fetchStatus();
        if (!active) return;
        const initialSub       = payload?.activeSub || "subA";
        const initialSubStatus = getSubMeta(payload, initialSub);
        if (initialSubStatus.isStarted && !initialSubStatus.isSubmitted) {
          await loadStartedProblem(initialSub);
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
  }, [fetchStatus, loadStartedProblem]);

  useEffect(() => {
    let active = true;
    const hydrateActiveSub = async () => {
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
    void hydrateActiveSub();
    return () => { active = false; };
  }, [activeSub, loading, status, subBUnlocked]);

  const difficultyOptions = useMemo(
    () => Object.entries(round2Config.difficultyPoints).map(([key, points]) => ({
      key, label: key.charAt(0).toUpperCase() + key.slice(1), points
    })),
    [round2Config.difficultyPoints]
  );

  const currentLanguageKey = subStatus.language || selection[activeSub].language;
  const monacoLanguage     = LANGUAGE_META[currentLanguageKey]?.monaco || "cpp";
  const bothSubmitted      = Boolean(status?.subA?.isSubmitted && status?.subB?.isSubmitted);
  const canMoveRound3      = Boolean(status?.subB?.isSubmitted);
  const lockSelection      = subStatus.isStarted;

  const handleSelect = (field, value) => {
    if (lockSelection) return;
    setSelection((prev) => ({ ...prev, [activeSub]: { ...prev[activeSub], [field]: value } }));
  };

  const handleStart = async () => {
    setBusy(true); setError(""); setConsoleData(null);
    try {
      const startApi = activeSub === "subA" ? startRound2SubA : startRound2SubB;
      const payload  = await startApi({ difficulty: selection[activeSub].difficulty, language: selection[activeSub].language });
      setProblem(payload.problem || null);
      setCode(payload.code || payload.problem?.starterCode || "");
      await fetchStatus();
    } catch (err) {
      setError(getApiErrorMessage(err, `Unable to start ${activeSub}.`));
    } finally { setBusy(false); }
  };

  const handleExecute = async (mode) => {
    if (!problem) return;
    setBusy(true); setError(""); setConsoleData(null);
    try {
      const submitApi = activeSub === "subA" ? submitRound2SubA : submitRound2SubB;
      const payload   = await submitApi({ code, mode });
      setConsoleData(payload);
      if (mode === "submit") {
        const nextStatus = await fetchStatus();
        if (nextStatus?.activeSub && nextStatus.activeSub !== activeSub) setActiveSub(nextStatus.activeSub);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Execution failed."));
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingSkeleton />;

  /* ── DIFF COLOUR MAP ── */
  const DIFF_ACCENT = { easy: "#34d399", medium: "#fb923c", hard: "#f87171" };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: "flex", flexDirection: "column", gap: "14px",
        color: "#e2e8f0", ...mono }}
    >

      {/* ── HEADER ── */}
      <div style={{ ...card, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
        <ScanLine color="#a78bfa" />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg,transparent,rgba(167,139,250,0.45),rgba(56,189,248,0.3),transparent)" }} />
        <motion.div
          animate={{ height: ["30%", "70%", "30%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            width: "3px", borderRadius: "0 3px 3px 0",
            background: "linear-gradient(to bottom,transparent,#a78bfa,transparent)" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "14px", position: "relative", zIndex: 1 }}>
          <div>
            <p style={{ ...lbl, color: "rgba(167,139,250,0.65)" }}>Team · Round 2</p>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9",
              marginTop: "5px", letterSpacing: "-0.01em" }}>Coding Engine</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px 16px", borderRadius: "10px",
              background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <p style={{ ...lbl, fontSize: "8px", color: "rgba(167,139,250,0.6)", marginBottom: "3px" }}>Total Score</p>
              <p style={{ ...mono, fontSize: "18px", fontWeight: 700, color: "#a78bfa", letterSpacing: "-0.01em" }}>
                {status?.totalScore || 0}
                <span style={{ fontSize: "11px", color: "rgba(167,139,250,0.5)", fontWeight: 400 }}>
                  &nbsp;/ {round2Config.maxScore}
                </span>
              </p>
            </div>
            {canMoveRound3 && (
              <ActionBtn accent="#34d399" onClick={() => navigate("/team/round3")}>
                Go to Round 3 →
              </ActionBtn>
            )}
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: "10px 16px", borderRadius: "10px",
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)",
            display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "#f87171", fontSize: "12px", flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: "12px", color: "#fca5a5", flex: 1 }}>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none",
            color: "rgba(148,163,184,0.5)", cursor: "pointer", fontSize: "14px", padding: 0 }}>✕</button>
        </motion.div>
      )}

      {/* ── SUB TABS ── */}
      <div style={{ ...card, padding: "14px 16px", display: "flex", gap: "10px", flexWrap: "wrap",
        alignItems: "center" }}>
        <p style={{ ...lbl, marginRight: "4px" }}>Sub-problem</p>
        {visibleSubs.map((sub) => {
          const meta   = getSubMeta(status, sub.key);
          const active = activeSub === sub.key;
          const accent = active ? "#38bdf8" : "rgba(148,163,184,0.5)";
          return (
            <motion.button key={sub.key} type="button"
              whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={() => setActiveSub(sub.key)}
              style={{
                ...mono, borderRadius: "10px", padding: "10px 16px", cursor: "pointer",
                border: active ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.02)",
                textAlign: "left", minWidth: "160px", transition: "all 0.15s",
                boxShadow: active ? "0 0 12px rgba(56,189,248,0.12)" : "none",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <motion.span animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: meta.isSubmitted ? 1 : 1.8, repeat: Infinity }}
                  style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                    background: meta.isSubmitted ? "#34d399" : meta.isStarted ? "#38bdf8" : "rgba(100,116,139,0.5)",
                    boxShadow: meta.isStarted && !meta.isSubmitted ? "0 0 6px rgba(56,189,248,0.8)" : "none" }} />
                <span style={{ fontSize: "12px", fontWeight: 700,
                  color: active ? "#7dd3fc" : "rgba(226,232,240,0.8)" }}>{sub.label}</span>
              </div>
              <div style={{ ...lbl, fontSize: "8px", marginTop: "5px",
                color: meta.isSubmitted ? "rgba(52,211,153,0.7)" : meta.isStarted ? "rgba(56,189,248,0.6)" : "rgba(100,116,139,0.5)" }}>
                {meta.isSubmitted ? `Submitted · ${meta.score} pts` : meta.isStarted ? "In Progress" : "Not Started"}
              </div>
            </motion.button>
          );
        })}

        {!subBUnlocked && (
          <div style={{ ...mono, borderRadius: "10px", padding: "10px 16px", minWidth: "160px",
            border: "1px dashed rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.01)",
            opacity: 0.6 }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(148,163,184,0.5)" }}>
              Sub B
            </div>
            <div style={{ ...lbl, fontSize: "8px", marginTop: "5px" }}>
              Submit Sub A to unlock
            </div>
          </div>
        )}
      </div>

      {/* ── START PANEL ── */}
      {!subStatus.isStarted && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...card, padding: "22px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.35),transparent)" }} />

          <p style={{ ...lbl, color: "rgba(56,189,248,0.65)", marginBottom: "18px" }}>
            Configure {activeSub.toUpperCase()}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" }}>
            {/* Difficulty */}
            <div>
              <p style={{ ...lbl, fontSize: "8px", marginBottom: "10px" }}>Difficulty</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {difficultyOptions.map((item) => (
                  <PillBtn key={item.key}
                    active={selection[activeSub].difficulty === item.key}
                    accent={DIFF_ACCENT[item.key] || "#38bdf8"}
                    onClick={() => handleSelect("difficulty", item.key)}
                    disabled={lockSelection}>
                    {item.label}
                    <span style={{ marginLeft: "6px", opacity: 0.6, fontSize: "9px" }}>
                      {item.points} pts
                    </span>
                  </PillBtn>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <p style={{ ...lbl, fontSize: "8px", marginBottom: "10px" }}>Language</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {round2Config.allowedLanguages.map((langKey) => (
                  <PillBtn key={langKey}
                    active={selection[activeSub].language === langKey}
                    accent="#a78bfa"
                    onClick={() => handleSelect("language", langKey)}
                    disabled={lockSelection}>
                    {LANGUAGE_META[langKey]?.label || langKey}
                  </PillBtn>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "22px", paddingTop: "18px",
            borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <ActionBtn
              accent="#38bdf8"
              disabled={busy || (activeSub === "subB" && !status?.subA?.isSubmitted)}
              onClick={handleStart}>
              {busy ? "Starting…" : `Start ${activeSub.toUpperCase()}`}
            </ActionBtn>
          </div>
        </motion.div>
      )}

      {/* ── CODING AREA ── */}
      {subStatus.isStarted && !subStatus.isSubmitted && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "14px" }}>

          {/* Problem panel */}
          <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden",
            maxHeight: "700px" }}>
            {/* Panel header */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)", flexShrink: 0 }}>
              <p style={{ ...lbl, color: "rgba(56,189,248,0.6)", fontSize: "8px" }}>
                {activeSub.toUpperCase()} · Problem
              </p>
              <p style={{ ...mono, fontSize: "15px", fontWeight: 700, color: "#f1f5f9", marginTop: "5px" }}>
                {problem?.title || "Loading…"}
              </p>
            </div>

            {/* Scrollable body */}
            <div style={{ padding: "16px 18px", overflowY: "auto", flex: 1,
              scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
              <p style={{ fontSize: "12px", lineHeight: 1.8, color: "rgba(203,213,225,0.82)" }}>
                {problem?.description}
              </p>

              {!!problem?.inputFormat && (
                <div style={{ marginTop: "16px" }}>
                  <p style={{ ...lbl, fontSize: "8px", marginBottom: "8px" }}>Input Format</p>
                  <pre style={{ borderRadius: "8px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)", padding: "10px 12px",
                    fontSize: "11px", whiteSpace: "pre-wrap", color: "rgba(203,213,225,0.75)" }}>
                    {problem.inputFormat}
                  </pre>
                </div>
              )}

              {!!problem?.outputFormat && (
                <div style={{ marginTop: "16px" }}>
                  <p style={{ ...lbl, fontSize: "8px", marginBottom: "8px" }}>Output Format</p>
                  <pre style={{ borderRadius: "8px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)", padding: "10px 12px",
                    fontSize: "11px", whiteSpace: "pre-wrap", color: "rgba(203,213,225,0.75)" }}>
                    {problem.outputFormat}
                  </pre>
                </div>
              )}

              {Array.isArray(problem?.visibleTestCases) && problem.visibleTestCases.length > 0 && (
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ ...lbl, fontSize: "8px" }}>Visible Test Cases</p>
                  {problem.visibleTestCases.map((tc, idx) => (
                    <div key={`${activeSub}-visible-${idx}`} style={{
                      borderRadius: "9px", background: "rgba(56,189,248,0.04)",
                      border: "1px solid rgba(56,189,248,0.18)", padding: "12px 14px" }}>
                      <p style={{ ...lbl, fontSize: "7px", marginBottom: "6px" }}>Case {idx + 1} · Input</p>
                      <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap",
                        color: "rgba(203,213,225,0.8)" }}>{tc.input}</pre>
                      <p style={{ ...lbl, fontSize: "7px", margin: "10px 0 6px" }}>Expected Output</p>
                      <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap",
                        color: "rgba(203,213,225,0.8)" }}>{tc.output}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor panel */}
          <div style={{ ...card, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Editor toolbar */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)", display: "flex",
              alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ ...lbl, fontSize: "8px" }}>Language</span>
                <span style={{ ...mono, fontSize: "11px", fontWeight: 600, color: "#a78bfa",
                  padding: "3px 10px", borderRadius: "999px",
                  background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
                  {LANGUAGE_META[currentLanguageKey]?.label || currentLanguageKey}
                </span>
              </div>
              <span style={{ ...lbl, fontSize: "8px",
                color: subStatus.isSubmitted ? "rgba(251,191,36,0.7)" : "rgba(52,211,153,0.6)" }}>
                {subStatus.isSubmitted ? "Submitted — Read Only" : "● Editable"}
              </span>
            </div>

            {/* Monaco */}
            <div style={{ flex: 1, minHeight: 0, height: "430px" }}>
              <Editor
                height="100%"
                language={monacoLanguage}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{
                  minimap: { enabled: false }, fontSize: 13,
                  automaticLayout: true, scrollBeyondLastLine: false,
                  readOnly: subStatus.isSubmitted,
                  fontFamily: "'DM Mono','Fira Code',monospace",
                }}
              />
            </div>

            {/* Action bar */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 16px",
              display: "flex", gap: "8px", flexWrap: "wrap",
              background: "rgba(255,255,255,0.01)", flexShrink: 0 }}>
              <ActionBtn accent="rgba(203,213,225,0.7)"
                onClick={() => void handleExecute("run")}
                disabled={busy || subStatus.isSubmitted}>
                {busy ? "Running…" : "Run Visible Tests"}
              </ActionBtn>
              <ActionBtn accent="#38bdf8"
                onClick={() => void handleExecute("submit")}
                disabled={busy || subStatus.isSubmitted}>
                {busy ? "Submitting…" : "Submit Final"}
              </ActionBtn>
            </div>

            {/* Console */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px",
              background: "rgba(0,0,0,0.28)", flexShrink: 0 }}>
              <p style={{ ...lbl, fontSize: "8px", marginBottom: "10px",
                color: consoleData
                  ? isOutputSuccess(consoleData) ? "rgba(52,211,153,0.8)" : "rgba(248,113,113,0.8)"
                  : "rgba(148,163,184,0.45)" }}>
                Output Console
                {consoleData && (
                  <span style={{ marginLeft: "8px", padding: "2px 8px", borderRadius: "999px",
                    background: isOutputSuccess(consoleData) ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                    border: `1px solid ${isOutputSuccess(consoleData) ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                    color: isOutputSuccess(consoleData) ? "#34d399" : "#f87171" }}>
                    {isOutputSuccess(consoleData) ? "Passed" : "Failed"}
                  </span>
                )}
              </p>

              {!consoleData && (
                <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)" }}>
                  Run or submit to see test execution results.
                </p>
              )}

              {consoleData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {consoleData?.visible?.results?.map((item) => (
                    <div key={`${activeSub}-${consoleData.mode}-${item.caseNo}`}
                      style={{ borderRadius: "8px", padding: "9px 12px",
                        border: item.passed ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(248,113,113,0.25)",
                        background: item.passed ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)" }}>
                      <div style={{ ...mono, fontSize: "11px", fontWeight: 600,
                        color: item.passed ? "#34d399" : "#f87171" }}>
                        Case {item.caseNo} · {item.passed ? "Passed" : "Failed"}
                        <span style={{ fontWeight: 400, color: "rgba(148,163,184,0.6)",
                          marginLeft: "8px", fontSize: "10px" }}>({item.status})</span>
                      </div>
                      {!item.passed && item.error && (
                        <pre style={{ marginTop: "6px", fontSize: "10px", whiteSpace: "pre-wrap",
                          color: "rgba(252,165,165,0.8)" }}>{item.error}</pre>
                      )}
                    </div>
                  ))}

                  {consoleData.mode === "submit" && (
                    <div style={{ padding: "8px 12px", borderRadius: "8px",
                      background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
                      <p style={{ ...mono, fontSize: "11px", color: "rgba(167,139,250,0.85)" }}>
                        Hidden tests: {consoleData.hidden?.passed || 0} / {consoleData.hidden?.total || 0} passed
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── RESULT BANNER ── */}
      {(subStatus.isSubmitted || bothSubmitted) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...card, padding: "18px 22px", position: "relative", overflow: "hidden",
            border: `1px solid ${subStatus.passed ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.2)"}` }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: subStatus.passed
              ? "linear-gradient(90deg,transparent,rgba(52,211,153,0.5),transparent)"
              : "linear-gradient(90deg,transparent,rgba(248,113,113,0.4),transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ ...lbl, color: subStatus.passed ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.6)",
                marginBottom: "6px" }}>{activeSub.toUpperCase()} Result</p>
              <p style={{ ...mono, fontSize: "15px", fontWeight: 700,
                color: subStatus.passed ? "#34d399" : "#f87171" }}>
                {subStatus.passed ? "Passed" : "Failed"}
                <span style={{ ...mono, fontSize: "13px", fontWeight: 400,
                  color: "rgba(203,213,225,0.7)", marginLeft: "12px" }}>
                  {subStatus.score} pts
                </span>
              </p>
            </div>
            {bothSubmitted && (
              <div style={{ padding: "10px 16px", borderRadius: "10px",
                background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <p style={{ ...lbl, fontSize: "8px", color: "rgba(167,139,250,0.6)", marginBottom: "4px" }}>
                  Round 2 Complete
                </p>
                <p style={{ ...mono, fontSize: "14px", fontWeight: 700, color: "#a78bfa" }}>
                  {status?.totalScore || 0}
                  <span style={{ fontSize: "10px", fontWeight: 400, color: "rgba(167,139,250,0.5)" }}>
                    &nbsp;/ {round2Config.maxScore} pts
                  </span>
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

    </motion.section>
  );
}