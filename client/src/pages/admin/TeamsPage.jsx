import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTeamMonitor } from "../../api/adminApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const TEAM_MONITOR_POLL_INTERVAL_MS = 10000;

const ROUND_FILTERS = [
  { value:"All", label:"All Rounds" },
  { value:"R1",  label:"Round 1"    },
  { value:"R2",  label:"Round 2"    },
  { value:"R3",  label:"Round 3"    },
];

const formatDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
};

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

const STATUS_META = {
  Active:    { color:"#34d399", glow:"rgba(52,211,153,0.9)"  },
  Completed: { color:"#a78bfa", glow:"rgba(167,139,250,0.9)" },
  Offline:   { color:"rgba(100,116,139,0.6)", glow:"rgba(100,116,139,0.4)" },
};

const ROUND_META = {
  R1: { color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  border:"rgba(56,189,248,0.25)"  },
  R2: { color:"#a78bfa", bg:"rgba(167,139,250,0.1)", border:"rgba(167,139,250,0.25)" },
  R3: { color:"#f472b6", bg:"rgba(244,114,182,0.1)", border:"rgba(244,114,182,0.25)" },
};

const LIFELINE_META = {
  Available: { color:"#34d399" },
  Pending:   { color:"#fb923c" },
  Used:      { color:"#f87171" },
  Rejected:  { color:"rgba(100,116,139,0.55)" },
};

/* ─── SCAN LINE ─── */
function ScanLine({ color="#38bdf8" }) {
  return (
    <motion.div
      animate={{ top:["0%","100%"] }}
      transition={{ duration:3.5, repeat:Infinity, ease:"linear", repeatDelay:2 }}
      style={{ position:"absolute", left:0, right:0, height:"1px",
        pointerEvents:"none", zIndex:2,
        background:`linear-gradient(90deg,transparent,${hex2rgba(color,0.18)},transparent)` }}
    />
  );
}

/* ─── SKELETON ─── */
function TableSkeleton() {
  return (
    <>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)",
          display:"flex", alignItems:"center", gap:"16px" }}>
          <motion.div animate={{ opacity:[0.15,0.35,0.15] }}
            transition={{ duration:1.4, repeat:Infinity, delay:i*0.09 }}
            style={{ width:"8px", height:"8px", borderRadius:"50%", background:"rgba(255,255,255,0.15)", flexShrink:0 }}/>
          {[30,20,12,12,14].map((w,j) => (
            <motion.div key={j} animate={{ opacity:[0.15,0.35,0.15] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.09+j*0.05 }}
              style={{ height:"10px", borderRadius:"5px", background:"rgba(255,255,255,0.07)",
                width:`${w}%`, flexShrink: j===0?1:0 }}/>
          ))}
        </div>
      ))}
    </>
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ delay }} whileHover={{ y:-2 }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        ...card, padding:"14px 16px", position:"relative", overflow:"hidden",
        cursor:"default", transition:"border 0.18s",
        border: hov ? `1px solid ${hex2rgba(accent,0.35)}` : `1px solid ${hex2rgba(accent,0.18)}`,
      }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,0.65)},transparent)` }}/>
      <div style={{ position:"absolute", left:0, top:"18%", bottom:"18%", width:"3px",
        borderRadius:"0 3px 3px 0", background:hov?accent:"transparent", transition:"background 0.18s" }}/>
      <p style={lbl}>{label}</p>
      <p style={{ ...mono, fontSize:"22px", fontWeight:700, marginTop:"7px",
        letterSpacing:"-0.01em", color:hov?accent:"#f1f5f9", transition:"color 0.18s" }}>
        {value}
      </p>
    </motion.div>
  );
}

/* ─── EXPANDED DETAIL ─── */
function ExpandedDetail({ team }) {
  return (
    <motion.div
      initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
      exit={{ height:0, opacity:0 }} transition={{ duration:0.22 }}
      style={{ overflow:"hidden", borderTop:"1px solid rgba(255,255,255,0.05)",
        background:"rgba(0,0,0,0.25)" }}
    >
      <div style={{ padding:"16px 20px", display:"grid",
        gridTemplateColumns:"repeat(3,1fr)", gap:"16px" }}>
        {/* Submission status */}
        <div style={{ padding:"12px 14px", borderRadius:"10px",
          background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ ...lbl, fontSize:"8px", marginBottom:"7px" }}>Submission Status</p>
          <p style={{ fontSize:"12.5px", color:"rgba(226,232,240,0.8)", ...mono }}>{team.submissionStatus || "—"}</p>
        </div>

        {/* Lifeline detail */}
        <div style={{ padding:"12px 14px", borderRadius:"10px",
          background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ ...lbl, fontSize:"8px", marginBottom:"7px" }}>Lifeline Request</p>
          <p style={{ fontSize:"12px", color:"rgba(203,213,225,0.7)", ...mono }}>
            {team.lifelineRequest
              ? `${team.lifelineRequest.status.toUpperCase()} · ${formatDateTime(team.lifelineRequest.requestedAt)}`
              : "None"}
          </p>
        </div>

        {/* Last sync */}
        <div style={{ padding:"12px 14px", borderRadius:"10px",
          background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <p style={{ ...lbl, fontSize:"8px", marginBottom:"7px" }}>Last Updated</p>
            <p style={{ fontSize:"12px", color:"rgba(203,213,225,0.7)", ...mono }}>
              {formatDateTime(team.lastUpdatedAt)}
            </p>
          </div>
          {/* Members list */}
          {team.members?.length > 0 && (
            <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", justifyContent:"flex-end" }}>
              {team.members.map((m,i) => {
                const colors = ["#38bdf8","#a78bfa","#34d399"];
                const c = colors[i%colors.length];
                return (
                  <div key={i} style={{
                    width:"24px", height:"24px", borderRadius:"7px",
                    background:hex2rgba(c,0.14), border:`1px solid ${hex2rgba(c,0.28)}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    ...mono, fontSize:"9px", fontWeight:700, color:c,
                    title:m,
                  }}>
                    {String(m).charAt(0)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── TEAM ROW ─── */
function TeamRow({ team, expanded, onToggle, index }) {
  const statusMeta   = STATUS_META[team.status]   ?? STATUS_META.Offline;
  const roundMeta    = ROUND_META[team.round]     ?? ROUND_META.R1;
  const lifelineMeta = LIFELINE_META[team.lifeline] ?? { color:"rgba(148,163,184,0.5)" };
  const [hov, setHov] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:Math.min(index*0.03, 0.25), type:"spring", stiffness:320, damping:28 }}
      style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Main row */}
      <div
        onClick={onToggle}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{
          display:"grid", gridTemplateColumns:"2fr 2fr 90px 90px 100px 28px",
          alignItems:"center", padding:"12px 20px", gap:"10px",
          cursor:"pointer", transition:"background 0.14s",
          background: expanded
            ? "rgba(56,189,248,0.04)"
            : hov
              ? "rgba(255,255,255,0.025)"
              : "transparent",
        }}
      >
        {/* Team name + status dot */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px", minWidth:0 }}>
          <motion.span
            animate={{ opacity:[1,0.2,1], scale:team.status==="Active"?[1,0.8,1]:[1,1,1] }}
            transition={{ duration: team.status==="Active"?2:1, repeat:Infinity, delay:index*0.3 }}
            style={{ width:"7px", height:"7px", borderRadius:"50%", flexShrink:0,
              background:statusMeta.color, boxShadow:`0 0 7px ${statusMeta.glow}` }}
          />
          <div style={{ minWidth:0 }}>
            <p style={{ ...mono, fontSize:"13px", fontWeight:600,
              color: hov||expanded?"#f1f5f9":"rgba(226,232,240,0.85)",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              transition:"color 0.14s" }}>
              {team.teamName}
            </p>
            <p style={{ ...lbl, fontSize:"8px", marginTop:"1px",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              color:hex2rgba(statusMeta.color,0.55) }}>
              {team.teamId}
            </p>
          </div>
        </div>

        {/* Members */}
        <p style={{ fontSize:"11.5px", color:"rgba(148,163,184,0.5)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {(team.members||[]).join(", ") || "—"}
        </p>

        {/* Round badge */}
        <span style={{
          ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.14em",
          padding:"4px 10px", borderRadius:"999px", textAlign:"center",
          color:roundMeta.color, background:roundMeta.bg, border:`1px solid ${roundMeta.border}`,
          whiteSpace:"nowrap",
        }}>
          {team.round}
        </span>

        {/* Score */}
        <span style={{ ...mono, fontSize:"14px", fontWeight:700,
          color: hov?"#38bdf8":"rgba(203,213,225,0.75)", transition:"color 0.14s" }}>
          {team.score}
        </span>

        {/* Lifeline */}
        <span style={{ ...mono, fontSize:"10px", fontWeight:600,
          letterSpacing:"0.06em", color:lifelineMeta.color }}>
          {team.lifeline}
        </span>

        {/* Chevron */}
        <motion.span animate={{ rotate:expanded?90:0 }}
          style={{ color:"rgba(148,163,184,0.3)", fontSize:"13px",
            justifySelf:"center", flexShrink:0 }}>›</motion.span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && <ExpandedDetail key="detail" team={team} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function TeamsPage() {
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("All");
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [teams,       setTeams]       = useState([]);
  const [pulse,       setPulse]       = useState(false);
  const [counts, setCounts] = useState({
    total:0, active:0, offline:0, completed:0, pendingLifeline:0,
  });

  useEffect(() => {
    let active = true;
    const sync = async (silent=false) => {
      if (!silent) setLoading(true);
      try {
        const data = await getTeamMonitor({ search, round:filter==="All"?"all":filter });
        if (!active) return;
        setTeams(Array.isArray(data?.teams)?data.teams:[]);
        setCounts({
          total:           Number(data?.counts?.total)          ||0,
          active:          Number(data?.counts?.active)         ||0,
          offline:         Number(data?.counts?.offline)        ||0,
          completed:       Number(data?.counts?.completed)      ||0,
          pendingLifeline: Number(data?.counts?.pendingLifeline)||0,
        });
        setError("");
        if (silent) { setPulse(true); setTimeout(()=>setPulse(false),600); }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load teams monitor."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void sync();
    const id = setInterval(()=>{ void sync(true); }, TEAM_MONITOR_POLL_INTERVAL_MS);
    return ()=>{ active=false; clearInterval(id); };
  }, [search, filter]);

  const filteredTeams = useMemo(() => teams, [teams]);

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── HEADER ── */}
      <div style={{ ...card, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <ScanLine color="#38bdf8" />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.4),transparent)" }}/>
        <motion.div animate={{ height:["30%","70%","30%"] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
            width:"3px", borderRadius:"0 3px 3px 0",
            background:"linear-gradient(to bottom,transparent,#38bdf8,transparent)" }}/>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          flexWrap:"wrap", gap:"14px", position:"relative", zIndex:1 }}>
          <div>
            <p style={{ ...lbl, color:"rgba(56,189,248,0.65)" }}>Admin · Team Monitor</p>
            <h2 style={{ fontSize:"20px", fontWeight:700, color:"#f1f5f9",
              marginTop:"5px", letterSpacing:"-0.01em" }}>
              Team Monitor
            </h2>
          </div>

          {/* Search + filter + sync */}
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            {/* Search */}
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:"11px", top:"50%",
                transform:"translateY(-50%)", fontSize:"11px",
                color:"rgba(148,163,184,0.35)", pointerEvents:"none" }}>◎</span>
              <input
                type="text" placeholder="Search teams..."
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{
                  paddingLeft:"30px", paddingRight:"12px", paddingTop:"8px", paddingBottom:"8px",
                  borderRadius:"9px", ...mono, fontSize:"11px",
                  background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
                  color:"#e2e8f0", outline:"none", width:"180px", transition:"border 0.15s",
                }}
                onFocus={e=>e.target.style.borderColor="rgba(56,189,248,0.45)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.09)"}
              />
            </div>

            {/* Round filter */}
            <select value={filter} onChange={e=>setFilter(e.target.value)}
              style={{
                padding:"8px 12px", borderRadius:"9px",
                ...mono, fontSize:"10px", letterSpacing:"0.08em",
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
                color:"rgba(203,213,225,0.8)", outline:"none", cursor:"pointer",
                transition:"border 0.15s",
              }}
              onFocus={e=>e.target.style.borderColor="rgba(56,189,248,0.45)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.09)"}
            >
              {ROUND_FILTERS.map(f=>(
                <option key={f.value} value={f.value}
                  style={{ background:"#13161e" }}>{f.label}</option>
              ))}
            </select>

            {/* Sync indicator */}
            <motion.div animate={{ opacity:pulse?1:0.3 }} transition={{ duration:0.3 }}
              style={{ display:"flex", alignItems:"center", gap:"5px" }}>
              <motion.span animate={pulse?{scale:[1,1.5,1]}:{}}
                transition={{ duration:0.4 }}
                style={{ width:"5px", height:"5px", borderRadius:"50%",
                  background:"#38bdf8", flexShrink:0 }}/>
              <span style={{ ...lbl, fontSize:"8px" }}>{TEAM_MONITOR_POLL_INTERVAL_MS/1000}s</span>
            </motion.div>
          </div>
        </div>
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

      {/* ── STAT TILES ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px" }}>
        {[
          { label:"Total",           value:counts.total,           accent:"#38bdf8", delay:0.05  },
          { label:"Active",          value:counts.active,          accent:"#34d399", delay:0.1   },
          { label:"Offline",         value:counts.offline,         accent:"rgba(100,116,139,0.6)", delay:0.15 },
          { label:"Completed",       value:counts.completed,       accent:"#a78bfa", delay:0.2   },
          { label:"Pending Lifeline",value:counts.pendingLifeline, accent:"#fb923c", delay:0.25  },
        ].map(s=>(
          <StatTile key={s.label} {...s} />
        ))}
      </div>

      {/* ── TABLE ── */}
      <div style={{ ...card, overflow:"hidden" }}>
        {/* Column headers */}
        <div style={{
          display:"grid", gridTemplateColumns:"2fr 2fr 90px 90px 100px 28px",
          padding:"10px 20px", gap:"10px",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(255,255,255,0.02)",
        }}>
          {["Team","Members","Round","Score","Lifeline",""].map((h,i)=>(
            <span key={i} style={{ ...lbl, fontSize:"8px",
              color:"rgba(100,116,139,0.5)" }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div>
          {loading ? (
            <TableSkeleton />
          ) : filteredTeams.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center",
              display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"20px" }}>○</span>
              <p style={{ ...lbl, fontSize:"10px", color:"rgba(100,116,139,0.5)" }}>
                No teams found matching criteria
              </p>
            </div>
          ) : (
            filteredTeams.map((team, i) => (
              <TeamRow
                key={team.teamId}
                team={team}
                index={i}
                expanded={expandedRow===team.teamId}
                onToggle={()=>setExpandedRow(expandedRow===team.teamId?null:team.teamId)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {!loading && filteredTeams.length > 0 && (
          <div style={{ padding:"10px 20px", borderTop:"1px solid rgba(255,255,255,0.05)",
            background:"rgba(0,0,0,0.2)", display:"flex", alignItems:"center",
            justifyContent:"space-between" }}>
            <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.4)" }}>
              {filteredTeams.length} team{filteredTeams.length!==1?"s":""} shown
            </span>
            <div style={{ display:"flex", gap:"10px" }}>
              {Object.entries(STATUS_META).map(([k,v])=>(
                <div key={k} style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                  <div style={{ width:"6px", height:"6px", borderRadius:"50%",
                    background:v.color, boxShadow:`0 0 4px ${v.glow}` }}/>
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