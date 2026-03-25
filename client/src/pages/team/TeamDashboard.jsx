import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUser
} from "../../api/authApi";
import { getEventStatus } from "../../api/eventApi";
import { getRound1Status } from "../../api/round1Api";
import { getApiErrorMessage } from "../../api/httpClient";
import { ROUND_CONFIG } from "../../data/roundConfig";

/* ─── CONSTANTS ─── */
const DASHBOARD_POLL_INTERVAL_MS = 20000;

const RULES = [
  { n:"01", title:"Linear Progression",  accent:"#38bdf8", body:"You cannot return to a previous round once you proceed. Plan your submissions carefully." },
  { n:"02", title:"Timer Constraints",   accent:"#a78bfa", body:"The global timer runs continuously. Depletion results in immediate session termination." },
  { n:"03", title:"Lifeline Mechanics",  accent:"#fb923c", body:"Two lifelines are available in Round 2 and Round 3 after 15 minutes. Approved requests deduct 10 points in Round 2 and 20 points in Round 3." },
  { n:"04", title:"Session Integrity",   accent:"#34d399", body:"Ungraceful disconnection flags your team for review. Maintain stable connection." },
];

const NOTES = [
  "Review round instructions before starting each arena.",
  "Track score by round to plan risk and submission strategy.",
  "Keep one teammate focused on final validation before submit.",
];

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

const getRoundTitle = (id) => {
  if (id===1) return ROUND_CONFIG.round1.title;
  if (id===2) return ROUND_CONFIG.round2.title;
  if (id===3) return ROUND_CONFIG.round3.title;
  return "Completed";
};

/* ─── SCAN LINE ─── */
function ScanLine({ color="#38bdf8" }) {
  return (
    <motion.div
      animate={{ top:["0%","100%"] }}
      transition={{ duration:3.5, repeat:Infinity, ease:"linear", repeatDelay:1.5 }}
      style={{ position:"absolute", left:0, right:0, height:"1px",
        pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,0.18)},transparent)` }}
    />
  );
}

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono }}>
      {/* Hero skeleton */}
      <div style={{ ...card, padding:"28px 30px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[35,60,50,40].map((w,i) => (
            <motion.div key={i} animate={{ opacity:[0.2,0.45,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.1 }}
              style={{ height:"11px", borderRadius:"5px", background:"rgba(255,255,255,0.07)", width:`${w}%` }}/>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"24px",
          ...lbl, color:"rgba(56,189,248,0.5)" }}>
          <motion.span animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>◌</motion.span>
          Syncing dashboard...
        </div>
      </div>
      {/* Stat skeletons */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ ...card, padding:"18px 20px" }}>
            <motion.div animate={{ opacity:[0.2,0.4,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.12 }}
              style={{ height:"8px", borderRadius:"4px", background:"rgba(255,255,255,0.07)", width:"55%", marginBottom:"12px" }}/>
            <motion.div animate={{ opacity:[0.2,0.4,0.2] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.12+0.1 }}
              style={{ height:"22px", borderRadius:"5px", background:"rgba(255,255,255,0.06)", width:"70%" }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── STAT CARD ─── */
function StatCard({ stat, i }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:i*0.06+0.15 }}
      whileHover={{ y:-3 }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        ...card, padding:"18px 20px", position:"relative", overflow:"hidden",
        cursor:"default", transition:"border 0.2s",
        border: hov ? `1px solid ${hex2rgba(stat.accent,0.3)}` : `1px solid ${hex2rgba(stat.accent,0.18)}`,
      }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(stat.accent,0.65)},transparent)` }}/>
      {/* Left bar */}
      <div style={{
        position:"absolute", left:0, top:"20%", bottom:"20%", width:"3px",
        borderRadius:"0 3px 3px 0", transition:"background 0.2s",
        background: hov ? stat.accent : "transparent",
      }}/>
      {/* Top glow */}
      <AnimatePresence>
        {hov && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"absolute", top:"-30px", left:"50%", transform:"translateX(-50%)",
              width:"120px", height:"60px", borderRadius:"50%", pointerEvents:"none",
              background:hex2rgba(stat.accent,0.12), filter:"blur(20px)" }}/>
        )}
      </AnimatePresence>
      <p style={lbl}>{stat.label}</p>
      <p style={{ ...mono, marginTop:"10px", fontSize:"24px", fontWeight:700,
        color: hov ? stat.accent : "#f1f5f9", letterSpacing:"0.02em", transition:"color 0.2s" }}>
        {stat.value}
      </p>
      <p style={{ ...lbl, marginTop:"5px", fontSize:"8px", color:hex2rgba(stat.accent,0.55) }}>
        {stat.sub}
      </p>
    </motion.div>
  );
}

/* ─── ROUND STRIP ─── */
function RoundStrip({ rounds }) {
  return (
    <div style={{ ...card, padding:"18px 22px", overflow:"hidden", position:"relative" }}>
      <ScanLine />
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.3),rgba(167,139,250,0.3),transparent)" }}/>
      <p style={{ ...lbl, marginBottom:"16px" }}>Round Progression</p>
      <div style={{ display:"flex", alignItems:"center" }}>
        {rounds.map((r, i) => {
          const isActive = r.status==="active";
          const isLocked = r.status==="locked";
          const isDone   = r.status==="done";
          return (
            <div key={r.code} style={{ display:"flex", alignItems:"center", flex:1 }}>
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
                <motion.div
                  whileHover={isLocked?{}:{ scale:1.08 }}
                  style={{
                    width:"42px", height:"42px", borderRadius:"11px",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    ...mono, fontSize:"11px", fontWeight:700, position:"relative",
                    background: isActive ? hex2rgba(r.accent,0.15) : isDone ? hex2rgba(r.accent,0.1) : "rgba(255,255,255,0.03)",
                    border: isActive ? `1px solid ${hex2rgba(r.accent,0.5)}` : isDone ? `1px solid ${hex2rgba(r.accent,0.25)}` : "1px solid rgba(255,255,255,0.07)",
                    color: isActive ? r.accent : isDone ? r.accent : "rgba(148,163,184,0.3)",
                    boxShadow: isActive ? `0 0 14px ${hex2rgba(r.accent,0.3)}` : "none",
                    transition:"all 0.2s",
                  }}
                >
                  {isActive && (
                    <motion.div animate={{ opacity:[0.4,0.85,0.4] }} transition={{ duration:2, repeat:Infinity }}
                      style={{ position:"absolute", inset:"-4px", borderRadius:"14px",
                        border:`1px solid ${hex2rgba(r.accent,0.35)}`, pointerEvents:"none" }}/>
                  )}
                  {isDone ? "✓" : isLocked ? "○" : r.code}
                </motion.div>
                <p style={{ ...lbl, fontSize:"8px", textAlign:"center",
                  color: isActive ? r.accent : isDone ? hex2rgba(r.accent,0.6) : "rgba(100,116,139,0.45)" }}>
                  {r.label}
                </p>
                {r.points && (
                  <p style={{ ...lbl, fontSize:"7px", color:"rgba(100,116,139,0.4)" }}>{r.points} pts</p>
                )}
              </div>
              {i < rounds.length-1 && (
                <div style={{
                  height:"1px", width:"100%", margin:"0 4px", alignSelf:"flex-start", marginTop:"21px", flexShrink:0,
                  background: isDone ? `linear-gradient(90deg,${r.accent},${rounds[i+1].accent})` : "rgba(255,255,255,0.06)",
                  transition:"background 0.4s",
                }}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RULES MODAL ─── */
function RulesModal({ onClose }) {
  const [active, setActive] = useState(null);
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center",
        justifyContent:"center", background:"rgba(0,0,0,0.82)",
        backdropFilter:"blur(10px)", padding:"16px" }}
    >
      <motion.div initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }}
        exit={{ scale:0.95, y:20 }}
        transition={{ type:"spring", stiffness:360, damping:28 }}
        style={{ ...card, width:"100%", maxWidth:"500px", overflow:"hidden",
          boxShadow:"0 40px 100px rgba(0,0,0,0.8)" }}
      >
        {/* Header */}
        <div style={{ padding:"18px 22px", borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(56,189,248,0.04)", position:"relative", overflow:"hidden",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
            background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.4),transparent)" }}/>
          <div>
            <p style={{ ...lbl, color:"rgba(56,189,248,0.65)", marginBottom:"4px" }}>Codeverse</p>
            <p style={{ ...mono, fontSize:"14px", fontWeight:700, color:"#f1f5f9" }}>Arena Protocol</p>
          </div>
          <button onClick={onClose} style={{
            width:"28px", height:"28px", borderRadius:"8px",
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
            color:"rgba(148,163,184,0.6)", fontSize:"13px", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.14s", ...mono,
          }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.color="#e2e8f0";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="rgba(148,163,184,0.6)";}}
          >✕</button>
        </div>

        {/* Rules list */}
        <div style={{ padding:"8px 14px 14px", maxHeight:"60vh", overflowY:"auto" }}>
          {RULES.map((rule, i) => (
            <motion.div key={rule.n}
              initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
              transition={{ delay:i*0.06 }}
              onClick={() => setActive(active===i?null:i)}
              style={{
                borderRadius:"11px", padding:"12px 14px", marginTop:"7px", cursor:"pointer",
                transition:"all 0.17s",
                background: active===i ? hex2rgba(rule.accent,0.07) : "transparent",
                border: active===i ? `1px solid ${hex2rgba(rule.accent,0.28)}` : "1px solid transparent",
              }}
              onMouseEnter={e=>{ if(active!==i){e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";}}}
              onMouseLeave={e=>{ if(active!==i){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}}
            >
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <span style={{ ...mono, fontSize:"11px", fontWeight:700, color:rule.accent,
                  opacity:0.7, width:"24px", flexShrink:0 }}>{rule.n}</span>
                <span style={{ ...mono, fontSize:"12px", fontWeight:600,
                  color:"rgba(226,232,240,0.85)", flex:1 }}>{rule.title}</span>
                <motion.span animate={{ rotate:active===i?90:0 }}
                  style={{ color:"rgba(148,163,184,0.35)", fontSize:"12px" }}>›</motion.span>
              </div>
              <AnimatePresence>
                {active===i && (
                  <motion.p initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                    exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
                    style={{ fontSize:"12px", lineHeight:1.7, color:"rgba(203,213,225,0.55)",
                      marginTop:"10px", marginLeft:"36px", overflow:"hidden" }}>
                    {rule.body}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 22px", borderTop:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(0,0,0,0.3)", display:"flex",
          justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.4)" }}>
            {RULES.length} protocols · tap to expand
          </p>
          <motion.button whileTap={{ scale:0.97 }} onClick={onClose} style={{
            padding:"9px 26px", borderRadius:"9px", ...mono,
            fontSize:"11px", fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase",
            cursor:"pointer", border:"1px solid rgba(56,189,248,0.3)",
            background:"rgba(56,189,248,0.1)", color:"#7dd3fc", transition:"all 0.14s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(56,189,248,0.2)";e.currentTarget.style.borderColor="rgba(56,189,248,0.5)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(56,189,248,0.1)";e.currentTarget.style.borderColor="rgba(56,189,248,0.3)";}}
          >Acknowledge</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function TeamDashboard() {
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [showRules,  setShowRules]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eventLive,  setEventLive]  = useState(false);
  const [team, setTeam] = useState({
    teamName:"Team", teamId:"T1", currentRound:1,
    totalScore:0, scores:{ round1:0, round2:0, round3:0 }, members:[],
  });
  const [round1, setRound1] = useState({
    started:false, submitted:false,
    warningCount:0, maxWarnings:ROUND_CONFIG.round1.maxWarnings,
  });

  const syncDashboard = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [userResp, eventResp] = await Promise.all([getCurrentUser(), getEventStatus()]);
      const apiTeam = userResp?.team || {};
      const currentRound = Number(apiTeam.currentRound) || 1;
      const normalizedTeam = {
        teamName:    apiTeam.teamName    || "Team",
        teamId:      apiTeam.teamId      || "T1",
        currentRound,
        totalScore:  Number(apiTeam.totalScore) || 0,
        scores:      apiTeam.scores || { round1:0, round2:0, round3:0 },
        members:     Array.isArray(apiTeam.members) ? apiTeam.members : [],
      };
      setTeam(normalizedTeam);
      setEventLive(Boolean(eventResp?.isLive));
      setError("");
      if (currentRound === 1) {
        const r1 = await getRound1Status();
        setRound1({ started:Boolean(r1?.started), submitted:Boolean(r1?.submitted),
          warningCount:Number(r1?.warningCount)||0, maxWarnings:Number(r1?.maxWarnings)||ROUND_CONFIG.round1.maxWarnings });
      } else {
        setRound1(p => ({ ...p, started:false, submitted:true }));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load dashboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => { if (active) await syncDashboard(); };
    void run();
    const id = setInterval(() => { void run(); }, DASHBOARD_POLL_INTERVAL_MS);
    return () => { active = false; clearInterval(id); };
  }, [syncDashboard]);

  const primaryAction = useMemo(() => {
    if (team.currentRound === 1) {
      if (!eventLive && !round1.started) return { label:"Awaiting Admin Start", to:"/team", disabled:true, helper:"Event is not live yet." };
      if (round1.submitted)             return { label:"Go To Round 2",         to:"/team/round2", disabled:false, helper:"Round 1 already submitted." };
      if (round1.started)               return { label:"Continue Round 1",      to:ROUND_CONFIG.round1.routes.arena, disabled:false, helper:`Warnings: ${round1.warningCount}/${round1.maxWarnings}` };
      return { label:"Initialize Round 1", to:ROUND_CONFIG.round1.routes.terms, disabled:false, helper:`${Math.floor(ROUND_CONFIG.round1.durationSeconds/60)} minutes` };
    }
    if (team.currentRound===2) return { label:"Open Round 2",   to:"/team/round2",      disabled:false, helper:"Coding round active."     };
    if (team.currentRound===3) return { label:"Open Round 3",   to:"/team/round3",      disabled:false, helper:"Final debugging round."   };
    // FIX: After all rounds, show leaderboard
    return                          { label:"View Leaderboard", to:"/team/leaderboard", disabled:false, helper:"All rounds completed."     };
  }, [eventLive, round1, team.currentRound]);

  const stats = useMemo(() => [
    { label:"Current Round", value:`R${team.currentRound}`, accent:"#38bdf8", sub:getRoundTitle(team.currentRound) },
    { label:"Total Score",   value:String(team.totalScore), accent:"#34d399", sub:"Live from backend" },
    // FIX: Show only PREVIOUS round score, not current round
    { label:"Previous Round Score", value:team.currentRound === 1 ? "0/0" : (team.currentRound === 2 ? `${team.scores?.round1||0}/${ROUND_CONFIG.round1.maxScore}` : `${team.scores?.round2||0}/${ROUND_CONFIG.round2.maxScore}`), accent:"#a78bfa", sub:team.currentRound === 1 ? "N/A" : (team.currentRound === 2 ? "Round 1 Score" : "Round 2 Score") },
    { label:"Event Status",  value:eventLive?"Live":"Standby", accent:eventLive?"#22c55e":"#fb923c", sub:eventLive?"Rounds available":"Waiting for admin" },
  ], [eventLive, team.currentRound, team.scores?.round1, team.scores?.round2, team.totalScore]);

  const rounds = useMemo(() => {
    const c = team.currentRound;
    const roundsArray = [
      { code:"R1", label:"MCQ Arena",      accent:"#38bdf8", points:ROUND_CONFIG.round1.maxScore, status:c>1||round1.submitted?"done":c===1?"active":"locked" },
    ];
    
    // FIX: Show rounds sequentially as team progresses
    if (c >= 2) {
      roundsArray.push(
        { code:"R2", label:"Coding Engine",  accent:"#a78bfa", points:ROUND_CONFIG.round2.maxScore, status:c>2?"done":c===2?"active":"locked" }
      );
    }
    
    if (c >= 3) {
      roundsArray.push(
        { code:"R3", label:"Bug Hunter",     accent:"#34d399", points:ROUND_CONFIG.round3.maxScore, status:c>3?"done":c===3?"active":"locked" }
      );
    }
    
    // FIX: Only show leaderboard when event is live AND team has reached at least round 3
    // This means they've completed rounds 1 and 2
    if (eventLive && c >= 3) {
      roundsArray.push(
        { code:"LB", label:"Leaderboard",   accent:"#f472b6", points:null, status:c>3?"active":"active" }
      );
    }
    
    return roundsArray;
  }, [eventLive, round1.submitted, team.currentRound]);

  const members = team.members.length
    ? team.members
    : [{ name:`${team.teamName} Captain`, role:"Team Lead" }];

  const heroAccent = eventLive ? "#34d399" : "#fb923c";

  /* ── Loading ── */
  if (loading) return <Skeleton />;

  /* ── Main render ── */
  return (
    <>
      <AnimatePresence>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </AnimatePresence>

      <motion.section
        initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.35 }}
        style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
      >
        {/* ── HERO ── */}
        <div style={{ ...card, position:"relative", overflow:"hidden", padding:"28px 30px" }}>
          <ScanLine />
          {/* Top accent */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
            background:`linear-gradient(90deg,transparent,${hex2rgba(heroAccent,0.5)},transparent)` }}/>
          {/* Left breathing bar */}
          <motion.div animate={{ height:["30%","70%","30%"] }}
            transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
            style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
              width:"3px", borderRadius:"0 3px 3px 0",
              background:`linear-gradient(to bottom,transparent,${heroAccent},transparent)` }}/>
          {/* Ambient glow */}
          <motion.div animate={{ opacity:[0.25,0.5,0.25], scale:[1,1.1,1] }}
            transition={{ duration:4, repeat:Infinity, ease:"easeInOut" }}
            style={{ position:"absolute", top:"-70px", right:"-70px",
              width:"260px", height:"260px", borderRadius:"50%", pointerEvents:"none",
              background:hex2rgba(heroAccent,0.1), filter:"blur(70px)" }}/>

          <div style={{ position:"relative", zIndex:1 }}>
            {/* Top row */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
              <div>
                <p style={lbl}>{team.teamName}</p>
                <p style={{ ...lbl, marginTop:"4px", color:"rgba(100,116,139,0.5)" }}>
                  {team.teamId} // dashboard.live
                </p>
              </div>
              {/* Refresh pill */}
              <button type="button"
                onClick={() => void syncDashboard(true)}
                style={{
                  display:"flex", alignItems:"center", gap:"8px",
                  padding:"6px 14px", borderRadius:"999px", cursor:"pointer", transition:"all 0.2s",
                  border:`1px solid ${hex2rgba(heroAccent,0.35)}`,
                  background:hex2rgba(heroAccent,0.08), ...mono,
                }}
                onMouseEnter={e=>{e.currentTarget.style.background=hex2rgba(heroAccent,0.16);}}
                onMouseLeave={e=>{e.currentTarget.style.background=hex2rgba(heroAccent,0.08);}}
              >
                <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.4, repeat:Infinity }}
                  style={{ width:"6px", height:"6px", borderRadius:"50%", background:heroAccent,
                    boxShadow:`0 0 7px ${heroAccent}` }}/>
                <span style={{ fontSize:"9px", letterSpacing:"0.18em", textTransform:"uppercase",
                  color:heroAccent, fontWeight:600 }}>
                  {refreshing ? "Syncing..." : eventLive ? "Live" : "Standby"}
                </span>
                <span style={{ ...lbl, fontSize:"8px" }}>· Refresh</span>
              </button>
            </div>

            {/* Heading */}
            <h1 style={{ fontSize:"26px", fontWeight:700, color:"#f1f5f9",
              letterSpacing:"-0.01em", margin:"12px 0 0" }}>
              {eventLive ? "Event Live" : "Waiting For Event Start"}
            </h1>
            <p style={{ marginTop:"7px", fontSize:"13px", lineHeight:1.8,
              color:"rgba(203,213,225,0.55)", maxWidth:"540px" }}>
              {primaryAction.helper}
            </p>

            {/* CTA row */}
            <div style={{ display:"flex", gap:"10px", marginTop:"20px", flexWrap:"wrap" }}>
              <motion.button type="button" whileTap={{ scale:0.97 }}
                disabled={primaryAction.disabled}
                onClick={() => !primaryAction.disabled && navigate(primaryAction.to)}
                style={{
                  padding:"11px 24px", borderRadius:"10px", cursor:primaryAction.disabled?"not-allowed":"pointer",
                  ...mono, fontSize:"11px", fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase",
                  border: primaryAction.disabled?"1px solid rgba(255,255,255,0.07)":"1px solid rgba(56,189,248,0.35)",
                  background: primaryAction.disabled?"rgba(255,255,255,0.03)":"rgba(56,189,248,0.12)",
                  color: primaryAction.disabled?"rgba(255,255,255,0.22)":"#7dd3fc",
                  transition:"all 0.15s",
                  display:"flex", alignItems:"center", gap:"8px",
                }}
                onMouseEnter={e=>{ if(!primaryAction.disabled){e.currentTarget.style.background="rgba(56,189,248,0.2)";e.currentTarget.style.boxShadow="0 0 18px rgba(56,189,248,0.18)";}}}
                onMouseLeave={e=>{e.currentTarget.style.background=primaryAction.disabled?"rgba(255,255,255,0.03)":"rgba(56,189,248,0.12)";e.currentTarget.style.boxShadow="none";}}
              >
                {primaryAction.label}
                {!primaryAction.disabled && (
                  <motion.span animate={{ x:[0,4,0] }} transition={{ duration:1.2, repeat:Infinity }}>→</motion.span>
                )}
              </motion.button>

              <motion.button type="button" whileTap={{ scale:0.97 }}
                onClick={() => setShowRules(true)}
                style={{
                  padding:"11px 22px", borderRadius:"10px", cursor:"pointer",
                  ...mono, fontSize:"11px", fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase",
                  border:"1px solid rgba(255,255,255,0.08)", background:"transparent",
                  color:"rgba(148,163,184,0.65)", transition:"all 0.15s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.borderColor="rgba(255,255,255,0.15)";e.currentTarget.style.color="#e2e8f0";}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(148,163,184,0.65)";}}
              >
                / Arena Protocol
              </motion.button>
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
          {stats.map((s,i) => <StatCard key={s.label} stat={s} i={i} />)}
        </div>

        {/* ── ROUND STRIP ── */}
        <RoundStrip rounds={rounds} />

        {/* ── BOTTOM GRID ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1.35fr 1fr", gap:"12px" }}>
          {/* Mission Notes */}
          <div style={{ ...card, padding:"22px 24px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px",
              background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.3),transparent)" }}/>
            <p style={{ ...lbl, color:"rgba(56,189,248,0.65)", marginBottom:"16px" }}>◈ Mission Notes</p>
            <ul style={{ listStyle:"none", margin:0, padding:0, display:"flex", flexDirection:"column", gap:"10px" }}>
              {NOTES.map((note,i) => (
                <motion.li key={note}
                  initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                  transition={{ delay:i*0.08+0.2 }}
                  style={{ display:"flex", gap:"10px", fontSize:"12.5px",
                    lineHeight:1.65, color:"rgba(203,213,225,0.6)" }}>
                  <span style={{ color:"#38bdf8", flexShrink:0, fontWeight:700 }}>▹</span>
                  {note}
                </motion.li>
              ))}
            </ul>
            {/* Tags */}
            <div style={{ display:"flex", gap:"6px", marginTop:"18px", paddingTop:"14px",
              borderTop:"1px solid rgba(255,255,255,0.05)", flexWrap:"wrap" }}>
              {[["MCQ","#38bdf8"],["Code","#a78bfa"],["Debug","#34d399"]].map(([t,c])=>(
                <span key={t} style={{ padding:"3px 10px", borderRadius:"999px",
                  ...lbl, fontSize:"8px", color:c,
                  background:hex2rgba(c,0.08), border:`1px solid ${hex2rgba(c,0.22)}` }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Active Squad */}
          <div style={{ ...card, padding:"22px 24px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px",
              background:"linear-gradient(90deg,transparent,rgba(52,211,153,0.3),transparent)" }}/>
            <p style={{ ...lbl, color:"rgba(52,211,153,0.65)", marginBottom:"16px" }}>◈ Active Squad</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {members.map((m, i) => {
                const palette = ["#38bdf8","#a78bfa","#34d399"];
                const accent  = palette[i % palette.length];
                return (
                  <motion.div key={`${m.name}-${i}`}
                    initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay:i*0.08+0.2 }}
                    whileHover={{ x:2 }}
                    style={{ display:"flex", alignItems:"center", gap:"10px",
                      padding:"9px 11px", borderRadius:"10px",
                      background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)",
                      transition:"all 0.14s", cursor:"default" }}
                    onMouseEnter={e=>{e.currentTarget.style.background=hex2rgba(accent,0.06);e.currentTarget.style.borderColor=hex2rgba(accent,0.2);}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.05)";}}
                  >
                    <div style={{
                      width:"32px", height:"32px", borderRadius:"9px", flexShrink:0,
                      background:hex2rgba(accent,0.13), border:`1px solid ${hex2rgba(accent,0.28)}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"12px", fontWeight:700, color:accent, ...mono,
                    }}>
                      {String(m.name||"T").charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ ...mono, fontSize:"12.5px", color:"rgba(226,232,240,0.85)",
                        fontWeight:600, margin:0 }}>{m.name||"Team Member"}</p>
                      <p style={{ ...lbl, fontSize:"8px", marginTop:"2px",
                        color:"rgba(100,116,139,0.55)" }}>{m.role||m.email||"Member"}</p>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"5px", flexShrink:0 }}>
                      <motion.span animate={{ opacity:[1,0.25,1], scale:[1,0.8,1] }}
                        transition={{ duration:2.2, repeat:Infinity, delay:i*0.5 }}
                        style={{ width:"5px", height:"5px", borderRadius:"50%",
                          background:"#34d399", boxShadow:"0 0 5px rgba(52,211,153,0.9)" }}/>
                      <span style={{ ...lbl, fontSize:"8px", color:"#34d399" }}>Online</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>
    </>
  );
}
