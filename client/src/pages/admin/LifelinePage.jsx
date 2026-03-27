import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  approveLifelineRequest,
  getLifelineRequests,
  rejectLifelineRequest,
} from "../../api/adminApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const POLL_INTERVAL_MS = 8000;

const STATUS_FILTERS = [
  { key:"pending",  label:"Pending",  accent:"#fb923c" },
  { key:"approved", label:"Approved", accent:"#34d399" },
  { key:"rejected", label:"Rejected", accent:"#f87171" },
  { key:"all",      label:"All",      accent:"#a78bfa" },
];

const formatDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
};

const timeAgo = (v) => {
  if (!v) return "just now";
  const s = Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 1000));
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

const STATUS_META = {
  pending:  { color:"#fb923c", bg:"rgba(251,146,60,0.1)",  border:"rgba(251,146,60,0.28)"  },
  approved: { color:"#34d399", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.28)"  },
  rejected: { color:"#f87171", bg:"rgba(248,113,113,0.1)", border:"rgba(248,113,113,0.28)" },
};

/* ─── SCAN LINE ─── */
function ScanLine({ color="#fb923c" }) {
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

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"12px", ...mono }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ ...card, padding:"20px 22px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[50,35,65].map((w,j)=>(
              <motion.div key={j} animate={{ opacity:[0.2,0.45,0.2] }}
                transition={{ duration:1.4, repeat:Infinity, delay:(i*3+j)*0.08 }}
                style={{ height:"10px", borderRadius:"5px", background:"rgba(255,255,255,0.07)", width:`${w}%` }}/>
            ))}
          </div>
        </div>
      ))}
      <div style={{ ...lbl, display:"flex", alignItems:"center", gap:"8px",
        color:"rgba(251,146,60,0.5)", padding:"0 4px" }}>
        <motion.span animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>◌</motion.span>
        Loading lifeline requests...
      </div>
    </div>
  );
}

/* ─── STAT TILE ─── */
function StatTile({ label, value, accent, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ delay }} whileHover={{ y:-2 }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        ...card, padding:"16px 18px", position:"relative", overflow:"hidden",
        cursor:"default", transition:"border 0.18s",
        border: hov ? `1px solid ${hex2rgba(accent,0.35)}` : `1px solid ${hex2rgba(accent,0.18)}`,
      }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg,transparent,${hex2rgba(accent,0.65)},transparent)` }}/>
      <div style={{ position:"absolute", left:0, top:"18%", bottom:"18%", width:"3px",
        borderRadius:"0 3px 3px 0", background:hov?accent:"transparent", transition:"background 0.18s" }}/>
      <p style={lbl}>{label}</p>
      <p style={{ ...mono, fontSize:"28px", fontWeight:700, marginTop:"8px",
        letterSpacing:"-0.01em",
        color:hov?accent:"#f1f5f9",
        transition:"color 0.18s" }}>
        {value}
      </p>
    </motion.div>
  );
}

/* ─── REQUEST CARD ─── */
function RequestCard({ item, index, isBusy, onAction }) {
  const meta     = STATUS_META[item.status] ?? STATUS_META.pending;
  const isPending = item.status === "pending";

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.97 }}
      transition={{ delay:Math.min(index*0.04, 0.2), type:"spring", stiffness:320, damping:28 }}
      style={{
        ...card, padding:"18px 20px", position:"relative", overflow:"hidden",
        border: isPending ? `1px solid ${hex2rgba(meta.color,0.28)}` : card.border,
        transition:"border 0.2s",
      }}
    >
      {/* Left accent bar */}
      <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%",
        width:"3px", borderRadius:"0 3px 3px 0",
        background:meta.color, boxShadow:`0 0 8px ${hex2rgba(meta.color,0.6)}` }}/>

      {/* Top accent */}
      {isPending && (
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px",
          background:`linear-gradient(90deg,transparent,${hex2rgba(meta.color,0.45)},transparent)` }}/>
      )}

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
        flexWrap:"wrap", gap:"12px" }}>

        {/* Left: team info */}
        <div style={{ flex:1, minWidth:"200px" }}>
          {/* Name row */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            {/* Avatar badge */}
            <div style={{
              width:"28px", height:"28px", borderRadius:"8px", flexShrink:0,
              background:hex2rgba(meta.color,0.14), border:`1px solid ${hex2rgba(meta.color,0.3)}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              ...mono, fontSize:"11px", fontWeight:700, color:meta.color,
            }}>
              {String(item.team?.teamName||"T").charAt(0)}
            </div>

            <span style={{ ...mono, fontSize:"13px", fontWeight:700, color:"#f1f5f9" }}>
              {item.team?.teamName || "Unknown Team"}
            </span>

            <span style={{ ...lbl, fontSize:"8px", padding:"2px 8px", borderRadius:"999px",
              color:"rgba(148,163,184,0.6)", background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)" }}>
              {item.team?.teamId || "N/A"}
            </span>

            {/* Status pill */}
            <span style={{
              ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase",
              padding:"3px 9px", borderRadius:"999px",
              color:meta.color, background:meta.bg, border:`1px solid ${meta.border}`,
            }}>
              {item.status}
            </span>
          </div>

          {/* Meta grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
            gap:"6px 16px", marginTop:"12px" }}>
            {[
              { k:"Round",         v:item.round },
              { k:"Current Round", v:`R${item.team?.currentRound||"—"}` },
              { k:"Requested",     v:formatDateTime(item.requestedAt) },
              { k:"Updated",       v:timeAgo(item.resolvedAt||item.requestedAt) },
            ].map(({ k,v }) => (
              <p key={k} style={{ fontSize:"11px", color:"rgba(148,163,184,0.5)" }}>
                <span style={{ color:"rgba(100,116,139,0.65)" }}>{k}: </span>
                <span style={{ ...mono, color:"rgba(203,213,225,0.75)" }}>{v}</span>
              </p>
            ))}
          </div>

          {item.note && (
            <div style={{ marginTop:"10px", padding:"8px 12px", borderRadius:"8px",
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
              fontSize:"11px", color:"rgba(148,163,184,0.55)" }}>
              <span style={{ color:"rgba(100,116,139,0.55)" }}>Admin note: </span>
              <span style={{ color:"rgba(203,213,225,0.65)" }}>{item.note}</span>
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        {isPending && (
          <div style={{ display:"flex", gap:"8px", alignSelf:"center" }}>
            <motion.button type="button" whileTap={{ scale:0.96 }}
              disabled={isBusy}
              onClick={() => onAction(item._id,"approve")}
              style={{
                padding:"9px 18px", borderRadius:"9px", cursor:isBusy?"not-allowed":"pointer",
                ...mono, fontSize:"10px", fontWeight:700,
                letterSpacing:"0.14em", textTransform:"uppercase",
                border:"1px solid rgba(52,211,153,0.35)",
                background:isBusy?"rgba(255,255,255,0.04)":"rgba(52,211,153,0.1)",
                color:isBusy?"rgba(255,255,255,0.3)":"#6ee7b7",
                transition:"all 0.14s",
                display:"flex", alignItems:"center", gap:"6px",
              }}
              onMouseEnter={e=>{if(!isBusy){e.currentTarget.style.background="rgba(52,211,153,0.2)";e.currentTarget.style.boxShadow="0 0 14px rgba(52,211,153,0.18)";}}}
              onMouseLeave={e=>{e.currentTarget.style.background=isBusy?"rgba(255,255,255,0.04)":"rgba(52,211,153,0.1)";e.currentTarget.style.boxShadow="none";}}
            >
              {isBusy
                ? <><motion.span animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}>◌</motion.span> Wait...</>
                : "✓ Approve"}
            </motion.button>

            <motion.button type="button" whileTap={{ scale:0.96 }}
              disabled={isBusy}
              onClick={() => onAction(item._id,"reject")}
              style={{
                padding:"9px 18px", borderRadius:"9px", cursor:isBusy?"not-allowed":"pointer",
                ...mono, fontSize:"10px", fontWeight:700,
                letterSpacing:"0.14em", textTransform:"uppercase",
                border:"1px solid rgba(248,113,113,0.35)",
                background:isBusy?"rgba(255,255,255,0.04)":"rgba(248,113,113,0.1)",
                color:isBusy?"rgba(255,255,255,0.3)":"#fca5a5",
                transition:"all 0.14s",
                display:"flex", alignItems:"center", gap:"6px",
              }}
              onMouseEnter={e=>{if(!isBusy){e.currentTarget.style.background="rgba(248,113,113,0.2)";e.currentTarget.style.boxShadow="0 0 14px rgba(248,113,113,0.15)";}}}
              onMouseLeave={e=>{e.currentTarget.style.background=isBusy?"rgba(255,255,255,0.04)":"rgba(248,113,113,0.1)";e.currentTarget.style.boxShadow="none";}}
            >
              {isBusy
                ? <><motion.span animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}>◌</motion.span> Wait...</>
                : "✕ Reject"}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function LifelinePage() {
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [statusFilter,  setStatusFilter]  = useState("pending");
  const [requests,      setRequests]      = useState([]);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [penaltyConfig, setPenaltyConfig] = useState({ perRound: { round2: 10, round3: 20 } });
  const [busyIds,       setBusyIds]       = useState([]);
  const [pulse,         setPulse]         = useState(false);

  const syncRequests = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getLifelineRequests(statusFilter);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setPendingCount(Number(data?.pendingCount) || 0);
      setPenaltyConfig(data?.penaltyConfig || { perRound: { round2: 10, round3: 20 } });
      setError("");
      if (silent) { setPulse(true); setTimeout(()=>setPulse(false), 600); }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load lifeline requests."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    const run = async () => { if (active) await syncRequests(); };
    void run();
    const id = setInterval(() => { if (active) void syncRequests(true); }, POLL_INTERVAL_MS);
    return () => { active=false; clearInterval(id); };
  }, [syncRequests]);

  const handleAction = async (requestId, action) => {
    setBusyIds(p => [...p, requestId]);
    setError("");
    try {
      if (action==="approve") await approveLifelineRequest(requestId);
      else                    await rejectLifelineRequest(requestId);
      await syncRequests(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update request."));
    } finally {
      setBusyIds(p => p.filter(id => id !== requestId));
    }
  };

  const summary = useMemo(() => ({
    pending:  requests.filter(r=>r.status==="pending").length,
    approved: requests.filter(r=>r.status==="approved").length,
    rejected: requests.filter(r=>r.status==="rejected").length,
  }), [requests]);

  const activeFilter = STATUS_FILTERS.find(f=>f.key===statusFilter);
  const maxRequests = Number(penaltyConfig?.maxRequests) || 1;

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── HEADER CARD ── */}
      <div style={{ ...card, padding:"22px 26px", position:"relative", overflow:"hidden" }}>
        <ScanLine color="#fb923c" />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(251,146,60,0.5),transparent)" }}/>
        <motion.div animate={{ height:["30%","70%","30%"] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
            width:"3px", borderRadius:"0 3px 3px 0",
            background:"linear-gradient(to bottom,transparent,#fb923c,transparent)" }}/>

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
          flexWrap:"wrap", gap:"14px", position:"relative", zIndex:1 }}>
          <div>
            <p style={{ ...lbl, color:"rgba(251,146,60,0.65)" }}>Lifeline Control</p>
            <h1 style={{ fontSize:"20px", fontWeight:700, color:"#f1f5f9",
              marginTop:"6px", letterSpacing:"-0.01em" }}>
              Lifeline Approval Queue
            </h1>
            <p style={{ fontSize:"12.5px", color:"rgba(203,213,225,0.55)",
              marginTop:"5px", fontFamily:"'Inter',sans-serif" }}>
              Each team gets {maxRequests} shared lifeline across Round 2 and Round 3. Admin approval applies{" "}
              <span style={{ color:"#f472b6", fontWeight:600 }}>R2 -{penaltyConfig?.perRound?.round2 ?? 10} pts / R3 -{penaltyConfig?.perRound?.round3 ?? 20} pts</span>.
            </p>
          </div>

          {/* Global pending + sync dot */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {/* Sync dot */}
            <motion.div animate={{ opacity:pulse?1:0.3 }} transition={{ duration:0.3 }}
              style={{ display:"flex", alignItems:"center", gap:"5px" }}>
              <motion.span animate={pulse?{scale:[1,1.5,1]}:{}}
                transition={{ duration:0.4 }}
                style={{ width:"5px", height:"5px", borderRadius:"50%",
                  background:"#38bdf8", flexShrink:0 }}/>
              <span style={{ ...lbl, fontSize:"8px" }}>Sync {POLL_INTERVAL_MS/1000}s</span>
            </motion.div>

            {/* Pending count badge */}
            <div style={{
              padding:"10px 16px", borderRadius:"11px",
              background:"rgba(251,146,60,0.09)", border:"1px solid rgba(251,146,60,0.25)",
              textAlign:"right",
            }}>
              <p style={{ ...lbl, fontSize:"8px", color:"rgba(251,146,60,0.6)", marginBottom:"5px" }}>
                Global Pending
              </p>
              <p style={{ ...mono, fontSize:"22px", fontWeight:700, color:"#fb923c",
                letterSpacing:"-0.01em", lineHeight:1 }}>
                {pendingCount}
              </p>
            </div>
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

      {/* ── FILTER TABS ── */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter===f.key;
          return (
            <motion.button key={f.key} type="button" whileTap={{ scale:0.96 }}
              onClick={() => setStatusFilter(f.key)}
              style={{
                padding:"7px 16px", borderRadius:"9px",
                ...mono, fontSize:"10px", fontWeight:600,
                letterSpacing:"0.14em", textTransform:"uppercase",
                cursor:"pointer", transition:"all 0.15s",
                border: active ? `1px solid ${hex2rgba(f.accent,0.45)}` : "1px solid rgba(255,255,255,0.08)",
                background: active ? hex2rgba(f.accent,0.12) : "rgba(255,255,255,0.03)",
                color: active ? f.accent : "rgba(148,163,184,0.55)",
                boxShadow: active ? `0 0 12px ${hex2rgba(f.accent,0.15)}` : "none",
              }}
              onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="#cbd5e1";}}}
              onMouseLeave={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(148,163,184,0.55)";}}}
            >
              {f.label}
            </motion.button>
          );
        })}
      </div>

      {/* ── STAT TILES ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px" }}>
        <StatTile label="Pending In View"  value={summary.pending}  accent="#fb923c" delay={0.1} />
        <StatTile label="Approved In View" value={summary.approved} accent="#34d399" delay={0.17} />
        <StatTile label="Rejected In View" value={summary.rejected} accent="#f87171" delay={0.24} />
      </div>

      {/* ── REQUEST LIST ── */}
      {loading ? (
        <Skeleton />
      ) : requests.length === 0 ? (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          style={{ ...card, padding:"28px 24px", textAlign:"center",
            display:"flex", flexDirection:"column", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"22px" }}>○</span>
          <p style={{ ...lbl, fontSize:"10px", color:"rgba(100,116,139,0.55)" }}>
            No {statusFilter !== "all" ? statusFilter : ""} requests found
          </p>
        </motion.div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {/* List header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"0 4px", marginBottom:"2px" }}>
            <span style={{ ...lbl, fontSize:"8px",
              color: activeFilter ? hex2rgba(activeFilter.accent,0.6) : "rgba(148,163,184,0.4)" }}>
              {requests.length} request{requests.length!==1?"s":""} · {statusFilter}
            </span>
            <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.4)" }}>
              −{penaltyConfig?.perRound?.round2 ?? 10} pts · R3 -{penaltyConfig?.perRound?.round3 ?? 20} pts
            </span>
          </div>

          <AnimatePresence>
            {requests.map((item, i) => (
              <RequestCard
                key={item._id}
                item={item}
                index={i}
                isBusy={busyIds.includes(item._id)}
                onAction={handleAction}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}


