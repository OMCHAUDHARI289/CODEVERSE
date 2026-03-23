import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getEventStatus, startEvent, stopEvent } from "../../api/eventApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const STATUS_POLL_INTERVAL_MS = 10000;

/* ─── TOKENS ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };
const hex2rgba = (h, a) => { const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

const LIVE_COLOR    = "#34d399";
const STANDBY_COLOR = "#fb923c";

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#34d399" }) {
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

/* ─── STATUS ORB ─── */
function StatusOrb({ isLive, loading }) {
  const color = isLive ? LIVE_COLOR : "rgba(100,116,139,0.55)";
  const label = loading ? "Syncing…" : isLive ? "Live" : "Standby";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
      <motion.div
        animate={isLive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "128px", height: "128px", borderRadius: "50%",
          border: `2px solid ${color}`,
          background: isLive ? hex2rgba(LIVE_COLOR, 0.1) : "rgba(0,0,0,0.4)",
          boxShadow: isLive ? `0 0 40px ${hex2rgba(LIVE_COLOR, 0.25)}, 0 0 80px ${hex2rgba(LIVE_COLOR, 0.1)}` : "none",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: "6px", position: "relative",
          transition: "border 0.4s, box-shadow 0.4s, background 0.4s",
        }}
      >
        {/* Pulse dot */}
        <motion.span
          animate={{ opacity: [1, 0.2, 1], scale: isLive ? [1, 0.8, 1] : [1, 1, 1] }}
          transition={{ duration: isLive ? 1.4 : 1, repeat: Infinity }}
          style={{
            position: "absolute", top: "18px", right: "18px",
            width: "8px", height: "8px", borderRadius: "50%",
            background: color,
            boxShadow: isLive ? `0 0 8px ${hex2rgba(LIVE_COLOR, 0.9)}` : "none",
          }}
        />
        <span style={{ ...mono, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color }}>
          {label}
        </span>
      </motion.div>

      <div style={{ textAlign: "center" }}>
        <p style={{ ...mono, fontSize: "12px", color: "rgba(148,163,184,0.55)" }}>
          {loading
            ? "Syncing event status…"
            : isLive
              ? "Event is currently live for teams."
              : "Awaiting authorization sequence."}
        </p>
      </div>
    </div>
  );
}

/* ─── CONTROL BUTTON ─── */
function CtrlButton({ label, subLabel, badge, accent, onClick, disabled, loading }) {
  const [hov, setHov] = useState(false);

  return (
    <motion.button
      whileHover={!disabled ? { y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: "28px 20px", borderRadius: "12px",
        border: `1px solid ${disabled ? hex2rgba(accent, 0.18) : hov ? hex2rgba(accent, 0.55) : hex2rgba(accent, 0.35)}`,
        background: hov && !disabled ? hex2rgba(accent, 0.07) : "transparent",
        boxShadow: hov && !disabled ? `0 0 28px ${hex2rgba(accent, 0.18)}` : "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.38 : 1,
        position: "relative", overflow: "hidden",
        transition: "border 0.2s, background 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Sweep shimmer — only on active Start button */}
      {!disabled && !loading && (
        <motion.div
          animate={{ left: ["-60%", "160%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", top: 0, bottom: 0, width: "60%",
            background: `linear-gradient(90deg,transparent,${hex2rgba(accent, 0.07)},transparent)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Badge */}
      <span style={{
        ...mono, fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em",
        padding: "3px 14px", borderRadius: "999px",
        color: accent, background: hex2rgba(accent, 0.1),
        border: `1px solid ${hex2rgba(accent, 0.3)}`,
      }}>
        {badge}
      </span>

      {/* Label */}
      <span style={{ ...mono, fontSize: "15px", fontWeight: 700,
        letterSpacing: "0.06em", color: disabled ? hex2rgba(accent, 0.5) : accent }}>
        {loading ? `${label === "START EVENT" ? "STARTING" : "STOPPING"}…` : label}
      </span>

      {/* Sub */}
      <span style={{ ...lbl, fontSize: "8px", color: hex2rgba(accent, 0.45) }}>
        {subLabel}
      </span>
    </motion.button>
  );
}

/* ══════════════════════════════════════════
   MAIN  — original logic untouched
══════════════════════════════════════════ */
export default function EventControlPage() {
  const [eventLive,      setEventLive]      = useState(false);
  const [showOverride,   setShowOverride]   = useState(false);
  const [loadingStatus,  setLoadingStatus]  = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error,          setError]          = useState("");
  const [statusNote,     setStatusNote]     = useState("");

  /* ── original polling logic, untouched ── */
  useEffect(() => {
    let active = true;

    const syncStatus = async () => {
      try {
        const data = await getEventStatus();
        if (!active) return;
        setEventLive(Boolean(data?.isLive));
        setError("");
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to sync event status."));
      } finally {
        if (active) setLoadingStatus(false);
      }
    };

    void syncStatus();
    const pollId = setInterval(() => { void syncStatus(); }, STATUS_POLL_INTERVAL_MS);
    return () => { active = false; clearInterval(pollId); };
  }, []);

  /* ── original event dispatcher, untouched ── */
  const notifyEventStatusChanged = (isLive) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("codeverse:event-status", { detail: { isLive } }));
  };

  /* ── original handler, untouched ── */
  const handleSetEventLive = async (targetLive) => {
    if (loadingStatus || updatingStatus || eventLive === targetLive) return;
    setUpdatingStatus(true);
    setError("");
    setStatusNote("");
    try {
      const data = targetLive ? await startEvent() : await stopEvent();
      const nextIsLive = Boolean(data?.isLive);
      setEventLive(nextIsLive);
      notifyEventStatusChanged(nextIsLive);
      setStatusNote(nextIsLive ? "Event is now live for all teams." : "Event has been moved to standby.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update event status."));
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── derived ── */
  const accentColor   = eventLive ? LIVE_COLOR : STANDBY_COLOR;
  const isStartBusy   = updatingStatus && !eventLive;
  const isStopBusy    = updatingStatus && eventLive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: "flex", flexDirection: "column", gap: "14px", ...mono, color: "#e2e8f0" }}
    >

      {/* ── HEADER ── */}
      <div style={{ ...card, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
        <ScanLine color={accentColor} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg,transparent,${hex2rgba(accentColor, 0.45)},transparent)`,
        }} />
        <motion.div
          animate={{ height: ["30%", "70%", "30%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            width: "3px", borderRadius: "0 3px 3px 0",
            background: `linear-gradient(to bottom,transparent,${accentColor},transparent)`,
          }}
        />

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "14px", position: "relative", zIndex: 1,
        }}>
          <div>
            <p style={{ ...lbl, color: hex2rgba(accentColor, 0.65) }}>Admin · Event Control</p>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9",
              marginTop: "5px", letterSpacing: "-0.01em" }}>
              Main Server State
            </h2>
          </div>

          {/* Live / Standby badge + poll dot */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              ...mono, fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
              padding: "4px 14px", borderRadius: "999px",
              color: accentColor,
              background: hex2rgba(accentColor, 0.1),
              border: `1px solid ${hex2rgba(accentColor, 0.3)}`,
            }}>
              {loadingStatus ? "Syncing…" : eventLive ? "Live" : "Standby"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: "5px", height: "5px", borderRadius: "50%",
                  background: accentColor, flexShrink: 0 }}
              />
              <span style={{ ...lbl, fontSize: "8px" }}>{STATUS_POLL_INTERVAL_MS / 1000}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: "10px 16px", borderRadius: "10px",
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)",
              display: "flex", alignItems: "center", gap: "10px",
            }}
          >
            <span style={{ color: "#f87171", fontSize: "12px", flexShrink: 0 }}>⚠</span>
            <span style={{ fontSize: "12px", color: "#fca5a5", flex: 1 }}>{error}</span>
            <button onClick={() => setError("")} style={{
              background: "none", border: "none", color: "rgba(148,163,184,0.5)",
              cursor: "pointer", fontSize: "14px", padding: 0,
            }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STATUS NOTE ── */}
      <AnimatePresence>
        {!error && statusNote && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: "10px 16px", borderRadius: "10px",
              background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)",
              display: "flex", alignItems: "center", gap: "10px",
            }}
          >
            <span style={{ color: LIVE_COLOR, fontSize: "12px", flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: "12px", color: "#6ee7b7", flex: 1 }}>{statusNote}</span>
            <button onClick={() => setStatusNote("")} style={{
              background: "none", border: "none", color: "rgba(148,163,184,0.5)",
              cursor: "pointer", fontSize: "14px", padding: 0,
            }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ORB + CONTROLS CARD ── */}
      <div style={{ ...card, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg,transparent,${hex2rgba(accentColor, 0.4)},transparent)`,
          transition: "background 0.4s",
        }} />

        {/* Status orb */}
        <div style={{ padding: "36px 24px 28px", display: "flex", justifyContent: "center" }}>
          <StatusOrb isLive={eventLive} loading={loadingStatus} />
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 24px" }} />

        {/* Section label */}
        <div style={{ padding: "16px 24px 12px", display: "flex", alignItems: "center",
          justifyContent: "space-between" }}>
          <p style={{ ...lbl, color: hex2rgba(accentColor, 0.6), fontSize: "9px" }}>
            Authorization Sequence
          </p>
        </div>

        {/* Control buttons */}
        <div style={{ display: "flex", gap: "12px", padding: "0 24px 28px" }}>
          <CtrlButton
            label="START EVENT"
            subLabel="Broadcast to all teams"
            badge="ON"
            accent={LIVE_COLOR}
            onClick={() => void handleSetEventLive(true)}
            disabled={loadingStatus || updatingStatus || eventLive}
            loading={isStartBusy}
          />
          <CtrlButton
            label="STOP EVENT"
            subLabel="Move to standby mode"
            badge="OFF"
            accent="#f87171"
            onClick={() => void handleSetEventLive(false)}
            disabled={loadingStatus || updatingStatus || !eventLive}
            loading={isStopBusy}
          />
        </div>
      </div>

      {/* ── ADMIN OVERRIDES ── */}
      <div style={{ ...card, overflow: "hidden" }}>
        <button
          onClick={() => setShowOverride((prev) => !prev)}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: "16px 24px", display: "flex", alignItems: "center",
            justifyContent: "space-between", transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <span style={{ ...lbl, fontSize: "9px" }}>
            {showOverride ? "− Hide Admin Overrides" : "+ Show Admin Overrides"}
          </span>
          <motion.span
            animate={{ rotate: showOverride ? 90 : 0 }}
            style={{ color: "rgba(148,163,184,0.3)", fontSize: "13px" }}
          >›</motion.span>
        </button>

        <AnimatePresence>
          {showOverride && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(0,0,0,0.25)" }}
            >
              <div style={{
                padding: "20px 24px", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: "20px",
              }}>
                <div>
                  <p style={{ ...mono, fontSize: "13px", fontWeight: 600,
                    color: "rgba(226,232,240,0.85)", marginBottom: "5px" }}>
                    Force Sync State
                  </p>
                  <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)", lineHeight: 1.5 }}>
                    Overrides all team states to transition to the next round immediately.
                  </p>
                </div>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    ...mono, fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
                    textTransform: "uppercase", flexShrink: 0,
                    padding: "8px 18px", borderRadius: "8px",
                    border: "1px solid rgba(251,146,60,0.45)",
                    background: "rgba(251,146,60,0.1)", color: "#fb923c",
                    cursor: "pointer", transition: "background 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(251,146,60,0.18)"; e.currentTarget.style.boxShadow = "0 0 14px rgba(251,146,60,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(251,146,60,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  Trigger Override
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  );
}