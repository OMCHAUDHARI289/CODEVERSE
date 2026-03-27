import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  completeLeaderboardReveal,
  getEventStatus,
  revealNextLeaderboardTeam,
  resetLeaderboardReveal,
  startEvent,
  startLeaderboardReveal,
  stopEvent,
} from "../../api/eventApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const STATUS_POLL_INTERVAL_MS = 10000;

/* ─── TOKENS ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };

const hex2rgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const REVEAL_META = {
  hidden:    { label: "Sealed",    accent: "#f59e0b", glyph: "◈" },
  revealing: { label: "Revealing", accent: "#f472b6", glyph: "◉" },
  completed: { label: "Live",      accent: "#34d399", glyph: "✦" },
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

/* ─── SCAN LINE ─── */
function ScanLine({ color }) {
  return (
    <motion.div
      animate={{ top: ["0%","100%"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
      style={{
        position:"absolute", left:0, right:0, height:"1px", zIndex:2, pointerEvents:"none",
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,.25)},transparent)`,
      }}
    />
  );
}

/* ─── ANIMATED GRID BACKGROUND ─── */
function GridBg({ accent }) {
  return (
    <div style={{
      position:"absolute", inset:0, zIndex:0, overflow:"hidden", pointerEvents:"none",
      opacity:0.04,
      backgroundImage:`linear-gradient(${hex2rgba(accent,1)} 1px,transparent 1px),linear-gradient(90deg,${hex2rgba(accent,1)} 1px,transparent 1px)`,
      backgroundSize:"32px 32px",
    }}/>
  );
}

/* ─── PULSE DOT ─── */
function PulseDot({ color, size = 8 }) {
  return (
    <span style={{ position:"relative", display:"inline-flex", width:size, height:size, flexShrink:0 }}>
      <motion.span
        animate={{ scale:[1,2.2,1], opacity:[0.8,0,0.8] }}
        transition={{ duration:1.8, repeat:Infinity, ease:"easeOut" }}
        style={{
          position:"absolute", inset:0, borderRadius:"50%",
          background: hex2rgba(color,.45),
        }}
      />
      <span style={{
        position:"relative", width:"100%", height:"100%", borderRadius:"50%",
        background: color, boxShadow:`0 0 8px ${hex2rgba(color,.9)}`,
      }}/>
    </span>
  );
}

/* ─── REVEAL PROGRESS BAR ─── */
function RevealProgressBar({ total, revealed, accent }) {
  const pct = total > 0 ? Math.round((revealed / total) * 100) : 0;
  const segments = total > 0 ? Math.min(total, 30) : 20;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ ...lbl, fontSize:"8px", color:hex2rgba(accent,.65) }}>Reveal Progress</span>
        <span style={{ ...mono, fontSize:"12px", fontWeight:700, color:accent }}>{pct}%</span>
      </div>
      {/* Segmented bar */}
      <div style={{ display:"flex", gap:"3px", height:"6px" }}>
        {Array.from({ length: segments }).map((_, i) => {
          const filled = i < Math.round((pct / 100) * segments);
          return (
            <motion.div
              key={i}
              initial={false}
              animate={{ background: filled ? accent : hex2rgba(accent,.12) }}
              transition={{ duration:0.3, delay: filled ? i * 0.02 : 0 }}
              style={{ flex:1, borderRadius:"2px",
                boxShadow: filled ? `0 0 4px ${hex2rgba(accent,.6)}` : "none",
              }}
            />
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ ...lbl, fontSize:"7px" }}>{revealed} revealed</span>
        <span style={{ ...lbl, fontSize:"7px" }}>{total - revealed} remaining</span>
      </div>
    </div>
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, wide }) {
  return (
    <div style={{
      padding:"14px 16px", borderRadius:"12px", position:"relative", overflow:"hidden",
      background: hex2rgba(accent,.06),
      border:`1px solid ${hex2rgba(accent,.2)}`,
      gridColumn: wide ? "span 2" : undefined,
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,.55)},transparent)` }}/>
      <p style={{ ...lbl, fontSize:"7px", color:hex2rgba(accent,.65) }}>{label}</p>
      <p style={{ ...mono, marginTop:"6px", fontSize: typeof value === "string" && value.length > 16 ? "10px" : "15px",
        fontWeight:700, color:"#f8fafc", lineHeight:1.3, wordBreak:"break-word" }}>
        {value}
      </p>
    </div>
  );
}

/* ─── COMMAND BUTTON ─── */
function CmdButton({ label, sub, accent, onClick, disabled, busy, danger }) {
  const [hov, setHov] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={!disabled ? { scale:0.97 } : {}}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex:1, minWidth:"150px",
        padding:"16px 14px", borderRadius:"12px",
        display:"flex", flexDirection:"column", alignItems:"flex-start", gap:"5px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition:"all 0.18s",
        background: disabled ? "rgba(255,255,255,0.02)"
          : hov ? hex2rgba(accent,.14) : hex2rgba(accent,.07),
        border: disabled ? `1px solid rgba(255,255,255,0.07)`
          : hov ? `1px solid ${hex2rgba(accent,.6)}` : `1px solid ${hex2rgba(accent,.28)}`,
        boxShadow: !disabled && hov ? `0 0 20px ${hex2rgba(accent,.18)}, inset 0 0 20px ${hex2rgba(accent,.04)}` : "none",
        opacity: disabled ? 0.45 : 1,
        position:"relative", overflow:"hidden",
      }}
    >
      {/* Hover shimmer */}
      {!disabled && hov && (
        <motion.div
          initial={{ x:"-100%" }} animate={{ x:"100%" }}
          transition={{ duration:0.55, ease:"easeInOut" }}
          style={{
            position:"absolute", top:0, bottom:0, width:"60%",
            background:`linear-gradient(90deg,transparent,${hex2rgba(accent,.07)},transparent)`,
            pointerEvents:"none",
          }}
        />
      )}

      <div style={{ display:"flex", alignItems:"center", gap:"7px", position:"relative", zIndex:1 }}>
        {busy && (
          <motion.span animate={{ rotate:360 }} transition={{ duration:.7, repeat:Infinity, ease:"linear" }}
            style={{ color:accent, fontSize:"12px" }}>◌</motion.span>
        )}
        <span style={{ ...mono, fontSize:"11px", fontWeight:700, letterSpacing:"0.12em",
          textTransform:"uppercase",
          color: disabled ? "rgba(148,163,184,0.35)" : accent }}>
          {busy ? "Working…" : label}
        </span>
      </div>
      <span style={{ ...lbl, fontSize:"8px", position:"relative", zIndex:1,
        color: disabled ? "rgba(100,116,139,0.3)" : hex2rgba(accent,.55),
        textTransform:"none", letterSpacing:"0.04em" }}>
        {sub}
      </span>
    </motion.button>
  );
}

/* ─── BANNER ─── */
function Banner({ tone = "success", message, onClose }) {
  const cfg = {
    success: { fg:"#6ee7b7", bg:"rgba(52,211,153,0.08)", border:"rgba(52,211,153,0.28)", icon:"✓" },
    error:   { fg:"#fca5a5", bg:"rgba(248,113,113,0.08)", border:"rgba(248,113,113,0.28)", icon:"⚠" },
  };
  const c = cfg[tone] || cfg.success;
  return (
    <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      style={{ padding:"10px 16px", borderRadius:"10px", background:c.bg, border:`1px solid ${c.border}`,
        display:"flex", alignItems:"center", gap:"10px" }}>
      <span style={{ ...mono, fontSize:"11px", fontWeight:700, color:c.fg }}>{c.icon}</span>
      <span style={{ flex:1, fontSize:"12px", color:c.fg }}>{message}</span>
      <button type="button" onClick={onClose}
        style={{ background:"none", border:"none", color:"rgba(148,163,184,0.5)", cursor:"pointer", fontSize:"14px" }}>✕</button>
    </motion.div>
  );
}

/* ─── SECTION CARD ─── */
function SectionCard({ accent, children, style }) {
  return (
    <div style={{
      background:"#13161e", border:`1px solid rgba(255,255,255,0.07)`,
      borderRadius:"16px", padding:"22px 24px",
      position:"relative", overflow:"hidden", ...style,
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,.5)},transparent)` }}/>
      <ScanLine color={accent} />
      <GridBg accent={accent} />
      <div style={{ position:"relative", zIndex:1 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── FLOW STEP ─── */
function FlowStep({ num, label, done, active, accent }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <div style={{
        width:"28px", height:"28px", borderRadius:"8px", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        ...mono, fontSize:"10px", fontWeight:700,
        background: done ? hex2rgba("#34d399",.15) : active ? hex2rgba(accent,.15) : "rgba(255,255,255,.04)",
        border: done ? `1px solid ${hex2rgba("#34d399",.4)}` : active ? `1px solid ${hex2rgba(accent,.4)}` : "1px solid rgba(255,255,255,.08)",
        color: done ? "#34d399" : active ? accent : "rgba(148,163,184,.35)",
        boxShadow: active ? `0 0 10px ${hex2rgba(accent,.3)}` : "none",
        transition:"all 0.3s",
      }}>
        {done ? "✓" : num}
      </div>
      <span style={{ ...mono, fontSize:"11px",
        color: done ? "rgba(52,211,153,.7)" : active ? "#f8fafc" : "rgba(148,163,184,.4)" }}>
        {label}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function EventControlPage() {
  const [eventLive,    setEventLive]    = useState(false);
  const [reveal,       setReveal]       = useState({
    status:"hidden", intervalSeconds:10,
    totalTeams:0, revealedCount:0, remainingCount:0,
    startedAt:null, completedAt:null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busyAction,    setBusyAction]    = useState("");
  const [error,         setError]         = useState("");
  const [statusNote,    setStatusNote]    = useState("");

  const revealMeta = useMemo(() => REVEAL_META[reveal.status] || REVEAL_META.hidden, [reveal.status]);
  const pct = reveal.totalTeams > 0
    ? Math.round((reveal.revealedCount / reveal.totalTeams) * 100) : 0;

  /* ─── SYNC ─── */
  const applyPayload = (data) => {
    const lr = data?.leaderboardReveal || {};
    setEventLive(Boolean(data?.isLive));
    setReveal({
      status:          lr.status          || "hidden",
      intervalSeconds: Number(lr.intervalSeconds) || 10,
      totalTeams:      Number(lr.totalTeams)      || 0,
      revealedCount:   Number(lr.revealedCount)   || 0,
      remainingCount:  Number(lr.remainingCount)  || 0,
      startedAt:       lr.startedAt  || null,
      completedAt:     lr.completedAt || null,
    });
  };

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const data = await getEventStatus();
        if (!active) return;
        applyPayload(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to sync event state."));
      } finally {
        if (active) setLoadingStatus(false);
      }
    };
    void sync();
    const id = window.setInterval(() => void sync(), STATUS_POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  const notifyBroadcast = (isLive) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("codeverse:event-status", { detail: { isLive } }));
  };

  const runAction = async (key, action, msg, broadcast = false) => {
    if (busyAction || loadingStatus) return;
    setBusyAction(key); setError(""); setStatusNote("");
    try {
      const payload = await action();
      applyPayload(payload);
      if (broadcast) notifyBroadcast(Boolean(payload?.isLive));
      setStatusNote(msg);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update event state."));
    } finally { setBusyAction(""); }
  };

  const busy    = busyAction !== "";
  const blocked = loadingStatus || busy;

  /* ─── FLOW STEP STATES ─── */
  const step1Done   = eventLive;
  const step2Done   = reveal.status !== "hidden";
  const step2Active = !step2Done && eventLive;
  const step3Done   = reveal.status === "completed";
  const step3Active = reveal.status === "revealing";

  return (
    <motion.div
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.35 }}
      style={{ display:"flex", flexDirection:"column", gap:"16px", ...mono, color:"#e2e8f0" }}
    >

      {/* ══ HERO ══ */}
      <SectionCard accent={revealMeta.accent}>
        {/* Corner decoration */}
        <div style={{
          position:"absolute", top:0, right:0, width:"200px", height:"200px",
          background:`radial-gradient(circle at top right, ${hex2rgba(revealMeta.accent,.07)}, transparent 65%)`,
          pointerEvents:"none", zIndex:0,
        }}/>

        <div style={{ display:"flex", alignItems:"flex-start",
          justifyContent:"space-between", flexWrap:"wrap", gap:"16px" }}>

          {/* Left: title */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
              <PulseDot color={revealMeta.accent} size={8} />
              <span style={{ ...lbl, fontSize:"8px", color:hex2rgba(revealMeta.accent,.75) }}>
                Admin · Event Control · {STATUS_POLL_INTERVAL_MS/1000}s sync
              </span>
            </div>
            <h1 style={{ fontSize:"26px", fontWeight:700, color:"#f8fafc",
              letterSpacing:"-0.02em", lineHeight:1.2 }}>
              Mission Control
            </h1>
            <p style={{ marginTop:"8px", fontSize:"13px", lineHeight:1.75,
              color:"rgba(203,213,225,0.62)", fontFamily:"'Inter',sans-serif", maxWidth:"520px" }}>
              Orchestrate the live event and the dramatic results reveal. Keep the leaderboard sealed
              until you're ready — then reveal teams one by one, last place to champion.
            </p>
          </div>

          {/* Right: status chips */}
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", alignItems:"flex-end" }}>
            {/* Event status */}
            <motion.div
              animate={{ boxShadow: eventLive
                ? [`0 0 0px ${hex2rgba("#34d399",0)}`, `0 0 12px ${hex2rgba("#34d399",.4)}`, `0 0 0px ${hex2rgba("#34d399",0)}`]
                : "none"
              }}
              transition={{ duration:2, repeat:Infinity }}
              style={{
                display:"flex", alignItems:"center", gap:"8px",
                padding:"9px 16px", borderRadius:"999px",
                background: eventLive ? "rgba(52,211,153,0.1)" : "rgba(251,146,60,0.1)",
                border: eventLive ? "1px solid rgba(52,211,153,0.35)" : "1px solid rgba(251,146,60,0.35)",
              }}>
              <PulseDot color={eventLive ? "#34d399" : "#fb923c"} size={7} />
              <span style={{ ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.18em",
                textTransform:"uppercase", color: eventLive ? "#34d399" : "#fb923c" }}>
                {eventLive ? "Event Live" : "Standby"}
              </span>
            </motion.div>

            {/* Reveal status */}
            <div style={{
              display:"flex", alignItems:"center", gap:"8px",
              padding:"9px 16px", borderRadius:"999px",
              background: hex2rgba(revealMeta.accent,.1),
              border:`1px solid ${hex2rgba(revealMeta.accent,.35)}`,
            }}>
              <span style={{ color:revealMeta.accent, fontSize:"12px" }}>{revealMeta.glyph}</span>
              <span style={{ ...mono, fontSize:"10px", fontWeight:700, letterSpacing:"0.18em",
                textTransform:"uppercase", color:revealMeta.accent }}>
                Reveal {revealMeta.label}
              </span>
            </div>

            {/* Completion %  */}
            {reveal.totalTeams > 0 && (
              <div style={{ ...mono, fontSize:"11px", color:"rgba(148,163,184,.5)",
                textAlign:"right", letterSpacing:"0.06em" }}>
                {reveal.revealedCount}/{reveal.totalTeams} teams revealed
              </div>
            )}
          </div>
        </div>

        {/* ── FLOW STEPS ── */}
        <div style={{ marginTop:"22px", paddingTop:"18px",
          borderTop:"1px solid rgba(255,255,255,.06)",
          display:"flex", gap:"0", alignItems:"center", flexWrap:"wrap" }}>
          {[
            { num:"01", label:"Start event",       done:step1Done,  active:!step1Done },
            null,
            { num:"02", label:"Start reveal",      done:step2Done,  active:step2Active },
            null,
            { num:"03", label:"Reveal teams",      done:step3Done,  active:step3Active },
            null,
            { num:"04", label:"Champion crowned",  done:step3Done,  active:false },
          ].map((s, i) =>
            s === null
              ? <div key={i} style={{ width:"32px", height:"1px", background:"rgba(255,255,255,.1)", flexShrink:0 }}/>
              : <FlowStep key={i} {...s} accent={revealMeta.accent} />
          )}
        </div>
      </SectionCard>

      {/* ══ BANNERS ══ */}
      <AnimatePresence>
        {error      && <Banner tone="error" message={error}      onClose={() => setError("")} />}
      </AnimatePresence>
      <AnimatePresence>
        {!error && statusNote && <Banner message={statusNote} onClose={() => setStatusNote("")} />}
      </AnimatePresence>

      {/* ══ TWO-COLUMN: EVENT + STATS ══ */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>

        {/* ── EVENT BROADCAST ── */}
        <SectionCard accent="#34d399">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"18px" }}>
            <div>
              <p style={{ ...lbl, fontSize:"8px", color:"rgba(52,211,153,.7)" }}>01 · Event Broadcast</p>
              <h3 style={{ fontSize:"16px", fontWeight:700, color:"#f8fafc", marginTop:"5px" }}>
                Round Access
              </h3>
            </div>
            <div style={{
              padding:"8px 12px", borderRadius:"10px",
              background: eventLive ? "rgba(52,211,153,.08)" : "rgba(255,255,255,.03)",
              border: eventLive ? "1px solid rgba(52,211,153,.25)" : "1px solid rgba(255,255,255,.07)",
            }}>
              <p style={{ ...lbl, fontSize:"7px" }}>Status</p>
              <p style={{ ...mono, fontSize:"12px", fontWeight:700, marginTop:"4px",
                color: eventLive ? "#34d399" : "#fb923c" }}>
                {eventLive ? "Live" : "Off"}
              </p>
            </div>
          </div>

          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            <CmdButton
              label="Start Event"
              sub="Unlock all rounds for teams"
              accent="#34d399"
              onClick={() => void runAction("event-start", () => startEvent(), "Event is now live for all teams.", true)}
              disabled={blocked || eventLive}
              busy={busyAction === "event-start"}
            />
            <CmdButton
              label="Stop Event"
              sub="Move all access to standby"
              accent="#f87171"
              onClick={() => void runAction("event-stop", () => stopEvent(), "Event moved to standby.", true)}
              disabled={blocked || !eventLive}
              busy={busyAction === "event-stop"}
            />
          </div>

          {/* Live pulse ring */}
          {eventLive && (
            <div style={{ marginTop:"16px", display:"flex", alignItems:"center", gap:"8px" }}>
              <PulseDot color="#34d399" size={7} />
              <span style={{ ...lbl, fontSize:"8px", color:"rgba(52,211,153,.6)" }}>
                Teams can access all rounds
              </span>
            </div>
          )}
        </SectionCard>

        {/* ── REVEAL STATS ── */}
        <SectionCard accent={revealMeta.accent}>
          <div style={{ marginBottom:"16px" }}>
            <p style={{ ...lbl, fontSize:"8px", color:hex2rgba(revealMeta.accent,.7) }}>02 · Reveal State</p>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginTop:"5px" }}>
              <h3 style={{ fontSize:"16px", fontWeight:700, color:"#f8fafc" }}>
                {revealMeta.label}
              </h3>
              {reveal.status === "revealing" && <PulseDot color={revealMeta.accent} size={7} />}
            </div>
          </div>

          {/* Progress bar */}
          {reveal.totalTeams > 0 && (
            <div style={{ marginBottom:"16px" }}>
              <RevealProgressBar
                total={reveal.totalTeams}
                revealed={reveal.revealedCount}
                accent={revealMeta.accent}
              />
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
            <StatTile label="Total Teams"  value={reveal.totalTeams || "—"} accent="#38bdf8" />
            <StatTile label="Revealed"     value={`${reveal.revealedCount}/${reveal.totalTeams || "?"}`} accent={revealMeta.accent} />
            <StatTile label="Started"      value={formatDateTime(reveal.startedAt)}   accent="#c084fc" />
            <StatTile label="Completed"    value={formatDateTime(reveal.completedAt)} accent="#34d399" />
          </div>
        </SectionCard>
      </div>

      {/* ══ LEADERBOARD REVEAL CONSOLE ══ */}
      <SectionCard accent="#f472b6">
        <div style={{ marginBottom:"20px" }}>
          <p style={{ ...lbl, fontSize:"8px", color:"rgba(244,114,182,.72)" }}>03 · Leaderboard Reveal</p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            flexWrap:"wrap", gap:"12px", marginTop:"6px" }}>
            <h3 style={{ fontSize:"18px", fontWeight:700, color:"#f8fafc", letterSpacing:"-0.01em" }}>
              Last-To-First Show Mode
            </h3>
            {reveal.remainingCount > 0 && (
              <motion.div
                animate={{ opacity:[1,.6,1] }} transition={{ duration:1.5, repeat:Infinity }}
                style={{
                  padding:"8px 16px", borderRadius:"10px",
                  background:"rgba(244,114,182,.08)", border:"1px solid rgba(244,114,182,.28)",
                  display:"flex", alignItems:"center", gap:"8px",
                }}>
                <PulseDot color="#f472b6" size={6} />
                <span style={{ ...mono, fontSize:"11px", fontWeight:700, color:"#f472b6" }}>
                  {reveal.remainingCount} teams hidden
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── 4 COMMAND BUTTONS ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px" }}>
          {/* START REVEAL */}
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <div style={{ ...lbl, fontSize:"7px", color:"rgba(244,114,182,.55)", paddingLeft:"2px" }}>
              Step 1
            </div>
            <CmdButton
              label="Start Reveal"
              sub="Freeze standings & enter manual mode"
              accent="#f472b6"
              onClick={() => void runAction(
                "reveal-start",
                () => startLeaderboardReveal(),
                "Leaderboard reveal started. Use Reveal Next to show one team at a time."
              )}
              disabled={blocked}
              busy={busyAction === "reveal-start"}
            />
          </div>

          {/* REVEAL NEXT */}
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <div style={{ ...lbl, fontSize:"7px", color:"rgba(56,189,248,.55)", paddingLeft:"2px" }}>
              Step 2 · repeat
            </div>
            <CmdButton
              label="Reveal Next"
              sub="Expose one more team, bottom → top"
              accent="#38bdf8"
              onClick={() => void runAction(
                "reveal-next",
                () => revealNextLeaderboardTeam(),
                "One more team revealed on the public leaderboard."
              )}
              disabled={blocked || reveal.status === "hidden" || reveal.status === "completed"}
              busy={busyAction === "reveal-next"}
            />
          </div>

          {/* REVEAL ALL */}
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <div style={{ ...lbl, fontSize:"7px", color:"rgba(52,211,153,.55)", paddingLeft:"2px" }}>
              Skip to end
            </div>
            <CmdButton
              label="Reveal All"
              sub="Instantly show full final standings"
              accent="#34d399"
              onClick={() => void runAction(
                "reveal-complete",
                () => completeLeaderboardReveal(),
                "Full standings are now public."
              )}
              disabled={blocked}
              busy={busyAction === "reveal-complete"}
            />
          </div>

          {/* RESET */}
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <div style={{ ...lbl, fontSize:"7px", color:"rgba(245,158,11,.55)", paddingLeft:"2px" }}>
              Danger zone
            </div>
            <CmdButton
              label="Reset Reveal"
              sub="Seal leaderboard & clear snapshot"
              accent="#f59e0b"
              onClick={() => void runAction(
                "reveal-reset",
                () => resetLeaderboardReveal(),
                "Leaderboard sealed. Teams see the waiting screen again."
              )}
              disabled={blocked}
              busy={busyAction === "reveal-reset"}
            />
          </div>
        </div>

        {/* ── PROGRESS DISPLAY during revealing ── */}
        <AnimatePresence>
          {reveal.status === "revealing" && reveal.totalTeams > 0 && (
            <motion.div
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
              exit={{ opacity:0, height:0 }}
              style={{ overflow:"hidden" }}
            >
              <div style={{ marginTop:"16px" }}>
                <RevealProgressBar
                  total={reveal.totalTeams}
                  revealed={reveal.revealedCount}
                  accent="#f472b6"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SHOW FLOW EXPLAINER ── */}
        <div style={{
          marginTop:"18px", padding:"16px 18px", borderRadius:"12px",
          background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.06)",
          display:"grid", gridTemplateColumns:"auto 1fr", gap:"16px", alignItems:"start",
        }}>
          {/* Timeline dots */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0, paddingTop:"2px" }}>
            {["#f472b6","#38bdf8","#34d399"].map((c, i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:c,
                  boxShadow:`0 0 6px ${hex2rgba(c,.8)}` }}/>
                {i < 2 && <div style={{ width:"1px", height:"18px", background:"rgba(255,255,255,.08)" }}/>}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {[
              { color:"#f472b6", text:"Teams that finish Round 3 see a sealed waiting screen — no results yet." },
              { color:"#38bdf8", text:"Once you start the reveal, the backend freezes the final snapshot. Each click of Reveal Next exposes exactly one team, climbing from last place toward first." },
              { color:"#34d399", text:"Reveal All or the final Reveal Next crowns the champion live on stage." },
            ].map((item, i) => (
              <p key={i} style={{ fontSize:"12px", lineHeight:1.7,
                color:"rgba(203,213,225,.62)", fontFamily:"'Inter',sans-serif", margin:0 }}>
                {item.text}
              </p>
            ))}
          </div>
        </div>
      </SectionCard>

    </motion.div>
  );
}