import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { round3Languages } from "./round3ChallengeData";
import { useRound3Battle } from "./Round3BattleContext";

/* ─── DESIGN TOKENS ─── */
const mono     = { fontFamily: "'DM Mono','Fira Code',monospace" };
const cardBase = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl      = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
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

/* ─── SKELETON LOADER ─── */
function SkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ ...cardBase, padding: "32px", display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.3),transparent)"
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

      <div style={{ marginTop: "8px", display: "flex", gap: "12px" }}>
        {[1, 2].map(i => (
          <motion.div key={i}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            style={{ flex: 1, height: "120px", borderRadius: "10px", background: "rgba(56,189,248,0.06)" }}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
        <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }}
          style={{ height: "36px", borderRadius: "10px", background: "rgba(56,189,248,0.08)", width: "160px" }} />
        <span style={{ ...lbl, fontSize: "8px" }}>Loading languages...</span>
      </div>
    </motion.div>
  );
}

/* ─── CONFIRM MODAL ─── */
function ConfirmModal({ language, onConfirm, onCancel, loading }) {
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
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)", border: "1px solid rgba(56,189,248,0.28)", position: "relative"
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.55),transparent)"
        }} />

        {/* Header */}
        <div style={{
          padding: "20px 22px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(56,189,248,0.04)"
        }}>
          <p style={{ ...lbl, color: "rgba(56,189,248,0.65)", marginBottom: "5px" }}>Round 3 · Language Confirmation</p>
          <h3 style={{ ...mono, fontSize: "15px", fontWeight: 700, color: "#bae6fd", margin: 0 }}>
            Lock in{" "}
            <span style={{ color: "#38bdf8" }}>{language?.label ?? ""}</span>?
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px" }}>
          <div style={{
            display: "flex", gap: "12px", padding: "14px", borderRadius: "10px",
            background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.2)", marginBottom: "14px"
          }}>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
              style={{
                width: "7px", height: "7px", borderRadius: "50%", background: "#38bdf8",
                boxShadow: "0 0 8px rgba(56,189,248,0.9)", flexShrink: 0, marginTop: "4px"
              }} />
            <div>
              <p style={{ ...mono, fontSize: "11px", fontWeight: 700, color: "#7dd3fc", marginBottom: "4px" }}>
                Timer starts immediately
              </p>
              <p style={{
                fontSize: "12px", lineHeight: 1.65, color: "rgba(203,213,225,0.6)",
                fontFamily: "'Inter',sans-serif", margin: 0
              }}>
                Once you click <strong style={{ color: "#38bdf8" }}>Enter Arena</strong>, the{" "}
                <strong style={{ color: "#7dd3fc" }}>60-minute</strong> countdown begins and your buggy{" "}
                <strong style={{ color: "#7dd3fc" }}>{language?.label ?? ""}</strong> code will load.
                This choice cannot be changed after entering.
              </p>
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)", fontFamily: "'Inter',sans-serif" }}>
            Ensure your connection is stable. Tab switches are monitored.
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
              border: "1px solid rgba(56,189,248,0.38)", background: "rgba(56,189,248,0.14)",
              color: "#7dd3fc", transition: "all 0.14s",
              display: "flex", alignItems: "center", gap: "7px",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(56,189,248,0.24)"; e.currentTarget.style.borderColor = "rgba(56,189,248,0.6)"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(56,189,248,0.14)"; e.currentTarget.style.borderColor = "rgba(56,189,248,0.38)"; }}
          >
            {loading ? (
              <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>◌</motion.span> Loading...</>
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
export default function Round3LanguagePage() {
  const navigate = useNavigate();
  const { isHydrated, agreedToTerms, isChallengeLoading, loadChallenge, selectedLanguage, submitResult } = useRound3Battle();

  const [statusLoading,   setStatusLoading]   = useState(true);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [pendingLanguage, setPendingLanguage] = useState(null); // language object awaiting confirm
  const [confirmed,       setConfirmed]       = useState(null); // language value actually selected

  /* ── Guards ── */
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!isHydrated) return;
      try {
        if (!agreedToTerms) {
          navigate("/team/round3/terms", { replace: true });
          return;
        }
        if (submitResult) {
          navigate("/team/round3/result", { replace: true });
          return;
        }
        if (selectedLanguage) {
          navigate("/team/round3/arena", { replace: true });
          return;
        }
      } catch (err) {
        if (!active) return;
        setError("Unable to load Round 3 status.");
      } finally {
        if (active) setStatusLoading(false);
      }
    };

    void bootstrap();
    return () => { active = false; };
  }, [isHydrated, agreedToTerms, navigate, selectedLanguage, submitResult]);

  /* ── Confirm → load challenge ── */
  const handleConfirm = async () => {
    if (!pendingLanguage) return;
    setLoading(true);
    setError("");
    try {
      setConfirmed(pendingLanguage.value);
      await loadChallenge(pendingLanguage.value);
      navigate("/team/round3/arena");
    } catch (err) {
      setError("Failed to load the challenge. Please try again.");
      setConfirmed(null);
      setPendingLanguage(null);
    } finally {
      setLoading(false);
    }
  };

  /* ── Render: loading skeleton ── */
  if (statusLoading) return <SkeletonLoader />;

  /* ── Render ── */
  return (
    <>
      {/* Confirm modal */}
      <AnimatePresence>
        {pendingLanguage && (
          <ConfirmModal
            language={pendingLanguage}
            loading={loading}
            onConfirm={handleConfirm}
            onCancel={() => !loading && setPendingLanguage(null)}
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
            background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.55),transparent)"
          }} />
          <motion.div
            animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{
              position: "absolute", top: "-50px", right: "-50px", width: "200px", height: "200px",
              borderRadius: "50%", background: "rgba(56,189,248,0.08)", filter: "blur(50px)", pointerEvents: "none"
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <p style={{ ...lbl, color: "rgba(56,189,248,0.65)" }}>Round 3 — Bug Apocalypse</p>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", marginTop: "8px", letterSpacing: "-0.01em" }}>
                  Choose Your Language
                </h2>
              </div>

              {/* Status badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px",
                borderRadius: "999px", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.22)"
              }}>
                <motion.span
                  animate={{ opacity: confirmed ? 1 : [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: confirmed ? 0 : Infinity }}
                  style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: confirmed ? "#34d399" : "#38bdf8",
                    boxShadow: confirmed ? "0 0 6px rgba(52,211,153,0.8)" : "0 0 6px rgba(56,189,248,0.8)",
                  }}
                />
                <span style={{ ...mono, fontSize: "11px", fontWeight: 700, color: confirmed ? "#34d399" : "#38bdf8" }}>
                  {confirmed ? confirmed.toUpperCase() : "Not Selected"}
                </span>
              </div>
            </div>

            <p style={{
              fontSize: "13px", lineHeight: 1.75, color: "rgba(148,163,184,0.55)", marginTop: "10px",
              fontFamily: "'Inter',sans-serif"
            }}>
              Pick the language you want to debug in. Your buggy source code will load once you confirm and enter the arena.
            </p>
          </div>
        </div>

        {/* ── LANGUAGE CARDS ── */}
        <div style={{ ...cardBase, overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.3),transparent)"
          }} />
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ ...lbl, color: "rgba(56,189,248,0.55)" }}>◈ Select Language</p>
          </div>

          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {round3Languages.map((language, i) => {
              const active = confirmed === language.value || selectedLanguage === language.value;
              const busy   = loading && pendingLanguage?.value === language.value;

              return (
                <motion.div key={language.value}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  onClick={() => !loading && !isChallengeLoading && setPendingLanguage(language)}
                  style={{
                    borderRadius: "10px",
                    cursor: loading || isChallengeLoading ? "not-allowed" : "pointer",
                    transition: "all 0.18s",
                    padding: "12px 14px",
                    background: active ? "rgba(56,189,248,0.07)" : "rgba(255,255,255,0.02)",
                    border: active ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(255,255,255,0.05)",
                    opacity: loading && !busy ? 0.45 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {/* Number / check badge */}
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "7px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      ...mono, fontSize: "10px", fontWeight: 700,
                      background: active ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                      border: active ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(255,255,255,0.07)",
                      color: active ? "#38bdf8" : "rgba(148,163,184,0.45)",
                      transition: "all 0.18s",
                    }}>
                      <AnimatePresence mode="wait">
                        {active ? (
                          <motion.span key="check"
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 18 }}
                            style={{ color: "#38bdf8", fontSize: "11px", lineHeight: 1 }}>✓</motion.span>
                        ) : (
                          <motion.span key="num"
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            {String(i + 1).padStart(2, "0")}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "13px", fontWeight: 700, color: active ? "#e0f2fe" : "rgba(226,232,240,0.9)",
                          transition: "color 0.18s",
                        }}>
                          {language.label}
                        </span>
                        {language.shortLabel && (
                          <span style={{
                            ...mono, fontSize: "9px", letterSpacing: "0.2em",
                            padding: "2px 7px", borderRadius: "999px",
                            background: active ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.05)",
                            border: active ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(255,255,255,0.08)",
                            color: active ? "#7dd3fc" : "rgba(148,163,184,0.5)",
                            transition: "all 0.18s",
                          }}>
                            {language.shortLabel}
                          </span>
                        )}
                      </div>
                      {language.description && (
                        <p style={{
                          margin: "4px 0 0", fontSize: "12px", lineHeight: 1.55,
                          color: "rgba(203,213,225,0.55)", fontFamily: "'Inter',sans-serif"
                        }}>
                          {language.description}
                        </p>
                      )}
                    </div>

                    {/* Arrow / status */}
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                      {busy ? (
                        <motion.span animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          style={{ color: "#38bdf8", fontSize: "14px" }}>◌</motion.span>
                      ) : (
                        <motion.span animate={{ rotate: active ? 90 : 0 }}
                          style={{ color: active ? "#38bdf8" : "rgba(148,163,184,0.3)", fontSize: "14px", transition: "color 0.18s" }}>›</motion.span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── ERROR BANNER ── */}
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

        {/* ── FOOTER NOTE ── */}
        <div style={{ padding: "0 4px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: confirmed ? "#34d399" : "rgba(255,255,255,0.15)",
            boxShadow: confirmed ? "0 0 6px rgba(52,211,153,0.8)" : "none",
            transition: "all 0.3s", flexShrink: 0
          }} />
          <span style={{ ...lbl, fontSize: "8px", color: confirmed ? "rgba(52,211,153,0.6)" : "rgba(100,116,139,0.45)" }}>
            {confirmed ? `${confirmed.toUpperCase()} selected — loading arena` : "Select a language to continue"}
          </span>
        </div>
      </motion.div>
    </>
  );
}
