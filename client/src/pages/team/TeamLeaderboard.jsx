import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getEventLeaderboard } from "../../api/eventApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── DATA ─── */
const LEADERBOARD_POLL_INTERVAL_MS = 6000;

const ROUND_META = {
  R1:{ label:"Round 1", color:"#34d399", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.25)"  },
  R2:{ label:"Round 2", color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  border:"rgba(56,189,248,0.25)"  },
  R3:{ label:"Round 3", color:"#f472b6", bg:"rgba(244,114,182,0.1)", border:"rgba(244,114,182,0.25)" },
};

const RANK_STYLE = [
  { color:"#fbbf24", glow:"rgba(251,191,36,0.6)",  label:"01" },
  { color:"#cbd5e1", glow:"rgba(203,213,225,0.5)",  label:"02" },
  { color:"#fb923c", glow:"rgba(251,146,60,0.55)",  label:"03" },
];

const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };

const hex2rgba=(hex,a)=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${a})`;};

/* ─── SCORE BAR ─── */
function ScoreBar({ score, max, color }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div style={{ flex:1, height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"999px", overflow:"hidden" }}>
      <motion.div
        initial={{ width:0 }}
        animate={{ width:`${pct}%` }}
        transition={{ duration:0.8, ease:"easeOut" }}
        style={{ height:"100%", borderRadius:"999px", background:color, boxShadow:`0 0 6px ${color}` }}
      />
    </div>
  );
}

/* ─── DELTA BADGE ─── */
function DeltaBadge({ delta }) {
  if (!delta) return null;
  return (
    <AnimatePresence>
      <motion.span
        key={delta}
        initial={{ opacity:0, y:-8, scale:0.8 }}
        animate={{ opacity:1, y:0, scale:1 }}
        exit={{ opacity:0 }}
        transition={{ duration:0.35 }}
        style={{
          ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.06em",
          color:"#34d399", background:"rgba(52,211,153,0.12)",
          border:"1px solid rgba(52,211,153,0.25)",
          padding:"2px 6px", borderRadius:"999px", whiteSpace:"nowrap",
        }}
      >
        +{delta}
      </motion.span>
    </AnimatePresence>
  );
}

/* ─── ROW ─── */
function Row({ team, index, max, prevIndex, myTeamId }) {
  const isMe    = Boolean(myTeamId) && team.id === myTeamId;
  const rankMeta = RANK_STYLE[index] ?? null;
  const round   = ROUND_META[team.round];
  const moved   = prevIndex !== null && prevIndex !== index;
  const movedUp = prevIndex !== null && prevIndex > index;

  return (
    <motion.div
      layout
      layoutId={team.id}
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.97 }}
      transition={{ type:"spring", stiffness:300, damping:28 }}
      style={{
        borderRadius:"11px",
        padding:"12px 16px",
        display:"flex", alignItems:"center", gap:"12px",
        background: isMe ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.02)",
        border: isMe
          ? "1px solid rgba(56,189,248,0.25)"
          : moved
            ? "1px solid rgba(255,255,255,0.09)"
            : "1px solid rgba(255,255,255,0.05)",
        position:"relative", overflow:"hidden",
        cursor:"default",
        transition:"border 0.3s",
      }}
    >
      {/* Rank-change flash */}
      <AnimatePresence>
        {moved && (
          <motion.div
            initial={{ opacity:0.4 }} animate={{ opacity:0 }}
            transition={{ duration:1.2 }}
            style={{
              position:"absolute", inset:0, pointerEvents:"none", borderRadius:"11px",
              background: movedUp ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.06)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Me highlight bar */}
      {isMe && (
        <div style={{
          position:"absolute", left:0, top:"15%", bottom:"15%",
          width:"3px", borderRadius:"0 3px 3px 0",
          background:"#38bdf8", boxShadow:"0 0 8px rgba(56,189,248,0.7)",
        }}/>
      )}

      {/* Rank */}
      <div style={{ width:"36px", flexShrink:0, textAlign:"center" }}>
        {rankMeta ? (
          <motion.div
            animate={{ scale:[1,1.08,1] }}
            transition={{ duration:2.5, repeat:Infinity, ease:"easeInOut" }}
            style={{
              ...mono, fontSize:"15px", fontWeight:800,
              color:rankMeta.color,
              textShadow:`0 0 10px ${rankMeta.glow}`,
              letterSpacing:"-0.01em",
            }}
          >
            {rankMeta.label}
          </motion.div>
        ) : (
          <span style={{ ...mono, fontSize:"13px", fontWeight:600, color:"rgba(148,163,184,0.4)" }}>
            {String(index+1).padStart(2,"0")}
          </span>
        )}
      </div>

      {/* Team info */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"5px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{
            ...mono, fontSize:"13px", fontWeight: isMe ? 700 : 500,
            color: isMe ? "#bae6fd" : "rgba(226,232,240,0.8)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>
            {team.name}
          </span>
          {isMe && (
            <span style={{
              ...lbl, fontSize:"8px",
              color:"#38bdf8", background:"rgba(56,189,248,0.1)",
              border:"1px solid rgba(56,189,248,0.2)",
              padding:"2px 7px", borderRadius:"999px",
            }}>
              You
            </span>
          )}
          <DeltaBadge delta={team.delta} />
          {moved && (
            <motion.span
              initial={{ opacity:0, x: movedUp ? -4 : 4 }}
              animate={{ opacity:1, x:0 }}
              style={{ fontSize:"10px", color: movedUp ? "#34d399" : "#f87171" }}
            >
              {movedUp ? "↑" : "↓"}
            </motion.span>
          )}
        </div>

        {/* Score bar */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <ScoreBar score={team.score} max={max} color={isMe ? "#38bdf8" : rankMeta?.color ?? "rgba(148,163,184,0.3)"} />
        </div>
      </div>

      {/* Round badge */}
      <span style={{
        ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase",
        padding:"4px 10px", borderRadius:"999px",
        color: round.color, background: round.bg, border:`1px solid ${round.border}`,
        flexShrink:0,
      }}>
        {team.round}
      </span>

      {/* Score */}
      <motion.div
        key={team.score}
        initial={{ scale:1.15, color:"#34d399" }}
        animate={{ scale:1, color: isMe ? "#bae6fd" : "rgba(226,232,240,0.75)" }}
        transition={{ duration:0.5 }}
        style={{
          ...mono, fontSize:"16px", fontWeight:700,
          width:"52px", textAlign:"right", flexShrink:0,
          letterSpacing:"-0.01em",
        }}
      >
        {team.score}
      </motion.div>
    </motion.div>
  );
}

/* ─── MAIN ─── */
export default function TeamLeaderboard() {
  const [data, setData]       = useState([]);
  const [prevOrder, setPrev]  = useState({});
  const [tick, setTick]       = useState(0);
  const [pulse, setPulse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const myTeamId = useMemo(() => {
    try {
      const raw = localStorage.getItem("codeverse_user");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.teamId || null;
    } catch {
      return null;
    }
  }, []);

  const max = Math.max(1, ...data.map(d => d.score));

  useEffect(() => {
    let active = true;

    const syncLeaderboard = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const payload = await getEventLeaderboard({ limit: 100 });
        if (!active) return;

        const rows = Array.isArray(payload?.leaderboard) ? payload.leaderboard : [];

        setData((prev) => {
          const previousOrder = {};
          const previousScoreById = new Map();
          prev.forEach((item, index) => {
            previousOrder[item.id] = index;
            previousScoreById.set(item.id, item.score);
          });
          setPrev(previousOrder);

          return rows.map((row) => {
            const currentScore = Number(row.score) || 0;
            const previousScore = previousScoreById.get(row.teamId);
            const delta = typeof previousScore === "number"
              ? Math.max(0, currentScore - previousScore)
              : 0;
            return {
              id: row.teamId,
              name: row.teamName,
              score: currentScore,
              round: row.round,
              delta
            };
          });
        });

        setTick((value) => value + 1);
        setPulse(true);
        setTimeout(() => {
          if (active) setPulse(false);
        }, 800);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load leaderboard."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void syncLeaderboard();
    const id = setInterval(() => {
      void syncLeaderboard(true);
    }, LEADERBOARD_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <motion.section
      initial={{ opacity:0, y:10 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── HEADER CARD ── */}
      <div style={{ ...card, padding:"22px 26px", position:"relative", overflow:"hidden" }}>
        {/* Top shimmer line */}
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:"1px",
          background:"linear-gradient(90deg,transparent,rgba(244,114,182,0.4),rgba(56,189,248,0.4),transparent)",
        }}/>

        {/* Ambient */}
        <motion.div
          animate={{ opacity:[0.2,0.4,0.2] }}
          transition={{ duration:3.5, repeat:Infinity }}
          style={{
            position:"absolute", top:"-50px", right:"-50px",
            width:"200px", height:"200px", borderRadius:"50%",
            background:"rgba(244,114,182,0.08)", filter:"blur(50px)", pointerEvents:"none",
          }}
        />

        <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <p style={lbl}>Codeverse · Live Rankings</p>
            <h2 style={{ fontSize:"22px", fontWeight:700, color:"#f1f5f9", marginTop:"6px", letterSpacing:"-0.01em" }}>
              Leaderboard
            </h2>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {/* Live pulse indicator */}
            <div style={{
              display:"flex", alignItems:"center", gap:"7px",
              padding:"6px 13px", borderRadius:"999px",
              background:"rgba(244,114,182,0.08)",
              border:"1px solid rgba(244,114,182,0.22)",
            }}>
              <motion.span
                animate={{ opacity:[1,0.2,1], scale:[1,0.7,1] }}
                transition={{ duration:1.4, repeat:Infinity }}
                style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#f472b6", boxShadow:"0 0 7px rgba(244,114,182,0.9)" }}
              />
              <span style={{ fontSize:"9px", letterSpacing:"0.2em", textTransform:"uppercase", color:"#f472b6", fontWeight:700 }}>
                Live
              </span>
            </div>

            {/* Update counter */}
            <div style={{
              padding:"6px 13px", borderRadius:"999px",
              background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.07)",
              fontSize:"9px", letterSpacing:"0.18em", textTransform:"uppercase",
              color:"rgba(148,163,184,0.45)",
            }}>
              {tick} updates
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop:"14px",
            padding:"10px 12px",
            borderRadius:"9px",
            border:"1px solid rgba(248,113,113,0.3)",
            background:"rgba(248,113,113,0.08)",
            color:"#fca5a5",
            fontSize:"11px"
          }}>
            {error}
          </div>
        )}

        {/* Stat pills */}
        <div style={{ display:"flex", gap:"8px", marginTop:"16px", flexWrap:"wrap", position:"relative", zIndex:1 }}>
          {[
            { label:"Teams",   value:data.length,                          color:"#38bdf8" },
            { label:"Top Score", value:max,                                color:"#fbbf24" },
            {
              label:"Your Rank",
              value: myTeamId
                ? (() => {
                    const index = data.findIndex((d) => d.id === myTeamId);
                    return index >= 0 ? `#${index + 1}` : "-";
                  })()
                : "-",
              color:"#34d399"
            },
          ].map(p => (
            <div key={p.label} style={{
              display:"flex", alignItems:"center", gap:"8px",
              padding:"6px 14px", borderRadius:"9px",
              background: hex2rgba(p.color, 0.07),
              border:`1px solid ${hex2rgba(p.color,0.2)}`,
            }}>
              <span style={{ ...lbl, fontSize:"8px", color: hex2rgba(p.color,0.65) }}>{p.label}</span>
              <span style={{ ...mono, fontSize:"13px", fontWeight:700, color:p.color }}>{p.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ ...card, overflow:"hidden" }}>
        {/* Column headers */}
        <div style={{
          display:"grid", gridTemplateColumns:"52px 1fr 70px 60px",
          padding:"10px 16px",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(255,255,255,0.02)",
          gap:"12px",
        }}>
          {["Rank","Team","Round","Score"].map((h,i) => (
            <span key={h} style={{ ...lbl, fontSize:"8px", textAlign: i===3 ? "right" : "left" }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ padding:"10px", display:"flex", flexDirection:"column", gap:"6px" }}>
          {loading && (
            <div style={{ ...lbl, padding:"8px 4px", color:"rgba(148,163,184,0.6)" }}>
              Syncing leaderboard...
            </div>
          )}
          <AnimatePresence>
            {data.map((team, index) => (
              <Row
                key={team.id}
                team={team}
                index={index}
                max={max}
                prevIndex={prevOrder[team.id] ?? index}
                myTeamId={myTeamId}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div
          animate={{ opacity: pulse ? 1 : 0.4 }}
          transition={{ duration:0.4 }}
          style={{
            padding:"10px 18px",
            borderTop:"1px solid rgba(255,255,255,0.05)",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.45)" }}>
            Auto-refresh every 6s
          </span>
          <div style={{ display:"flex", gap:"6px" }}>
            {Object.values(ROUND_META).map(r => (
              <span key={r.label} style={{
                ...lbl, fontSize:"7px", padding:"2px 8px", borderRadius:"999px",
                color:r.color, border:`1px solid ${r.border}`,
                background: hex2rgba(r.color,0.07),
              }}>
                {r.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
