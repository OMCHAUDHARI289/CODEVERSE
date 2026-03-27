import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getEventLeaderboard } from "../../api/eventApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const LEADERBOARD_POLL_INTERVAL_MS = 4000;

const ROUND_META = {
  R1: { label: "Round 1", color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.22)"  },
  R2: { label: "Round 2", color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.22)"  },
  R3: { label: "Round 3", color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.22)" },
};

const REVEAL_META = {
  hidden: {
    title: "Results Will Display Soon",
    badge: "Sealed",
    accent: "#f59e0b",
    desc: "Final standings are sealed. The admin will start the public reveal when it is showtime.",
  },
  revealing: {
    title: "Final Reveal In Progress",
    badge: "Revealing",
    accent: "#f472b6",
    desc: "Standings are unlocking from last place to first. The admin reveals one more team with each click.",
  },
  completed: {
    title: "Final Standings",
    badge: "Complete",
    accent: "#34d399",
    desc: "The full leaderboard is now visible. The competition is over.",
  },
};

/* ─── MEDALS ─── */
const MEDAL = {
  1: { color: "#FFD700", glow: "rgba(255,215,0,0.55)",   label: "Champion",    bg: "rgba(255,215,0,0.07)"   },
  2: { color: "#C0C0C0", glow: "rgba(192,192,192,0.45)", label: "Runner-up",   bg: "rgba(192,192,192,0.06)" },
  3: { color: "#CD7F32", glow: "rgba(205,127,50,0.45)",  label: "Third Place", bg: "rgba(205,127,50,0.06)"  },
};

/* ─── TOKENS ─── */
const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const lbl  = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };

const hex2rgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/* ─── PULSE DOT ─── */
function PulseDot({ color, size = 8 }) {
  return (
    <span style={{ position:"relative", display:"inline-flex", width:size, height:size, flexShrink:0 }}>
      <motion.span
        animate={{ scale:[1,2.4,1], opacity:[0.7,0,0.7] }}
        transition={{ duration:1.8, repeat:Infinity, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, borderRadius:"50%", background:hex2rgba(color,.4) }}
      />
      <span style={{ position:"relative", width:"100%", height:"100%", borderRadius:"50%",
        background:color, boxShadow:`0 0 8px ${hex2rgba(color,.9)}` }}/>
    </span>
  );
}

/* ─── SCAN LINE ─── */
function ScanLine({ color }) {
  return (
    <motion.div
      animate={{ top:["0%","100%"] }}
      transition={{ duration:4, repeat:Infinity, ease:"linear", repeatDelay:3 }}
      style={{ position:"absolute", left:0, right:0, height:"1px", zIndex:2, pointerEvents:"none",
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,.22)},transparent)` }}
    />
  );
}

/* ─── SKELETON ROWS ─── */
function SkeletonRows() {
  return (
    <div style={{ padding:"12px", display:"flex", flexDirection:"column", gap:"8px" }}>
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div key={i}
          animate={{ opacity:[0.15,0.38,0.15] }}
          transition={{ duration:1.4, repeat:Infinity, delay:i*0.09 }}
          style={{ height:"62px", borderRadius:"12px",
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.05)" }}
        />
      ))}
    </div>
  );
}

/* ─── LOCKED STATE ─── */
function LockedState({ accent, totalTeams }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      style={{ padding:"52px 24px", display:"flex", flexDirection:"column",
        alignItems:"center", gap:"18px", textAlign:"center" }}>

      {/* Vault circle */}
      <div style={{ position:"relative" }}>
        <motion.div
          animate={{ rotate:360 }}
          transition={{ duration:18, repeat:Infinity, ease:"linear" }}
          style={{
            position:"absolute", inset:"-16px",
            borderRadius:"50%",
            border:`1px dashed ${hex2rgba(accent,.25)}`,
          }}
        />
        <motion.div
          animate={{ scale:[1,1.06,1], opacity:[0.85,1,0.85] }}
          transition={{ duration:2.8, repeat:Infinity, ease:"easeInOut" }}
          style={{
            width:"96px", height:"96px", borderRadius:"50%",
            display:"flex", alignItems:"center", justifyContent:"center",
            background:`radial-gradient(circle,${hex2rgba(accent,.12)},${hex2rgba(accent,.03)})`,
            border:`1px solid ${hex2rgba(accent,.38)}`,
            boxShadow:`0 0 32px ${hex2rgba(accent,.18)}`,
          }}>
          <span style={{ ...mono, fontSize:"11px", fontWeight:700, letterSpacing:"0.2em", color:accent }}>
            SEALED
          </span>
        </motion.div>
      </div>

      <div>
        <p style={{ ...mono, fontSize:"18px", fontWeight:700, color:"#f8fafc", margin:"0 0 10px" }}>
          Results are sealed
        </p>
        <p style={{ margin:0, maxWidth:"500px", fontSize:"13px", lineHeight:1.75,
          color:"rgba(203,213,225,0.62)", fontFamily:"'Inter',sans-serif" }}>
          Teams have completed the rounds. Once the admin launches the reveal, final standings
          will unlock from the bottom upward for a suspenseful finish.
        </p>
      </div>

      {totalTeams > 0 && (
        <motion.div
          animate={{ opacity:[0.7,1,0.7] }} transition={{ duration:2, repeat:Infinity }}
          style={{
            padding:"9px 18px", borderRadius:"999px",
            background:hex2rgba(accent,.07), border:`1px solid ${hex2rgba(accent,.22)}`,
            ...mono, fontSize:"11px", fontWeight:700, color:accent,
            letterSpacing:"0.1em",
          }}>
          {totalTeams} teams waiting in the vault
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── PODIUM CARD (Top 3) ─── */
function PodiumCard({ team, isMine }) {
  const medal  = MEDAL[team.rank];
  const rmeta  = ROUND_META[team.round] || ROUND_META.R1;
  const isChamp = team.rank === 1;

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:24, scale:0.95 }}
      animate={{ opacity:1, y:0, scale:1 }}
      transition={{ type:"spring", stiffness:220, damping:22, delay: (team.rank - 1) * 0.08 }}
      style={{
        flex:1, minWidth:"180px",
        position:"relative", overflow:"hidden",
        borderRadius:"16px", padding:"22px 18px 18px",
        background:`linear-gradient(160deg,${medal.bg},rgba(19,22,30,0.95))`,
        border:`1px solid ${hex2rgba(medal.color, isChamp ? 0.55 : 0.32)}`,
        boxShadow:`0 0 ${isChamp ? 32 : 18}px ${hex2rgba(medal.color, isChamp ? 0.2 : 0.1)}`,
        display:"flex", flexDirection:"column", alignItems:"center", gap:"10px",
        order: team.rank === 1 ? 0 : team.rank === 2 ? -1 : 1,
      }}
    >
      {/* Top accent */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(medal.color, isChamp ? 0.9 : 0.6)},transparent)` }}/>

      {/* Champion crown glow */}
      {isChamp && (
        <motion.div
          animate={{ opacity:[0.15,0.35,0.15] }}
          transition={{ duration:2.5, repeat:Infinity }}
          style={{
            position:"absolute", top:"-30px", left:"50%", transform:"translateX(-50%)",
            width:"160px", height:"160px", borderRadius:"50%",
            background:`radial-gradient(circle,${hex2rgba(medal.color,.25)},transparent 70%)`,
            pointerEvents:"none",
          }}
        />
      )}

      {/* Rank badge */}
      <div style={{
        width:"48px", height:"48px", borderRadius:"50%",
        display:"flex", alignItems:"center", justifyContent:"center",
        background: hex2rgba(medal.color,.15),
        border:`1.5px solid ${hex2rgba(medal.color,.6)}`,
        boxShadow:`0 0 16px ${medal.glow}`,
        position:"relative", zIndex:1,
      }}>
        <span style={{ ...mono, fontSize:"18px", fontWeight:800, color:medal.color }}>
          {team.rank}
        </span>
      </div>

      {/* Medal label */}
      <span style={{ ...lbl, fontSize:"7px", color:hex2rgba(medal.color,.7),
        letterSpacing:"0.22em", position:"relative", zIndex:1 }}>
        {medal.label}
      </span>

      {/* Team name */}
      <div style={{ textAlign:"center", position:"relative", zIndex:1 }}>
        <p style={{ ...mono, fontSize: isChamp ? "15px" : "13px", fontWeight:700,
          color: isMine ? "#bae6fd" : "#f8fafc", margin:0,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          maxWidth:"160px" }}>
          {team.name}
        </p>
        {isMine && (
          <span style={{ ...lbl, fontSize:"7px", color:"#38bdf8",
            background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.22)",
            borderRadius:"999px", padding:"2px 8px", marginTop:"4px", display:"inline-block" }}>
            You
          </span>
        )}
      </div>

      {/* Score */}
      <p style={{ ...mono, fontSize: isChamp ? "28px" : "22px", fontWeight:800,
        color:medal.color, letterSpacing:"-0.02em", margin:0,
        textShadow:`0 0 20px ${medal.glow}`, position:"relative", zIndex:1 }}>
        {team.score}
      </p>

      {/* Round badge */}
      <span style={{ ...mono, fontSize:"9px", fontWeight:700,
        letterSpacing:"0.14em", textTransform:"uppercase",
        color:rmeta.color, background:rmeta.bg, border:`1px solid ${rmeta.border}`,
        borderRadius:"999px", padding:"3px 10px", position:"relative", zIndex:1 }}>
        {team.round}
      </span>
    </motion.div>
  );
}

/* ─── PLACEHOLDER ROW (hidden/classified) ─── */
function PlaceholderRow({ rank }) {
  return (
    <motion.div
      initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
      style={{
        display:"grid", gridTemplateColumns:"60px 1fr auto auto",
        gap:"12px", alignItems:"center",
        padding:"13px 18px", borderRadius:"12px",
        background:"rgba(255,255,255,0.015)",
        border:"1px solid rgba(255,255,255,0.05)",
      }}>
      <span style={{ ...mono, fontSize:"13px", fontWeight:700, color:"rgba(148,163,184,0.3)" }}>
        #{rank}
      </span>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        {/* Redaction bars */}
        <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
          <motion.div animate={{ opacity:[0.2,0.4,0.2] }} transition={{ duration:2, repeat:Infinity, delay:rank*0.1 }}
            style={{ height:"8px", width:"90px", borderRadius:"3px", background:"rgba(148,163,184,0.15)" }}/>
          <motion.div animate={{ opacity:[0.15,0.3,0.15] }} transition={{ duration:2, repeat:Infinity, delay:rank*0.1+0.3 }}
            style={{ height:"6px", width:"55px", borderRadius:"3px", background:"rgba(148,163,184,0.1)" }}/>
        </div>
      </div>
      <span style={{ ...lbl, fontSize:"8px", color:"rgba(148,163,184,0.25)" }}>—</span>
      <span style={{ ...mono, fontSize:"12px", color:"rgba(148,163,184,0.25)", textAlign:"right" }}>—</span>
    </motion.div>
  );
}

/* ─── TEAM ROW ─── */
function TeamRow({ team, isMine, isNewReveal, index }) {
  const rmeta = ROUND_META[team.round] || ROUND_META.R1;

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:14 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.97 }}
      transition={{ type:"spring", stiffness:260, damping:24, delay: index * 0.03 }}
      style={{
        display:"grid", gridTemplateColumns:"60px 1fr auto auto",
        gap:"12px", alignItems:"center",
        padding:"13px 18px", borderRadius:"12px",
        position:"relative", overflow:"hidden",
        background: isMine
          ? "rgba(56,189,248,0.07)"
          : isNewReveal
            ? "rgba(244,114,182,0.07)"
            : "rgba(255,255,255,0.022)",
        border: isMine
          ? "1px solid rgba(56,189,248,0.28)"
          : isNewReveal
            ? "1px solid rgba(244,114,182,0.32)"
            : "1px solid rgba(255,255,255,0.05)",
        boxShadow: isNewReveal ? `0 0 24px rgba(244,114,182,0.1)` : "none",
      }}>

      {/* Reveal spotlight sweep */}
      {isNewReveal && (
        <motion.div
          initial={{ x:"-110%" }} animate={{ x:"110%" }}
          transition={{ duration:0.8, ease:"easeOut" }}
          style={{
            position:"absolute", top:0, bottom:0, width:"50%",
            background:"linear-gradient(90deg,transparent,rgba(244,114,182,0.14),transparent)",
            pointerEvents:"none", zIndex:0,
          }}
        />
      )}

      {/* Left bar for "you" */}
      {isMine && (
        <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%", width:"3px",
          borderRadius:"0 3px 3px 0", background:"#38bdf8",
          boxShadow:"0 0 8px rgba(56,189,248,0.7)" }}/>
      )}

      {/* Rank */}
      <span style={{ ...mono, fontSize:"15px", fontWeight:800, zIndex:1,
        color: isNewReveal ? "#f9a8d4" : isMine ? "#7dd3fc" : "rgba(248,250,252,0.6)" }}>
        #{team.rank}
      </span>

      {/* Name + badges */}
      <div style={{ minWidth:0, display:"flex", alignItems:"center", gap:"8px",
        flexWrap:"wrap", zIndex:1 }}>
        <span style={{ ...mono, fontSize:"13px", fontWeight: isMine ? 700 : 500,
          color: isMine ? "#e0f2fe" : "rgba(226,232,240,0.88)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {team.name}
        </span>
        {isMine && (
          <span style={{ ...lbl, fontSize:"7px", color:"#38bdf8",
            background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.22)",
            borderRadius:"999px", padding:"2px 8px" }}>You</span>
        )}
        {isNewReveal && (
          <motion.span
            initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
            style={{ ...lbl, fontSize:"7px", color:"#f472b6",
              background:"rgba(244,114,182,0.12)", border:"1px solid rgba(244,114,182,0.25)",
              borderRadius:"999px", padding:"2px 8px" }}>
            Revealed
          </motion.span>
        )}
      </div>

      {/* Round pill */}
      <span style={{ ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.14em",
        textTransform:"uppercase", color:rmeta.color,
        background:rmeta.bg, border:`1px solid ${rmeta.border}`,
        borderRadius:"999px", padding:"4px 10px", zIndex:1 }}>
        {team.round}
      </span>

      {/* Score */}
      <span style={{ ...mono, fontSize:"16px", fontWeight:800, textAlign:"right", zIndex:1,
        color: isMine ? "#bae6fd" : "#f8fafc" }}>
        {team.score}
      </span>
    </motion.div>
  );
}

/* ─── REVEAL PROGRESS BAR ─── */
function RevealBar({ total, revealed, accent }) {
  const pct  = total > 0 ? Math.round((revealed / total) * 100) : 0;
  const segs = Math.min(total || 20, 32);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
      <div style={{ display:"flex", gap:"3px" }}>
        {Array.from({ length: segs }).map((_, i) => {
          const filled = i < Math.round((pct / 100) * segs);
          return (
            <motion.div key={i}
              animate={{ background: filled ? accent : hex2rgba(accent,.1),
                boxShadow: filled ? `0 0 4px ${hex2rgba(accent,.7)}` : "none" }}
              transition={{ duration:0.3, delay: filled ? i * 0.015 : 0 }}
              style={{ flex:1, height:"5px", borderRadius:"2px" }}
            />
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ ...lbl, fontSize:"7px", color:hex2rgba(accent,.6) }}>
          {revealed}/{total} revealed
        </span>
        <span style={{ ...mono, fontSize:"11px", fontWeight:700, color:accent }}>{pct}%</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function TeamLeaderboard() {
  const [rows,    setRows]    = useState([]);
  const [reveal,  setReveal]  = useState({
    status:"hidden", intervalSeconds:10, totalTeams:0,
    revealedCount:0, remainingCount:0, displayOrder:"last-to-first",
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tick,    setTick]    = useState(0);

  const myTeamId = useMemo(() => {
    try {
      const raw = localStorage.getItem("codeverse_user");
      return raw ? JSON.parse(raw)?.teamId || null : null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const payload = await getEventLeaderboard({ limit:100 });
        if (!active) return;
        const nextRows = Array.isArray(payload?.leaderboard)
          ? payload.leaderboard.map(r => ({
              id: r.teamId, rank: Number(r.rank) || 0,
              name: r.teamName, score: Number(r.score) || 0, round: r.round || "R1",
            }))
          : [];
        setRows(nextRows);
        setReveal({
          status:          payload?.reveal?.status        || "hidden",
          intervalSeconds: Number(payload?.reveal?.intervalSeconds) || 10,
          totalTeams:      Number(payload?.reveal?.totalTeams)      || 0,
          revealedCount:   Number(payload?.reveal?.revealedCount)   || 0,
          remainingCount:  Number(payload?.reveal?.remainingCount)  || 0,
          displayOrder:    payload?.reveal?.displayOrder            || "last-to-first",
        });
        setError("");
        setTick(v => v + 1);
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load leaderboard."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void sync();
    const id = window.setInterval(() => void sync(true), LEADERBOARD_POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  const revealMeta  = REVEAL_META[reveal.status] || REVEAL_META.hidden;
  const accent      = revealMeta.accent;
  const hiddenRanks = Array.from({ length: Math.max(0, reveal.remainingCount) }, (_, i) => i + 1);
  const newestRank  = reveal.status === "revealing" && reveal.revealedCount > 0
    ? Math.max(1, reveal.totalTeams - reveal.revealedCount + 1) : null;

  const podiumTeams = rows.filter(t => t.rank <= 3 && reveal.status === "completed");
  const tableTeams  = reveal.status === "completed" ? rows.filter(t => t.rank > 3) : rows;

  return (
    <motion.section
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.35 }}
      style={{ display:"flex", flexDirection:"column", gap:"16px", ...mono, color:"#e2e8f0" }}
    >

      {/* ══ HERO HEADER ══ */}
      <div style={{
        background:"#13161e", border:`1px solid rgba(255,255,255,0.07)`,
        borderRadius:"16px", padding:"24px 28px",
        position:"relative", overflow:"hidden",
      }}>
        <ScanLine color={accent} />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:`linear-gradient(90deg,transparent,${hex2rgba(accent,.55)},transparent)` }}/>

        {/* Ambient corner glow */}
        <motion.div animate={{ opacity:[0.18,0.38,0.18] }} transition={{ duration:3.5, repeat:Infinity }}
          style={{ position:"absolute", top:"-60px", right:"-50px", width:"240px", height:"240px",
            borderRadius:"50%", background:hex2rgba(accent,.12), filter:"blur(60px)", pointerEvents:"none" }}/>
        {/* Left edge glow */}
        <motion.div animate={{ opacity:[0.12,0.28,0.12] }} transition={{ duration:4, repeat:Infinity, delay:1 }}
          style={{ position:"absolute", bottom:"-40px", left:"-30px", width:"180px", height:"180px",
            borderRadius:"50%", background:hex2rgba(accent,.1), filter:"blur(50px)", pointerEvents:"none" }}/>

        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
            flexWrap:"wrap", gap:"16px" }}>

            <div>
              {/* Live ticker label */}
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                <PulseDot color={accent} size={7} />
                <span style={{ ...lbl, fontSize:"8px", color:hex2rgba(accent,.75) }}>
                  Codeverse · Final Reveal · {LEADERBOARD_POLL_INTERVAL_MS/1000}s live sync
                </span>
              </div>

              <h1 style={{ fontSize:"26px", fontWeight:700, color:"#f8fafc",
                letterSpacing:"-0.02em", lineHeight:1.2, margin:"0 0 10px" }}>
                {revealMeta.title}
              </h1>
              <p style={{ margin:0, maxWidth:"580px", fontSize:"13px", lineHeight:1.75,
                color:"rgba(203,213,225,0.65)", fontFamily:"'Inter',sans-serif" }}>
                {revealMeta.desc}
              </p>
            </div>

            {/* Status badge */}
            <motion.div
              animate={{ boxShadow: reveal.status === "revealing"
                ? [`0 0 0px ${hex2rgba(accent,0)}`,`0 0 14px ${hex2rgba(accent,.5)}`,`0 0 0px ${hex2rgba(accent,0)}`]
                : "none" }}
              transition={{ duration:1.6, repeat:Infinity }}
              style={{
                display:"flex", alignItems:"center", gap:"9px",
                padding:"10px 18px", borderRadius:"999px",
                background: hex2rgba(accent,.09), border:`1px solid ${hex2rgba(accent,.35)}`,
              }}>
              <PulseDot color={accent} size={7} />
              <span style={{ ...mono, fontSize:"11px", fontWeight:700, letterSpacing:"0.18em",
                textTransform:"uppercase", color:accent }}>
                {revealMeta.badge}
              </span>
            </motion.div>
          </div>

          {/* ── STAT PILLS ── */}
          <div style={{ display:"flex", gap:"8px", marginTop:"18px", flexWrap:"wrap" }}>
            {[
              {
                label: "Visible",
                value: reveal.status === "hidden" ? "0" : `${rows.length}/${Math.max(reveal.totalTeams, rows.length)}`,
                accent: "#38bdf8",
              },
              {
                label: "Your Rank",
                value: (() => {
                  const mine = rows.find(r => r.id === myTeamId);
                  if (mine) return `#${mine.rank}`;
                  return reveal.status === "revealing" ? "Hidden" : reveal.status === "completed" ? "—" : "Sealed";
                })(),
                accent: "#a78bfa",
              },
              {
                label: reveal.status === "revealing" ? "Remaining" : "Syncs",
                value: reveal.status === "revealing" ? `${reveal.remainingCount}` : `${tick}`,
                accent: accent,
              },
            ].map(item => (
              <div key={item.label} style={{
                display:"flex", alignItems:"center", gap:"8px",
                padding:"8px 14px", borderRadius:"10px",
                background:`rgba(255,255,255,0.03)`, border:"1px solid rgba(255,255,255,0.07)",
              }}>
                <span style={{ ...lbl, fontSize:"8px" }}>{item.label}</span>
                <span style={{ ...mono, fontSize:"13px", fontWeight:700, color:item.accent }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* ── REVEAL PROGRESS BAR ── */}
          {reveal.status !== "hidden" && reveal.totalTeams > 0 && (
            <div style={{ marginTop:"16px" }}>
              <RevealBar total={reveal.totalTeams} revealed={reveal.revealedCount} accent={accent} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop:"14px", padding:"10px 14px", borderRadius:"10px",
              background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.28)",
              color:"#fca5a5", fontSize:"12px" }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ══ PODIUM (completed + top 3) ══ */}
      <AnimatePresence>
        {podiumTeams.length > 0 && (
          <motion.div
            key="podium"
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }}
            transition={{ duration:0.4 }}
          >
            {/* Podium header */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
              <div style={{ flex:1, height:"1px", background:"rgba(255,215,0,0.15)" }}/>
              <span style={{ ...lbl, fontSize:"8px", color:"rgba(255,215,0,0.6)",
                letterSpacing:"0.3em" }}>Top 3 Champions</span>
              <div style={{ flex:1, height:"1px", background:"rgba(255,215,0,0.15)" }}/>
            </div>

            <div style={{ display:"flex", gap:"12px", alignItems:"flex-end" }}>
              {/* Re-order: 2nd, 1st, 3rd for visual podium height */}
              {[
                podiumTeams.find(t => t.rank === 2),
                podiumTeams.find(t => t.rank === 1),
                podiumTeams.find(t => t.rank === 3),
              ].filter(Boolean).map(team => (
                <PodiumCard
                  key={team.id}
                  team={team}
                  isMine={Boolean(myTeamId) && team.id === myTeamId}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ TABLE ══ */}
      <div style={{ background:"#13161e", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:"16px", overflow:"hidden", position:"relative" }}>

        {/* Table header */}
        <div style={{
          display:"grid", gridTemplateColumns:"60px 1fr auto auto",
          gap:"12px", padding:"12px 18px",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(255,255,255,0.02)",
        }}>
          {[
            { label:"Rank", align:"left"  },
            { label:"Team", align:"left"  },
            { label:"Round", align:"left" },
            { label:"Score", align:"right"},
          ].map(col => (
            <span key={col.label} style={{ ...lbl, fontSize:"8px", textAlign:col.align }}>
              {col.label}
            </span>
          ))}
        </div>

        {/* Body */}
        {loading && rows.length === 0 ? (
          <SkeletonRows />
        ) : reveal.status === "hidden" ? (
          <LockedState accent={accent} totalTeams={reveal.totalTeams} />
        ) : (
          <div style={{ padding:"10px", display:"flex", flexDirection:"column", gap:"6px" }}>
            <AnimatePresence>
              {hiddenRanks.map(rank => (
                <PlaceholderRow key={`hidden-${rank}`} rank={rank} />
              ))}
              {tableTeams.map((team, i) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  index={i}
                  isMine={Boolean(myTeamId) && team.id === myTeamId}
                  isNewReveal={Boolean(newestRank) && team.rank === newestRank}
                />
              ))}
            </AnimatePresence>

            {!loading && reveal.status !== "hidden" && rows.length === 0 && (
              <div style={{ padding:"32px", textAlign:"center",
                color:"rgba(148,163,184,0.5)", fontSize:"12px" }}>
                Waiting for the first team to be revealed…
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding:"11px 18px",
          borderTop:"1px solid rgba(255,255,255,0.05)",
          background:"rgba(0,0,0,0.22)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          gap:"12px", flexWrap:"wrap",
        }}>
          <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.45)" }}>
            Auto-refresh every {LEADERBOARD_POLL_INTERVAL_MS/1000}s
          </span>
          <span style={{ ...lbl, fontSize:"8px", color:hex2rgba(accent,.6) }}>
            Order: {reveal.displayOrder}
          </span>
        </div>
      </div>
    </motion.section>
  );
}