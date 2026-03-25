import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAdminLeaderboard } from "../../api/adminApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const LEADERBOARD_POLL_INTERVAL_MS = 8000;

const RANK_META = [
  { color:"#fbbf24", glow:"rgba(251,191,36,0.7)",  label:"01", sub:"Gold"   },
  { color:"#cbd5e1", glow:"rgba(203,213,225,0.6)",  label:"02", sub:"Silver" },
  { color:"#fb923c", glow:"rgba(251,146,60,0.65)",  label:"03", sub:"Bronze" },
];

const ROUND_META = {
  R1:{ color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  border:"rgba(56,189,248,0.25)"  },
  R2:{ color:"#a78bfa", bg:"rgba(167,139,250,0.1)", border:"rgba(167,139,250,0.25)" },
  R3:{ color:"#f472b6", bg:"rgba(244,114,182,0.1)", border:"rgba(244,114,182,0.25)" },
};

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

/* ─── SCAN LINE ─── */
function ScanLine({ color="#f472b6" }) {
  return (
    <motion.div
      animate={{ top:["0%","100%"] }}
      transition={{ duration:3.5, repeat:Infinity, ease:"linear", repeatDelay:2 }}
      style={{ position:"absolute", left:0, right:0, height:"1px",
        pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,0.2)},transparent)` }}
    />
  );
}

/* ─── ANIMATED COUNTER ─── */
function Counter({ target }) {
  const [val, setVal] = useState(0);
  useEffect(()=>{
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const pct  = Math.min((ts-start)/1200, 1);
      const ease = 1 - Math.pow(1-pct, 3);
      setVal(Math.round(ease*target));
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return <>{val}</>;
}

/* ─── SCORE BAR ─── */
function ScoreBar({ score, max, accent }) {
  const pct = max ? Math.min((score/max)*100, 100) : 0;
  return (
    <div style={{ flex:1, height:"3px", background:"rgba(255,255,255,0.06)",
      borderRadius:"999px", overflow:"hidden" }}>
      <motion.div
        initial={{ width:0 }} animate={{ width:`${pct}%` }}
        transition={{ duration:0.8, ease:"easeOut" }}
        style={{ height:"100%", borderRadius:"999px",
          background:accent, boxShadow:`0 0 5px ${hex2rgba(accent,0.6)}` }}
      />
    </div>
  );
}

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{ padding:"12px 18px",
          borderBottom:"1px solid rgba(255,255,255,0.04)",
          display:"flex", alignItems:"center", gap:"14px" }}>
          <motion.div animate={{ opacity:[0.15,0.38,0.15] }}
            transition={{ duration:1.4, repeat:Infinity, delay:i*0.09 }}
            style={{ width:"36px", height:"36px", borderRadius:"10px",
              background:"rgba(255,255,255,0.07)", flexShrink:0 }}/>
          {[35,18,12,14].map((w,j)=>(
            <motion.div key={j} animate={{ opacity:[0.15,0.32,0.15] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.09+j*0.06 }}
              style={{ height:"10px", borderRadius:"5px", background:"rgba(255,255,255,0.07)",
                width:`${w}%`, flexShrink:j===0?1:0 }}/>
          ))}
        </div>
      ))}
    </>
  );
}

/* ─── LEADERBOARD ROW ─── */
function LeaderRow({ team, index, maxScore, prevIndex }) {
  const rankMeta  = RANK_META[index] ?? null;
  const roundMeta = ROUND_META[team.round] ?? ROUND_META.R1;
  const isTop3    = index < 3;
  const moved     = prevIndex !== null && prevIndex !== undefined && prevIndex !== index;
  const movedUp   = moved && prevIndex > index;
  const [hov, setHov] = useState(false);

  const accent = rankMeta?.color ?? "rgba(148,163,184,0.4)";

  return (
    <motion.div
      layout layoutId={team.id}
      initial={{ opacity:0, y:14 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.97 }}
      transition={{ type:"spring", stiffness:300, damping:26 }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        position:"relative", display:"flex", alignItems:"center",
        gap:"12px", padding:"11px 18px",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        background: isTop3
          ? `rgba(${parseInt(accent.slice(1,3)||"ff",16)},${parseInt(accent.slice(3,5)||"ff",16)},${parseInt(accent.slice(5,7)||"ff",16)},${hov?0.07:0.04})`
          : hov ? "rgba(255,255,255,0.025)" : "transparent",
        transition:"background 0.14s",
        overflow:"hidden",
      }}
    >
      {/* Rank-change flash */}
      <AnimatePresence>
        {moved && (
          <motion.div initial={{ opacity:0.35 }} animate={{ opacity:0 }}
            transition={{ duration:1.2 }}
            style={{ position:"absolute", inset:0, pointerEvents:"none",
              background:movedUp?"rgba(52,211,153,0.08)":"rgba(239,68,68,0.06)" }}/>
        )}
      </AnimatePresence>

      {/* Left glow bar for top 3 */}
      {isTop3 && (
        <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%",
          width:"3px", borderRadius:"0 3px 3px 0",
          background:accent, boxShadow:`0 0 8px ${hex2rgba(accent,0.7)}` }}/>
      )}

      {/* Rank badge */}
      <div style={{
        width:"38px", height:"38px", borderRadius:"10px", flexShrink:0,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        background: rankMeta ? hex2rgba(rankMeta.color,0.14) : "rgba(255,255,255,0.04)",
        border: rankMeta ? `1px solid ${hex2rgba(rankMeta.color,0.3)}` : "1px solid rgba(255,255,255,0.07)",
        boxShadow: rankMeta ? `0 0 12px ${hex2rgba(rankMeta.color,0.25)}` : "none",
      }}>
        {rankMeta ? (
          <motion.span animate={{ scale:[1,1.08,1] }} transition={{ duration:2.5, repeat:Infinity }}
            style={{ ...mono, fontSize:"13px", fontWeight:800, color:rankMeta.color,
              textShadow:`0 0 10px ${rankMeta.glow}`, lineHeight:1 }}>
            {rankMeta.label}
          </motion.span>
        ) : (
          <span style={{ ...mono, fontSize:"12px", fontWeight:600,
            color:"rgba(148,163,184,0.35)", lineHeight:1 }}>
            {String(index+1).padStart(2,"0")}
          </span>
        )}
      </div>

      {/* Team name + bar */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"5px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ ...mono, fontSize:"13px", fontWeight:isTop3?700:500,
            color:isTop3?"#f1f5f9":"rgba(226,232,240,0.8)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {team.name}
          </span>
          {isTop3 && (
            <span style={{ ...lbl, fontSize:"7px", padding:"2px 7px", borderRadius:"999px",
              color:accent, background:hex2rgba(accent,0.1), border:`1px solid ${hex2rgba(accent,0.25)}`,
              flexShrink:0 }}>
              {rankMeta.sub}
            </span>
          )}
          {moved && (
            <motion.span initial={{ opacity:0, x:movedUp?-4:4 }} animate={{ opacity:1, x:0 }}
              style={{ fontSize:"11px", color:movedUp?"#34d399":"#f87171", flexShrink:0 }}>
              {movedUp?"↑":"↓"}
            </motion.span>
          )}
        </div>
        <ScoreBar score={team.score} max={maxScore} accent={accent} />
      </div>

      {/* Round badge */}
      <span style={{ ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.14em",
        padding:"4px 10px", borderRadius:"999px", flexShrink:0,
        color:roundMeta.color, background:roundMeta.bg, border:`1px solid ${roundMeta.border}` }}>
        {team.round}
      </span>

      {/* Score */}
      <motion.span key={team.score}
        initial={{ scale:1.15, color:"#34d399" }}
        animate={{ scale:1, color:isTop3?accent:"rgba(203,213,225,0.7)" }}
        transition={{ duration:0.5 }}
        style={{ ...mono, fontSize:"16px", fontWeight:700,
          width:"54px", textAlign:"right", letterSpacing:"-0.01em", flexShrink:0 }}>
        <Counter target={team.score} />
      </motion.span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function LeaderboardPage() {
  const [data,       setData]       = useState([]);
  const [prevOrder,  setPrevOrder]  = useState({});
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulse,      setPulse]      = useState(false);
  const [tick,       setTick]       = useState(0);

  useEffect(()=>{
    let active = true;
    const sync = async (silent=false) => {
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const payload = await getAdminLeaderboard({ limit:100 });
        if (!active) return;
        const rows = Array.isArray(payload?.leaderboard) ? payload.leaderboard : [];

        // Track prev positions for move indicators
        const order = {};
        rows.forEach((r,i) => order[r.teamId] = i);
        setPrevOrder(order);

        setData(rows.map(r=>({
          id:    r.teamId,
          name:  r.teamName,
          score: r.score,
          round: r.round,
          rank:  r.rank,
        })));
        setError("");
        if (silent) { setPulse(true); setTick(t=>t+1); setTimeout(()=>setPulse(false),700); }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load leaderboard."));
      } finally {
        if (active) { setRefreshing(false); setLoading(false); }
      }
    };
    void sync();
    const id = setInterval(()=>void sync(true), LEADERBOARD_POLL_INTERVAL_MS);
    return ()=>{ active=false; clearInterval(id); };
  }, []);

  const maxScore = data.length ? Math.max(...data.map(d=>d.score), 1) : 1;

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ width:"100%", display:"flex",
        flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── HEADER CARD ── */}
      <div style={{ ...card, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <ScanLine />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(244,114,182,0.45),rgba(251,191,36,0.4),transparent)" }}/>
        <motion.div animate={{ height:["30%","70%","30%"] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
            width:"3px", borderRadius:"0 3px 3px 0",
            background:"linear-gradient(to bottom,transparent,#f472b6,transparent)" }}/>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          flexWrap:"wrap", gap:"12px", position:"relative", zIndex:1 }}>
          <div>
            <p style={{ ...lbl, color:"rgba(244,114,182,0.65)" }}>Admin · Live Rankings</p>
            <h2 style={{ fontSize:"20px", fontWeight:700, color:"#f1f5f9",
              marginTop:"5px", letterSpacing:"-0.01em" }}>Global Ranking</h2>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            {/* Update counter */}
            <div style={{ padding:"5px 12px", borderRadius:"999px",
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
              ...lbl, fontSize:"8px" }}>
              {tick} updates
            </div>

            {/* Live pill */}
            <div style={{ display:"flex", alignItems:"center", gap:"7px",
              padding:"6px 13px", borderRadius:"999px",
              background: pulse?"rgba(244,114,182,0.12)":"rgba(244,114,182,0.07)",
              border:"1px solid rgba(244,114,182,0.25)", transition:"background 0.3s" }}>
              <motion.span
                animate={{ opacity:[1,0.2,1], scale:[1,0.7,1] }}
                transition={{ duration:1.4, repeat:Infinity }}
                style={{ width:"6px", height:"6px", borderRadius:"50%",
                  background:"#f472b6", boxShadow:"0 0 7px rgba(244,114,182,0.9)" }}/>
              <span style={{ fontSize:"9px", letterSpacing:"0.2em", textTransform:"uppercase",
                color:"#f472b6", fontWeight:700 }}>
                {refreshing ? "Syncing" : "Live"}
              </span>
            </div>
          </div>
        </div>

        {/* Top-3 podium strips */}
        {!loading && data.length >= 3 && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
            style={{ display:"flex", gap:"8px", marginTop:"16px", position:"relative", zIndex:1 }}>
            {[1,0,2].map(pos=>{
              const team = data[pos];
              const rm   = RANK_META[pos];
              return (
                <div key={pos} style={{ flex:1, padding:"10px 12px", borderRadius:"10px",
                  background:hex2rgba(rm.color,0.07), border:`1px solid ${hex2rgba(rm.color,0.22)}`,
                  display:"flex", flexDirection:"column", gap:"3px",
                  order: pos===0?1:pos===1?0:2 }}>
                  <p style={{ ...lbl, fontSize:"7px", color:hex2rgba(rm.color,0.6) }}>{rm.sub}</p>
                  <p style={{ ...mono, fontSize:"12px", fontWeight:700, color:rm.color,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {team.name}
                  </p>
                  <p style={{ ...lbl, fontSize:"8px", color:hex2rgba(rm.color,0.55) }}>
                    {team.score} pts
                  </p>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── ERROR ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ padding:"10px 16px", borderRadius:"10px",
              background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.3)",
              display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ color:"#f87171", fontSize:"12px", flexShrink:0 }}>⚠</span>
            <span style={{ fontSize:"12px", color:"#fca5a5", flex:1 }}>{error}</span>
            <button onClick={()=>setError("")} style={{ background:"none", border:"none",
              color:"rgba(148,163,184,0.5)", cursor:"pointer", fontSize:"14px", padding:0 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TABLE ── */}
      <div style={{ ...card, overflow:"hidden" }}>
        {/* Column headers */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px",
          padding:"10px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(255,255,255,0.02)" }}>
          <div style={{ width:"38px", flexShrink:0 }}>
            <span style={{ ...lbl, fontSize:"8px" }}>Rank</span>
          </div>
          <span style={{ ...lbl, fontSize:"8px", flex:1 }}>Team</span>
          <span style={{ ...lbl, fontSize:"8px", width:"70px", flexShrink:0 }}>Round</span>
          <span style={{ ...lbl, fontSize:"8px", width:"54px", textAlign:"right", flexShrink:0 }}>Score</span>
        </div>

        {/* Rows */}
        <div>
          {loading ? (
            <Skeleton />
          ) : data.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center",
              display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"22px" }}>○</span>
              <p style={{ ...lbl, fontSize:"10px", color:"rgba(100,116,139,0.5)" }}>
                No leaderboard data yet
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {data.map((team, index) => (
                <LeaderRow
                  key={team.id}
                  team={team}
                  index={index}
                  maxScore={maxScore}
                  prevIndex={prevOrder[team.id] ?? index}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {!loading && data.length > 0 && (
          <div style={{ padding:"10px 18px", borderTop:"1px solid rgba(255,255,255,0.05)",
            background:"rgba(0,0,0,0.2)", display:"flex", alignItems:"center",
            justifyContent:"space-between" }}>
            <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.4)" }}>
              {data.length} teams · auto-refresh {LEADERBOARD_POLL_INTERVAL_MS/1000}s
            </span>
            <div style={{ display:"flex", gap:"10px" }}>
              {Object.entries(ROUND_META).map(([k,v])=>(
                <div key={k} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                  <div style={{ width:"6px", height:"6px", borderRadius:"3px",
                    background:v.color, boxShadow:`0 0 4px ${hex2rgba(v.color,0.6)}` }}/>
                  <span style={{ ...lbl, fontSize:"7px", color:hex2rgba(v.color,0.65) }}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
