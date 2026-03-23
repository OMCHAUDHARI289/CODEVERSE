import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDashboardSummary } from "../../api/adminApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const DASHBOARD_POLL_INTERVAL_MS = 10000;

const formatTimeAgo = (dateString) => {
  if (!dateString) return "just now";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (diffSec < 60)    return `${diffSec}s ago`;
  if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

const ROUND_ACCENTS = ["#f472b6","#a78bfa","#38bdf8"];

const LOG_TYPE_STYLE = {
  submit:  { color:"#34d399", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.25)"  },
  warning: { color:"#fb923c", bg:"rgba(251,146,60,0.1)",  border:"rgba(251,146,60,0.25)"  },
  start:   { color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  border:"rgba(56,189,248,0.25)"  },
  system:  { color:"rgba(148,163,184,0.5)", bg:"rgba(255,255,255,0.03)", border:"rgba(255,255,255,0.08)" },
};

/* ─── ANIMATED COUNTER ─── */
function Counter({ target, duration = 1.2 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const pct  = Math.min((ts - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      setVal(Math.round(ease * target));
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <>{val}</>;
}

/* ─── SCAN LINE ─── */
function ScanLine({ color = "#38bdf8" }) {
  return (
    <motion.div
      animate={{ top:["0%","100%"] }}
      transition={{ duration:3.5, repeat:Infinity, ease:"linear", repeatDelay:1.5 }}
      style={{ position:"absolute", left:0, right:0, height:"1px", pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,0.2)},transparent)` }}
    />
  );
}

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ ...card, padding:"20px" }}>
            <motion.div animate={{ opacity:[0.2,0.45,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.1 }}
              style={{ height:"8px", borderRadius:"4px", background:"rgba(255,255,255,0.07)", width:"60%", marginBottom:"14px" }}/>
            <motion.div animate={{ opacity:[0.2,0.45,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.1+0.1 }}
              style={{ height:"36px", borderRadius:"6px", background:"rgba(255,255,255,0.06)", width:"50%" }}/>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:"12px" }}>
        <div style={{ ...card, padding:"24px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {[70,55,65].map((w,i) => (
              <motion.div key={i} animate={{ opacity:[0.2,0.4,0.2] }}
                transition={{ duration:1.4, repeat:Infinity, delay:i*0.12 }}
                style={{ height:"11px", borderRadius:"5px", background:"rgba(255,255,255,0.07)", width:`${w}%` }}/>
            ))}
          </div>
          <div style={{ ...lbl, marginTop:"20px", display:"flex", alignItems:"center", gap:"8px",
            color:"rgba(56,189,248,0.5)" }}>
            <motion.span animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>◌</motion.span>
            Loading dashboard metrics...
          </div>
        </div>
        <div style={{ ...card, padding:"24px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {[50,80,60,75,55].map((w,i)=>(
              <motion.div key={i} animate={{ opacity:[0.2,0.4,0.2] }}
                transition={{ duration:1.4, repeat:Infinity, delay:i*0.1 }}
                style={{ height:"9px", borderRadius:"4px", background:"rgba(255,255,255,0.06)", width:`${w}%` }}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── STAT CARD ─── */
function StatCard({ label, value, accent, sub, delay=0 }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.35 }}
      whileHover={{ y:-3 }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        ...card, padding:"20px", position:"relative", overflow:"hidden",
        cursor:"default", transition:"border 0.2s",
        border: hov ? `1px solid ${hex2rgba(accent,0.35)}` : `1px solid ${hex2rgba(accent,0.18)}`,
      }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,0.65)},transparent)` }}/>
      <div style={{
        position:"absolute", left:0, top:"18%", bottom:"18%", width:"3px",
        borderRadius:"0 3px 3px 0", background: hov ? accent : "transparent", transition:"background 0.2s",
      }}/>
      <AnimatePresence>
        {hov && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"absolute", top:"-30px", left:"50%", transform:"translateX(-50%)",
              width:"120px", height:"60px", borderRadius:"50%", pointerEvents:"none",
              background:hex2rgba(accent,0.12), filter:"blur(20px)" }}/>
        )}
      </AnimatePresence>
      <p style={lbl}>{label}</p>
      <p style={{ ...mono, fontSize:"38px", fontWeight:700, marginTop:"10px",
        color: hov ? accent : "#f1f5f9", letterSpacing:"-0.02em",
        lineHeight:1, transition:"color 0.2s",
        textShadow: hov ? `0 0 20px ${hex2rgba(accent,0.4)}` : "none",
      }}>
        <Counter target={typeof value==="number" ? value : 0} />
      </p>
      {sub && <p style={{ ...lbl, marginTop:"7px", fontSize:"8px", color:hex2rgba(accent,0.55) }}>{sub}</p>}
    </motion.div>
  );
}

/* ─── PROGRESS ROW ─── */
function ProgressRow({ label, pct, accent, completed, active, delay }) {
  return (
    <motion.div initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
      transition={{ delay }} style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"3px",
            background:accent, boxShadow:`0 0 6px ${hex2rgba(accent,0.7)}` }}/>
          <span style={{ ...lbl, fontSize:"9px", color:"rgba(203,213,225,0.6)" }}>{label}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {active > 0 && (
            <span style={{ ...lbl, fontSize:"8px",
              color:accent, background:hex2rgba(accent,0.09),
              border:`1px solid ${hex2rgba(accent,0.22)}`,
              padding:"2px 8px", borderRadius:"999px" }}>
              {active} active
            </span>
          )}
          <span style={{ ...mono, fontSize:"11px", fontWeight:700, color: pct===100?"#34d399":hex2rgba(accent,0.75) }}>
            {pct}%
          </span>
        </div>
      </div>
      <div style={{ height:"5px", background:"rgba(255,255,255,0.06)",
        borderRadius:"999px", overflow:"hidden" }}>
        <motion.div
          initial={{ width:0 }} animate={{ width:`${pct}%` }}
          transition={{ delay:delay+0.3, duration:1.1, type:"spring" }}
          style={{ height:"100%", borderRadius:"999px",
            background:`linear-gradient(90deg,${accent},${hex2rgba(accent,0.6)})`,
            boxShadow:`0 0 8px ${hex2rgba(accent,0.5)}` }}
        />
      </div>
      <p style={{ ...lbl, fontSize:"7px", color:"rgba(100,116,139,0.4)" }}>
        {completed} teams completed
      </p>
    </motion.div>
  );
}

/* ─── LOG ENTRY ─── */
function LogEntry({ log, i }) {
  const s = LOG_TYPE_STYLE[log.type] ?? LOG_TYPE_STYLE.system;
  return (
    <motion.div
      initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }}
      transition={{ delay:i*0.04+0.3 }}
      style={{ display:"flex", gap:"10px", padding:"9px 0",
        borderBottom:"1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Type pill */}
      <span style={{
        ...mono, fontSize:"8px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase",
        padding:"3px 8px", borderRadius:"999px", flexShrink:0, alignSelf:"flex-start", marginTop:"1px",
        color:s.color, background:s.bg, border:`1px solid ${s.border}`,
        whiteSpace:"nowrap",
      }}>
        {log.type || "sys"}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:"12px", color:"rgba(226,232,240,0.8)", lineHeight:1.55,
          wordBreak:"break-word" }}>
          {log.message}
        </p>
        <p style={{ ...lbl, fontSize:"7px", marginTop:"3px", color:"rgba(100,116,139,0.5)" }}>
          {formatTimeAgo(log.at)}
        </p>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function DashboardPage() {
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [pulse,     setPulse]     = useState(false);
  const [summary,   setSummary]   = useState({
    event:                 { name:"Techfest CodeVerse", isLive:false },
    totals:                { teams:0, loggedInTeams:0, completedTeams:0 },
    rounds: {
      round1:              { active:0, completed:0, progressPercent:0 },
      round2:              { active:0, completed:0, progressPercent:0 },
      round3:              { active:0, completed:0, progressPercent:0 },
    },
    globalProgressPercent: 0,
    recentActivity:        [],
  });

  useEffect(() => {
    let active = true;
    const sync = async (silent=false) => {
      if (!silent && active) setLoading(true);
      try {
        const data = await getDashboardSummary();
        if (!active) return;
        setSummary(data);
        setError("");
        // flash pulse on silent poll
        if (silent) { setPulse(true); setTimeout(()=>setPulse(false),600); }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load dashboard metrics."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void sync();
    const id = setInterval(() => void sync(true), DASHBOARD_POLL_INTERVAL_MS);
    return () => { active=false; clearInterval(id); };
  }, []);

  const stats = useMemo(() => [
    { label:"Total Teams",    value:summary.totals.teams,             accent:"#38bdf8", sub:"registered",        delay:0    },
    { label:"Round 1 Active", value:summary.rounds.round1.active,     accent:"#f472b6", sub:"currently in MCQ",  delay:0.07 },
    { label:"Round 2 Active", value:summary.rounds.round2.active,     accent:"#a78bfa", sub:"in coding engine",  delay:0.14 },
    { label:"Round 3 Active", value:summary.rounds.round3.active,     accent:"#34d399", sub:"bug hunting",       delay:0.21 },
  ], [summary]);

  const progressRows = useMemo(() => [
    { label:"Round 1 · MCQ Arena",      pct:summary.rounds.round1.progressPercent, accent:ROUND_ACCENTS[0], completed:summary.rounds.round1.completed, active:summary.rounds.round1.active, delay:0.45 },
    { label:"Round 2 · Coding Engine",  pct:summary.rounds.round2.progressPercent, accent:ROUND_ACCENTS[1], completed:summary.rounds.round2.completed, active:summary.rounds.round2.active, delay:0.55 },
    { label:"Round 3 · Bug Hunter",     pct:summary.rounds.round3.progressPercent, accent:ROUND_ACCENTS[2], completed:summary.rounds.round3.completed, active:summary.rounds.round3.active, delay:0.65 },
  ], [summary]);

  const systemLogs = useMemo(() => {
    if (!summary.recentActivity.length)
      return [{ at:null, message:"No team activity yet.", type:"system" }];
    return summary.recentActivity.map(a => ({ at:a.at, message:a.message, type:a.type }));
  }, [summary.recentActivity]);

  const isLive = summary.event.isLive;

  if (loading) return <Skeleton />;

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── EVENT STATUS BANNER ── */}
      <div style={{ ...card, padding:"14px 22px", position:"relative", overflow:"hidden",
        border:`1px solid ${isLive?"rgba(52,211,153,0.25)":"rgba(251,146,60,0.2)"}` }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:`linear-gradient(90deg,transparent,${isLive?"rgba(52,211,153,0.5)":"rgba(251,146,60,0.45)"},transparent)` }}/>
        <ScanLine color={isLive?"#34d399":"#fb923c"} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          flexWrap:"wrap", gap:"12px", position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.4, repeat:Infinity }}
              style={{ width:"8px", height:"8px", borderRadius:"50%", flexShrink:0,
                background: isLive?"#34d399":"#fb923c",
                boxShadow: isLive?"0 0 9px rgba(52,211,153,0.9)":"0 0 9px rgba(251,146,60,0.9)" }}/>
            <span style={{ ...mono, fontSize:"12px", fontWeight:700,
              color: isLive?"#6ee7b7":"#fbbf24", letterSpacing:"0.06em" }}>
              {summary.event.name}
            </span>
            <span style={{ padding:"3px 10px", borderRadius:"999px",
              ...lbl, fontSize:"8px", fontWeight:700,
              color: isLive?"#34d399":"#fb923c",
              background: isLive?"rgba(52,211,153,0.1)":"rgba(251,146,60,0.1)",
              border:`1px solid ${isLive?"rgba(52,211,153,0.28)":"rgba(251,146,60,0.28)"}` }}>
              {isLive ? "Live" : "Standby"}
            </span>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
            {/* Global progress pill */}
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ ...lbl, fontSize:"8px" }}>Global Progress</span>
              <div style={{ width:"80px", height:"4px", background:"rgba(255,255,255,0.07)",
                borderRadius:"999px", overflow:"hidden" }}>
                <motion.div animate={{ width:`${summary.globalProgressPercent}%` }}
                  transition={{ duration:1.2, ease:"easeOut" }}
                  style={{ height:"100%", borderRadius:"999px",
                    background:"linear-gradient(90deg,#f472b6,#a78bfa,#38bdf8)" }}/>
              </div>
              <span style={{ ...mono, fontSize:"11px", fontWeight:700,
                color:"rgba(167,139,250,0.85)" }}>
                {summary.globalProgressPercent}%
              </span>
            </div>
            {/* Poll pulse */}
            <motion.div animate={{ opacity:pulse?1:0.25 }} transition={{ duration:0.3 }}
              style={{ ...lbl, fontSize:"8px", display:"flex", alignItems:"center", gap:"5px" }}>
              <motion.span animate={pulse?{ scale:[1,1.5,1] }:{}}
                transition={{ duration:0.4 }}
                style={{ width:"5px", height:"5px", borderRadius:"50%",
                  background:"#38bdf8", display:"inline-block" }}/>
              Auto-sync {DASHBOARD_POLL_INTERVAL_MS/1000}s
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
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

      {/* ── STAT CARDS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
        {stats.map(s => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:"12px" }}>

        {/* Event Progress */}
        <div style={{ ...card, padding:"24px 26px", position:"relative", overflow:"hidden",
          display:"flex", flexDirection:"column", gap:"22px" }}>
          <ScanLine color="#a78bfa" />
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
            background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.4),rgba(56,189,248,0.3),transparent)" }}/>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ ...lbl, color:"rgba(167,139,250,0.7)", fontSize:"10px" }}>Event Progress</p>
            <span style={{ ...mono, fontSize:"11px", fontWeight:700,
              color: summary.globalProgressPercent===100?"#34d399":"rgba(167,139,250,0.75)" }}>
              {summary.globalProgressPercent}% Complete
            </span>
          </div>

          {/* Progress rows */}
          <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
            {progressRows.map((r,i) => (
              <ProgressRow key={r.label} {...r} />
            ))}
          </div>

          {/* Sub-stat row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px",
            paddingTop:"14px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            {[
              { label:"Logged In",  value:summary.totals.loggedInTeams,  accent:"#38bdf8" },
              { label:"Completed",  value:summary.totals.completedTeams, accent:"#34d399" },
              { label:"Event",      value:isLive?"Live":"Standby",        accent:isLive?"#34d399":"#fb923c", isText:true },
            ].map(s => (
              <div key={s.label} style={{ padding:"11px 13px", borderRadius:"10px",
                background: hex2rgba(s.accent,0.06), border:`1px solid ${hex2rgba(s.accent,0.18)}` }}>
                <p style={{ ...lbl, fontSize:"8px", color:hex2rgba(s.accent,0.6), marginBottom:"7px" }}>{s.label}</p>
                <p style={{ ...mono, fontSize:"20px", fontWeight:700, color:s.accent, letterSpacing:"-0.01em" }}>
                  {s.isText ? s.value : <Counter target={s.value} />}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* System Log */}
        <div style={{ ...card, padding:"22px 22px 14px", display:"flex",
          flexDirection:"column", overflow:"hidden", position:"relative" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
            background:"linear-gradient(90deg,transparent,rgba(244,114,182,0.4),transparent)" }}/>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:"14px" }}>
            <p style={{ ...lbl, color:"rgba(244,114,182,0.65)", fontSize:"10px" }}>System Log</p>
            <span style={{ ...lbl, fontSize:"8px" }}>{systemLogs.length} entries</span>
          </div>

          {/* Log entries */}
          <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"thin",
            scrollbarColor:"rgba(255,255,255,0.08) transparent" }}>
            {systemLogs.map((log, i) => (
              <LogEntry key={i} log={log} i={i} />
            ))}
          </div>

          {/* Footer */}
          <div style={{ paddingTop:"10px", borderTop:"1px solid rgba(255,255,255,0.06)",
            marginTop:"8px", display:"flex", alignItems:"center", gap:"6px" }}>
            <motion.span animate={{ opacity:[1,0.3,1] }} transition={{ duration:2, repeat:Infinity }}
              style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#34d399",
                boxShadow:"0 0 5px rgba(52,211,153,0.8)", flexShrink:0 }}/>
            <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.5)" }}>
              Live feed · updates every {DASHBOARD_POLL_INTERVAL_MS/1000}s
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}