import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/httpClient";
import { getMyLifelineStatus, requestLifeline } from "../../api/lifelineApi";

/* ─── DATA ─── */
const BUGGY_CODE = `// Memory Leak Patch — Fix the array reference
const processQueue = (items) => {
  let results = [];
  for (let i = 0; i <= items.length; i++) { // ← Bug 1
    results.push(items[i] * 2);
  }
  return result; // ← Bug 2
};`;

const DEFAULT_PATCH = `const processQueue = (items) => {
  let results = [];
  for (let i = 0; i < items.length; i++) {
    results.push(items[i] * 2);
  }
  return results;
};`;

const BUGS = [
  { id:1, line:"i <= items.length", fix:"i < items.length",  desc:"Off-by-one error — loop runs past array bounds, causing undefined × 2 = NaN on the last iteration.", accent:"#f87171" },
  { id:2, line:"return result",     fix:"return results",    desc:"Undefined variable — `result` was never declared. The correct variable name is `results`.",              accent:"#fb923c" },
];

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba=(hex,a)=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${a})`;};

/* ─── SCAN LINE ─── */
function ScanLine({ color="#f87171" }) {
  return (
    <motion.div
      animate={{ top:["0%","100%"] }}
      transition={{ duration:3, repeat:Infinity, ease:"linear", repeatDelay:1.5 }}
      style={{
        position:"absolute", left:0, right:0, height:"1px",
        pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,0.2)},transparent)`,
      }}
    />
  );
}

/* ─── BUG CARD ─── */
function BugCard({ bug, solved, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      layout
      style={{
        borderRadius:"10px", overflow:"hidden",
        border: solved
          ? "1px solid rgba(52,211,153,0.28)"
          : `1px solid ${hex2rgba(bug.accent,0.28)}`,
        background: solved
          ? "rgba(52,211,153,0.06)"
          : hex2rgba(bug.accent, 0.06),
        transition:"all 0.25s",
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded(p=>!p)}
        style={{
          display:"flex", alignItems:"center", gap:"10px",
          padding:"11px 14px", cursor:"pointer",
        }}
      >
        {/* Status indicator */}
        <motion.div
          animate={{ scale: solved ? [1,1.2,1] : 1 }}
          transition={{ duration:0.35 }}
          style={{
            width:"20px", height:"20px", borderRadius:"6px", flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background: solved ? "rgba(52,211,153,0.18)" : hex2rgba(bug.accent,0.15),
            border: solved ? "1px solid rgba(52,211,153,0.4)" : `1px solid ${hex2rgba(bug.accent,0.35)}`,
            fontSize:"10px",
            color: solved ? "#34d399" : bug.accent,
            transition:"all 0.2s",
          }}
        >
          {solved ? "✓" : bug.id}
        </motion.div>

        <div style={{ flex:1 }}>
          <p style={{ ...mono, fontSize:"11px", fontWeight:600, color: solved ? "#6ee7b7" : bug.accent, marginBottom:"2px" }}>
            Bug {bug.id}{solved ? " — Fixed" : " — Detected"}
          </p>
          <code style={{
            ...mono, fontSize:"10px",
            color: solved ? "rgba(110,231,183,0.55)" : hex2rgba(bug.accent,0.65),
            background: solved ? "rgba(52,211,153,0.07)" : hex2rgba(bug.accent,0.07),
            padding:"1px 7px", borderRadius:"4px",
            textDecoration: solved ? "line-through" : "none",
            transition:"all 0.2s",
          }}>
            {bug.line}
          </code>
        </div>

        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          style={{ color:"rgba(148,163,184,0.35)", fontSize:"12px", flexShrink:0 }}
        >›</motion.span>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ duration:0.22 }}
            style={{ overflow:"hidden" }}
          >
            <div style={{
              padding:"0 14px 12px 44px",
              borderTop:`1px solid ${solved ? "rgba(52,211,153,0.1)" : hex2rgba(bug.accent,0.1)}`,
            }}>
              <p style={{ fontSize:"11.5px", lineHeight:1.7, color:"rgba(203,213,225,0.55)", marginTop:"10px", fontFamily:"'Inter',sans-serif" }}>
                {bug.desc}
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"10px" }}>
                <span style={{ ...lbl, fontSize:"8px", color:"rgba(148,163,184,0.35)" }}>Fix:</span>
                <code style={{
                  ...mono, fontSize:"10px",
                  color:"#34d399", background:"rgba(52,211,153,0.07)",
                  border:"1px solid rgba(52,211,153,0.18)",
                  padding:"2px 8px", borderRadius:"5px",
                }}>
                  {bug.fix}
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── MAIN ─── */
export default function Round3Page() {
  const navigate = useNavigate();
  const [patch, setPatch]           = useState(DEFAULT_PATCH);
  const [askingHelp, setAskingHelp] = useState(false);
  const [lifelineUsed, setLifelineUsed] = useState(false);
  const [lifelinePending, setLifelinePending] = useState(false);
  const [lifelineBusy, setLifelineBusy] = useState(false);
  const [lifelineError, setLifelineError] = useState("");
  const [lifelineNote, setLifelineNote] = useState("");
  const [verified, setVerified]     = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [solvedBugs, setSolvedBugs] = useState({ 1:false, 2:false });
  const [saved, setSaved]           = useState(false);
  const saveTimer = useRef(null);

  const allFixed = solvedBugs[1] && solvedBugs[2];

  const handleCodeChange = (val) => {
    const v = val ?? "";
    setPatch(v);
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaved(true), 1500);

    // Auto-detect fixes
    const hasFix1 = v.includes("i < items.length") && !v.includes("i <= items.length");
    const hasFix2 = v.includes("return results") && !v.includes("return result;");
    setSolvedBugs({ 1:hasFix1, 2:hasFix2 });
    if (hasFix1 || hasFix2) setVerified(false);
  };

  const handleVerify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1600);
  };

  const syncLifeline = async () => {
    const payload = await getMyLifelineStatus("round3");
    const used = Boolean(payload?.used);
    const pending = payload?.request?.status === "pending";
    setLifelineUsed(used);
    setLifelinePending(pending && !used);

    if (used) {
      setLifelineNote("Lifeline approved by admin. Penalty has been applied.");
    } else if (pending) {
      setLifelineNote("Lifeline request pending admin approval.");
    } else {
      setLifelineNote("");
    }
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await syncLifeline();
        if (!active) return;
        setLifelineError("");
      } catch (err) {
        if (!active) return;
        setLifelineError(getApiErrorMessage(err, "Unable to load lifeline status."));
      }
    };

    void bootstrap();
    const pollId = setInterval(() => {
      void bootstrap();
    }, 10000);

    return () => {
      active = false;
      clearInterval(pollId);
    };
  }, []);

  const handleLifelineRequest = async () => {
    if (lifelineUsed || lifelinePending || lifelineBusy) {
      setAskingHelp(false);
      return;
    }

    setLifelineBusy(true);
    setLifelineError("");
    try {
      await requestLifeline("round3");
      await syncLifeline();
      setLifelineNote("Lifeline request sent to admin for approval.");
    } catch (err) {
      setLifelineError(getApiErrorMessage(err, "Unable to request lifeline."));
    } finally {
      setAskingHelp(false);
      setLifelineBusy(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"12px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── ALERT BANNER ── */}
      <motion.div
        animate={{ opacity:[0.85,1,0.85] }}
        transition={{ duration:2.5, repeat:Infinity }}
        style={{
          padding:"10px 18px", borderRadius:"10px",
          background:"rgba(248,113,113,0.07)",
          border:"1px solid rgba(248,113,113,0.25)",
          display:"flex", alignItems:"center", gap:"10px",
        }}
      >
        <motion.span
          animate={{ opacity:[1,0.2,1] }}
          transition={{ duration:1.2, repeat:Infinity }}
          style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#f87171", boxShadow:"0 0 8px rgba(248,113,113,0.9)", flexShrink:0 }}
        />
        <span style={{ ...mono, fontSize:"10px", letterSpacing:"0.18em", textTransform:"uppercase", color:"#fca5a5", fontWeight:600 }}>
          Critical Alert
        </span>
        <span style={{ ...lbl, fontSize:"9px", color:"rgba(248,113,113,0.6)" }}>
          · 2 deliberate bugs detected in source — patch and verify to proceed
        </span>
        <div style={{ marginLeft:"auto", display:"flex", gap:"8px" }}>
          {[1,2].map(n => (
            <span key={n} style={{
              ...mono, fontSize:"9px", fontWeight:700,
              padding:"2px 9px", borderRadius:"999px",
              color: solvedBugs[n] ? "#34d399" : "#f87171",
              background: solvedBugs[n] ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
              border: solvedBugs[n] ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(248,113,113,0.25)",
              transition:"all 0.3s",
            }}>
              B{n} {solvedBugs[n] ? "✓" : "✗"}
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── MAIN GRID ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", minHeight:"560px" }}>

        {/* ── LEFT: CORRUPTED FILE PANEL ── */}
        <div style={{ ...card, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
          <ScanLine color="#f87171" />
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:"2px",
            background:"linear-gradient(90deg,transparent,rgba(248,113,113,0.5),transparent)",
          }}/>

          {/* Header */}
          <div style={{
            padding:"12px 18px",
            borderBottom:"1px solid rgba(255,255,255,0.07)",
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"11px" }}>🐛</span>
              <p style={{ ...mono, fontSize:"11px", fontWeight:700, color:"#fca5a5" }}>target.js</p>
              <span style={{
                ...lbl, fontSize:"8px", padding:"2px 8px", borderRadius:"999px",
                color:"#f87171", background:"rgba(248,113,113,0.09)", border:"1px solid rgba(248,113,113,0.22)",
              }}>Corrupted</span>
            </div>
            <span style={{ ...lbl, fontSize:"8px" }}>Read-only</span>
          </div>

          {/* Code display */}
          <div style={{ flex:1, padding:"16px 18px", overflowY:"auto" }}>
            <pre style={{
              ...mono, fontSize:"12px", lineHeight:1.9,
              color:"rgba(252,165,165,0.7)",
              margin:0, whiteSpace:"pre-wrap",
            }}>
              {BUGGY_CODE.split("\n").map((line, i) => {
                const isBug1 = line.includes("<=");
                const isBug2 = line.includes("return result;");
                return (
                  <div key={i} style={{
                    background: (isBug1||isBug2) ? "rgba(248,113,113,0.08)" : "transparent",
                    borderLeft: (isBug1||isBug2) ? "2px solid rgba(248,113,113,0.5)" : "2px solid transparent",
                    paddingLeft:"8px", marginLeft:"-8px",
                    borderRadius:"3px",
                    transition:"all 0.2s",
                  }}>
                    <span style={{ color:"rgba(100,116,139,0.35)", marginRight:"16px", userSelect:"none", fontSize:"10px" }}>
                      {String(i+1).padStart(2," ")}
                    </span>
                    <span style={{ color:(isBug1||isBug2) ? "#fca5a5" : "rgba(252,165,165,0.65)" }}>
                      {line}
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>

          {/* Bug cards */}
          <div style={{
            padding:"12px 14px", borderTop:"1px solid rgba(255,255,255,0.07)",
            display:"flex", flexDirection:"column", gap:"7px",
            background:"rgba(0,0,0,0.2)",
          }}>
            <p style={{ ...lbl, marginBottom:"4px" }}>Detected Bugs</p>
            {BUGS.map(bug => (
              <BugCard key={bug.id} bug={bug} solved={solvedBugs[bug.id]} />
            ))}
          </div>
        </div>

        {/* ── RIGHT: INJECTION TERMINAL ── */}
        <div style={{ ...card, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:"2px",
            background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.4),transparent)",
          }}/>

          {/* Header */}
          <div style={{
            padding:"12px 18px",
            borderBottom:"1px solid rgba(255,255,255,0.07)",
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"11px" }}>⚡</span>
              <p style={{ ...mono, fontSize:"11px", fontWeight:700, color:"#7dd3fc" }}>patch.js</p>
              <span style={{
                ...lbl, fontSize:"8px", padding:"2px 8px", borderRadius:"999px",
                color:"#38bdf8", background:"rgba(56,189,248,0.09)", border:"1px solid rgba(56,189,248,0.22)",
              }}>Injection Terminal</span>
            </div>
            <motion.span
              animate={{ opacity: saved ? 1 : [0.3,0.8,0.3] }}
              transition={{ duration: saved ? 0 : 1.5, repeat: saved ? 0 : Infinity }}
              style={{ ...lbl, fontSize:"8px", color: saved ? "#34d399" : "rgba(251,146,60,0.6)" }}
            >
              {saved ? "◉ Saved" : "◌ Saving..."}
            </motion.span>
          </div>

          {/* Monaco */}
          <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language="javascript"
              value={patch}
              onChange={handleCodeChange}
              options={{
                minimap:{ enabled:false },
                fontSize:13,
                fontFamily:"DM Mono, Fira Code, monospace",
                smoothScrolling:true,
                automaticLayout:true,
                scrollBeyondLastLine:false,
                padding:{ top:14, bottom:14 },
                lineNumbersMinChars:3,
                renderLineHighlight:"gutter",
              }}
            />
          </div>

          {/* Verify result */}
          <AnimatePresence>
            {verified && (
              <motion.div
                initial={{ opacity:0, height:0 }}
                animate={{ opacity:1, height:"auto" }}
                exit={{ opacity:0, height:0 }}
                style={{
                  overflow:"hidden",
                  padding:"10px 18px",
                  borderTop:"1px solid rgba(52,211,153,0.15)",
                  background:"rgba(52,211,153,0.05)",
                }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <motion.span
                    initial={{ scale:0 }} animate={{ scale:1 }}
                    transition={{ type:"spring", stiffness:400, damping:18 }}
                    style={{ fontSize:"14px" }}
                  >✓</motion.span>
                  <span style={{ ...mono, fontSize:"11px", fontWeight:600, color:"#34d399" }}>
                    {allFixed ? "All bugs patched — ready to finalize." : "Partial fix detected — review remaining bugs."}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action bar */}
          <div style={{
            padding:"12px 16px",
            borderTop:"1px solid rgba(255,255,255,0.07)",
            background:"rgba(0,0,0,0.2)",
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", flexWrap:"wrap",
          }}>
            {/* Lifeline */}
            <motion.button
              type="button"
              whileTap={{ scale:0.97 }}
              onClick={() => setAskingHelp(true)}
              disabled={lifelineUsed || lifelinePending || lifelineBusy}
              style={{
                padding:"8px 16px", borderRadius:"9px",
                ...mono, fontSize:"10px", fontWeight:700,
                letterSpacing:"0.14em", textTransform:"uppercase",
                cursor: lifelineUsed || lifelinePending || lifelineBusy ? "not-allowed" : "pointer",
                border: lifelineUsed || lifelinePending || lifelineBusy ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(244,114,182,0.3)",
                background: lifelineUsed || lifelinePending || lifelineBusy ? "rgba(255,255,255,0.03)" : "rgba(244,114,182,0.08)",
                color: lifelineUsed || lifelinePending || lifelineBusy ? "rgba(255,255,255,0.2)" : "#f472b6",
                transition:"all 0.15s",
              }}
              onMouseEnter={e => { if(!(lifelineUsed || lifelinePending || lifelineBusy)){ e.currentTarget.style.background="rgba(244,114,182,0.15)"; e.currentTarget.style.borderColor="rgba(244,114,182,0.5)"; }}}
              onMouseLeave={e => { if(!(lifelineUsed || lifelinePending || lifelineBusy)){ e.currentTarget.style.background="rgba(244,114,182,0.08)"; e.currentTarget.style.borderColor="rgba(244,114,182,0.3)"; }}}
            >
              {lifelineUsed ? "Lifeline Approved" : lifelinePending ? "Request Pending" : lifelineBusy ? "Sending..." : "Ask Lifeline"}
            </motion.button>

            <div style={{ display:"flex", gap:"8px" }}>
              {/* Verify */}
              <motion.button
                type="button"
                whileTap={{ scale:0.97 }}
                onClick={handleVerify}
                style={{
                  padding:"8px 18px", borderRadius:"9px",
                  ...mono, fontSize:"10px", fontWeight:700,
                  letterSpacing:"0.14em", textTransform:"uppercase",
                  cursor:"pointer",
                  border:"1px solid rgba(255,255,255,0.1)",
                  background:"rgba(255,255,255,0.04)",
                  color:"rgba(226,232,240,0.75)",
                  transition:"all 0.15s",
                  display:"flex", alignItems:"center", gap:"6px",
                }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.color="#f1f5f9"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color="rgba(226,232,240,0.75)"; }}
              >
                {verifying ? (
                  <motion.span animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:"linear" }}>◌</motion.span>
                ) : "▶"}
                Verify
              </motion.button>

              {/* Finalize */}
              <motion.button
                type="button"
                whileTap={{ scale:0.97 }}
                onClick={() => navigate("/team/leaderboard")}
                style={{
                  padding:"8px 20px", borderRadius:"9px",
                  ...mono, fontSize:"10px", fontWeight:700,
                  letterSpacing:"0.14em", textTransform:"uppercase",
                  cursor:"pointer",
                  border: allFixed ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  background: allFixed ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.03)",
                  color: allFixed ? "#7dd3fc" : "rgba(255,255,255,0.3)",
                  transition:"all 0.15s",
                  boxShadow: allFixed ? "0 0 14px rgba(56,189,248,0.1)" : "none",
                }}
                onMouseEnter={e => { if(allFixed){ e.currentTarget.style.background="rgba(56,189,248,0.2)"; e.currentTarget.style.boxShadow="0 0 20px rgba(56,189,248,0.2)"; }}}
                onMouseLeave={e => { if(allFixed){ e.currentTarget.style.background="rgba(56,189,248,0.12)"; e.currentTarget.style.boxShadow="0 0 14px rgba(56,189,248,0.1)"; }}}
              >
                {allFixed ? "Patch & Finalize →" : "Fix Bugs First"}
              </motion.button>
            </div>
          </div>

          {(lifelineNote || lifelineError) && (
            <div
              style={{
                padding:"10px 16px",
                borderTop:"1px solid rgba(255,255,255,0.07)",
                background: lifelineError ? "rgba(248,113,113,0.08)" : "rgba(244,114,182,0.06)",
                color: lifelineError ? "#fca5a5" : "rgba(244,114,182,0.92)",
                fontSize:"11px",
              }}
            >
              {lifelineError || lifelineNote}
            </div>
          )}
        </div>
      </div>

      {/* ── LIFELINE MODAL ── */}
      <AnimatePresence>
        {askingHelp && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => e.target===e.currentTarget && setAskingHelp(false)}
            style={{
              position:"fixed", inset:0, zIndex:100,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(0,0,0,0.82)", backdropFilter:"blur(10px)", padding:"16px",
            }}
          >
            <motion.div
              initial={{ scale:0.94, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.94, y:20 }}
              transition={{ type:"spring", stiffness:360, damping:28 }}
              style={{
                width:"100%", maxWidth:"380px", borderRadius:"16px", overflow:"hidden",
                background:"#13161e",
                border:"1px solid rgba(244,114,182,0.25)",
                boxShadow:"0 40px 100px rgba(0,0,0,0.8), 0 0 40px rgba(244,114,182,0.07)",
              }}
            >
              <div style={{
                padding:"20px 22px 16px",
                borderBottom:"1px solid rgba(255,255,255,0.07)",
                background:"rgba(244,114,182,0.05)", position:"relative", overflow:"hidden",
              }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:"linear-gradient(90deg,transparent,rgba(244,114,182,0.5),transparent)" }}/>
                <p style={{ ...lbl, color:"rgba(244,114,182,0.6)", marginBottom:"6px" }}>Lifeline System</p>
                <h3 style={{ fontSize:"16px", fontWeight:700, color:"#fce7f3", margin:0 }}>Send Approval Request</h3>
              </div>

              <div style={{ padding:"20px 22px" }}>
                <p style={{ fontSize:"12.5px", lineHeight:1.75, color:"rgba(203,213,225,0.65)", fontFamily:"'Inter',sans-serif" }}>
                  Requesting a lifeline sends approval to admin. If approved, your score will get a{" "}
                  <strong style={{ color:"#f472b6" }}>−10 point</strong> penalty.
                </p>
                <div style={{
                  marginTop:"14px", padding:"10px 14px", borderRadius:"9px",
                  background:"rgba(244,114,182,0.07)", border:"1px solid rgba(244,114,182,0.2)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <span style={{ ...lbl, fontSize:"8px", color:"rgba(244,114,182,0.55)" }}>Score Impact</span>
                  <span style={{ ...mono, fontSize:"15px", fontWeight:700, color:"#f472b6" }}>−10 pts</span>
                </div>
              </div>

              <div style={{
                padding:"14px 22px", borderTop:"1px solid rgba(255,255,255,0.07)",
                background:"rgba(0,0,0,0.25)",
                display:"flex", gap:"10px", justifyContent:"flex-end",
              }}>
                <motion.button
                  whileTap={{ scale:0.97 }}
                  onClick={() => setAskingHelp(false)}
                  style={{
                    padding:"9px 20px", borderRadius:"9px",
                    ...mono, fontSize:"10px", fontWeight:600,
                    letterSpacing:"0.12em", textTransform:"uppercase",
                    cursor:"pointer",
                    border:"1px solid rgba(255,255,255,0.09)",
                    background:"transparent", color:"rgba(148,163,184,0.65)",
                    transition:"all 0.14s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="#e2e8f0"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(148,163,184,0.65)"; }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale:0.97 }}
                  onClick={() => { void handleLifelineRequest(); }}
                  disabled={lifelineUsed || lifelinePending || lifelineBusy}
                  style={{
                    padding:"9px 22px", borderRadius:"9px",
                    ...mono, fontSize:"10px", fontWeight:700,
                    letterSpacing:"0.14em", textTransform:"uppercase",
                    cursor: lifelineUsed || lifelinePending || lifelineBusy ? "not-allowed" : "pointer",
                    border:"1px solid rgba(244,114,182,0.35)",
                    background:"rgba(244,114,182,0.12)", color:"#f9a8d4",
                    transition:"all 0.14s", opacity: lifelineUsed || lifelinePending || lifelineBusy ? 0.6 : 1
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background="rgba(244,114,182,0.2)"; e.currentTarget.style.borderColor="rgba(244,114,182,0.55)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="rgba(244,114,182,0.12)"; e.currentTarget.style.borderColor="rgba(244,114,182,0.35)"; }}
                >
                  {lifelineBusy ? "Sending..." : lifelineUsed ? "Already Approved" : lifelinePending ? "Already Pending" : "Send Request"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
