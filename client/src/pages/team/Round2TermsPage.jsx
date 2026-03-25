import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getRound2Result } from "../../api/round2Api";
import { getApiErrorMessage } from "../../api/httpClient";
import { ROUND_CONFIG } from "../../data/roundConfig";

/* ─── RULES ─── */
const RULES = [
  "Round 2 has two sub-problems: Sub A and Sub B.",
  "Complete Sub A before Sub B unlocks.",
  "The overall round timer is 45 minutes.",
  "Only C++ and Java are allowed.",
  "Run tests before final submit.",
  "Final submissions update your Round 2 score immediately.",
];

/* ─── DESIGN TOKENS ─── */
const mono     = { fontFamily: "'DM Mono','Fira Code',monospace" };
const cardBase = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl      = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#a78bfa" }) {
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

/* ─── SKELETON LOADER ─── */
function SkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ ...cardBase, padding: "32px", display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent)"
      }} />

      {[40, 60, 90, 70, 50, 80].map((w, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
          style={{
            height: i === 0 ? "10px" : "14px", borderRadius: "7px",
            background: "rgba(255,255,255,0.07)", width: `${w}%`
          }}
        />
      ))}

      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
        <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }}
          style={{ width: "18px", height: "18px", borderRadius: "5px", background: "rgba(255,255,255,0.07)" }} />
        <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
          style={{ height: "12px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", width: "200px" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
        <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }}
          style={{ height: "36px", borderRadius: "10px", background: "rgba(167,139,250,0.08)", width: "160px" }} />
        <span style={{ ...lbl, fontSize: "8px" }}>Loading round status...</span>
      </div>
    </motion.div>
  );
}

/* ─── CONFIRM MODAL ─── */
function ConfirmModal({ durationLabel, onConfirm, onCancel, loading }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onCancel()}
      style={{
        position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", padding: "16px"
      }}
    >
      <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }} transition={{ type: "spring", stiffness: 360, damping: 28 }}
        style={{
          ...cardBase, width: "100%", maxWidth: "420px", overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)", border: "1px solid rgba(167,139,250,0.28)", position: "relative"
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg,transparent,rgba(167,139,250,0.55),transparent)"
        }} />

        {/* Header */}
        <div style={{
          padding: "20px 22px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(167,139,250,0.04)"
        }}>
          <p style={{ ...lbl, color: "rgba(167,139,250,0.65)", marginBottom: "5px" }}>Round 2 · Confirmation</p>
          <h3 style={{ ...mono, fontSize: "15px", fontWeight: 700, color: "#e9d5ff", margin: 0 }}>
            Ready to begin?
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px" }}>
          <div style={{
            display: "flex", gap: "12px", padding: "14px", borderRadius: "10px",
            background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", marginBottom: "14px"
          }}>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
              style={{
                width: "7px", height: "7px", borderRadius: "50%", background: "#a78bfa",
                boxShadow: "0 0 8px rgba(167,139,250,0.9)", flexShrink: 0, marginTop: "4px"
              }} />
            <div>
              <p style={{ ...mono, fontSize: "11px", fontWeight: 700, color: "#c4b5fd", marginBottom: "4px" }}>
                Timer starts immediately
              </p>
              <p style={{
                fontSize: "12px", lineHeight: 1.65, color: "rgba(203,213,225,0.6)",
                fontFamily: "'Inter',sans-serif", margin: 0
              }}>
                Once you click <strong style={{ color: "#a78bfa" }}>Enter Arena</strong>, the{" "}
                <strong style={{ color: "#c4b5fd" }}>{durationLabel}</strong> countdown begins and cannot be paused.
                Ensure your connection is stable.
              </p>
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)", fontFamily: "'Inter',sans-serif" }}>
            Tab switches are monitored. Three violations trigger an automatic submission.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.25)", display: "flex", gap: "10px", justifyContent: "flex-end"
        }}>
          <button onClick={onCancel} disabled={loading}
            style={{
              padding: "9px 20px", borderRadius: "9px", ...mono, fontSize: "10px", fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.09)", background: "transparent",
              color: "rgba(148,163,184,0.65)", transition: "all 0.14s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(148,163,184,0.65)"; }}
          >Cancel</button>

          <motion.button whileTap={{ scale: 0.97 }} onClick={onConfirm} disabled={loading}
            style={{
              padding: "9px 22px", borderRadius: "9px", ...mono, fontSize: "10px", fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              border: "1px solid rgba(167,139,250,0.38)", background: "rgba(167,139,250,0.14)",
              color: "#c4b5fd", transition: "all 0.14s",
              display: "flex", alignItems: "center", gap: "7px",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(167,139,250,0.24)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.6)"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(167,139,250,0.14)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.38)"; }}
          >
            {loading ? (
              <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>◌</motion.span> Starting...</>
            ) : "Enter Arena →"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function Round2TermsPage() {
  const navigate = useNavigate();
  const config   = ROUND_CONFIG.round2;

  const [agreed,        setAgreed]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error,         setError]         = useState("");
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [ruleExpanded,  setRuleExpanded]  = useState(null);

  const durationLabel = useMemo(() => "45 minutes", []);

  /* ── Load round status ── */
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const status = await getRound2Result();
        if (!active) return;

        if (status?.subA?.isSubmitted && status?.subB?.isSubmitted) {
          navigate(config.routes.result, { replace: true });
          return;
        }
        if (status?.subA?.isStarted || status?.subB?.isStarted) {
          navigate(config.routes.arena, { replace: true });
          return;
        }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load Round 2."));
      } finally {
        if (active) setStatusLoading(false);
      }
    };

    void bootstrap();
    return () => { active = false; };
  }, [config.routes.arena, config.routes.result, navigate]);

  /* ── Confirm → navigate ── */
  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      navigate(config.routes.arena, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to start Round 2."));
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  /* ── Render: loading skeleton ── */
  if (statusLoading) return <SkeletonLoader />;

  /* ── Render: main terms ── */
  return (
    <>
      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            durationLabel={durationLabel}
            loading={loading}
            onConfirm={handleConfirm}
            onCancel={() => !loading && setShowConfirm(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ display: "flex", flexDirection: "column", gap: "14px", ...mono, color: "#e2e8f0" }}
      >
        {/* ── HERO CARD ── */}
        <div style={{ ...cardBase, padding: "26px 28px", position: "relative", overflow: "hidden" }}>
          <ScanLine />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg,transparent,rgba(167,139,250,0.55),transparent)"
          }} />
          <motion.div
            animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{
              position: "absolute", top: "-50px", right: "-50px", width: "200px", height: "200px",
              borderRadius: "50%", background: "rgba(167,139,250,0.08)", filter: "blur(50px)", pointerEvents: "none"
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <p style={{ ...lbl, color: "rgba(167,139,250,0.65)" }}>{config.title}</p>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", marginTop: "8px", letterSpacing: "-0.01em" }}>
                  Terms &amp; Conditions
                </h2>
              </div>
              {/* Stats badges */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px",
                  borderRadius: "999px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.22)"
                }}>
                  <span style={{ ...lbl, fontSize: "8px", color: "rgba(167,139,250,0.6)" }}>Duration</span>
                  <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color: "#a78bfa" }}>{durationLabel}</span>
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px",
                  borderRadius: "999px", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.22)"
                }}>
                  <span style={{ ...lbl, fontSize: "8px", color: "rgba(56,189,248,0.6)" }}>Lang</span>
                  <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color: "#38bdf8" }}>C++ / Java</span>
                </div>
                {config.maxScore && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px",
                    borderRadius: "999px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)"
                  }}>
                    <span style={{ ...lbl, fontSize: "8px", color: "rgba(52,211,153,0.6)" }}>Max</span>
                    <span style={{ ...mono, fontSize: "12px", fontWeight: 700, color: "#34d399" }}>{config.maxScore} pts</span>
                  </div>
                )}
              </div>
            </div>
            <p style={{
              fontSize: "13px", lineHeight: 1.75, color: "rgba(148,163,184,0.55)", marginTop: "10px",
              fontFamily: "'Inter',sans-serif"
            }}>
              Review all rules carefully before entering the coding arena. Once you continue, the live Round 2 workflow begins.
            </p>
          </div>
        </div>

        {/* ── RULES ── */}
        <div style={{ ...cardBase, overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent)"
          }} />
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ ...lbl, color: "rgba(167,139,250,0.55)" }}>◈ Arena Protocol</p>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {RULES.map((rule, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                onClick={() => setRuleExpanded(ruleExpanded === i ? null : i)}
                style={{
                  borderRadius: "10px", cursor: "pointer", transition: "all 0.18s",
                  padding: ruleExpanded === i ? "12px 14px" : "10px 14px",
                  background: ruleExpanded === i ? "rgba(167,139,250,0.07)" : "rgba(255,255,255,0.02)",
                  border: ruleExpanded === i ? "1px solid rgba(167,139,250,0.25)" : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Number badge */}
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "7px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    ...mono, fontSize: "10px", fontWeight: 700,
                    background: ruleExpanded === i ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                    border: ruleExpanded === i ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.07)",
                    color: ruleExpanded === i ? "#a78bfa" : "rgba(148,163,184,0.45)",
                    transition: "all 0.18s",
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <span style={{ fontSize: "12.5px", color: "rgba(226,232,240,0.78)", flex: 1, lineHeight: 1.5 }}>
                    {rule}
                  </span>
                  <motion.span animate={{ rotate: ruleExpanded === i ? 90 : 0 }}
                    style={{ color: "rgba(148,163,184,0.3)", fontSize: "12px", flexShrink: 0 }}>›</motion.span>
                </div>

                <AnimatePresence>
                  {ruleExpanded === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{
                        marginTop: "10px", marginLeft: "38px", padding: "8px 12px",
                        borderRadius: "7px", background: "rgba(248,113,113,0.06)",
                        border: "1px solid rgba(248,113,113,0.15)"
                      }}>
                        <p style={{
                          ...mono, fontSize: "10px", letterSpacing: "0.08em",
                          color: "rgba(252,165,165,0.7)", margin: 0
                        }}>
                          ▹ Violation may result in immediate disqualification.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── AGREEMENT + CTA ── */}
        <div style={{ ...cardBase, padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Checkbox */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
            <div onClick={() => setAgreed(p => !p)} style={{
              width: "18px", height: "18px", borderRadius: "5px", flexShrink: 0, marginTop: "1px",
              border: agreed ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.18)",
              background: agreed ? "rgba(167,139,250,0.18)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", cursor: "pointer",
            }}>
              <AnimatePresence>
                {agreed && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    style={{ color: "#a78bfa", fontSize: "11px", lineHeight: 1 }}>✓</motion.span>
                )}
              </AnimatePresence>
            </div>
            <span style={{ fontSize: "12.5px", color: "rgba(203,213,225,0.72)", lineHeight: 1.6 }}>
              I have read and agree to the Round 2 rules and want to continue to the coding arena.
            </span>
          </label>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  padding: "10px 14px", borderRadius: "9px", display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.28)"
                }}>
                <span style={{ color: "#f87171", fontSize: "12px", flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: "12px", color: "#fca5a5", flex: 1 }}>{error}</span>
                <button onClick={() => setError("")} style={{
                  background: "none", border: "none",
                  color: "rgba(148,163,184,0.45)", cursor: "pointer", fontSize: "14px", flexShrink: 0
                }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA row */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <motion.button type="button" whileTap={{ scale: 0.97 }}
              disabled={!agreed || loading}
              onClick={() => setShowConfirm(true)}
              style={{
                padding: "11px 28px", borderRadius: "10px",
                fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                cursor: agreed && !loading ? "pointer" : "not-allowed",
                border: agreed ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(255,255,255,0.07)",
                background: agreed ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                color: agreed ? "#c4b5fd" : "rgba(255,255,255,0.22)",
                transition: "all 0.15s", opacity: agreed ? 1 : 0.5, ...mono,
                display: "flex", alignItems: "center", gap: "8px",
              }}
              onMouseEnter={e => { if (agreed) { e.currentTarget.style.background = "rgba(167,139,250,0.2)"; e.currentTarget.style.boxShadow = "0 0 18px rgba(167,139,250,0.2)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = agreed ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              Initialize Round 2 →
            </motion.button>

            {/* Info tag */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "5px", height: "5px", borderRadius: "50%",
                background: agreed ? "#34d399" : "rgba(255,255,255,0.2)",
                boxShadow: agreed ? "0 0 6px rgba(52,211,153,0.8)" : "none",
                transition: "all 0.3s"
              }} />
              <span style={{ ...lbl, fontSize: "8px", color: agreed ? "rgba(52,211,153,0.6)" : "rgba(100,116,139,0.45)" }}>
                {agreed ? "Ready to proceed" : "Agree to continue"}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}