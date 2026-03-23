import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAdminQuestions } from "../../api/adminApi";
import { getApiErrorMessage } from "../../api/httpClient";

/* ─── CONSTANTS ─── */
const QUESTION_POLL_INTERVAL_MS = 12000;

const ROUND_FILTERS = [
  { value:"All", label:"All", accent:"#a78bfa" },
  { value:"1",   label:"R1",  accent:"#38bdf8"  },
  { value:"2",   label:"R2",  accent:"#a78bfa"  },
  { value:"3",   label:"R3",  accent:"#f472b6"  },
];

const ROUND_META = {
  R1:{ color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  border:"rgba(56,189,248,0.25)"  },
  R2:{ color:"#a78bfa", bg:"rgba(167,139,250,0.1)", border:"rgba(167,139,250,0.25)" },
  R3:{ color:"#f472b6", bg:"rgba(244,114,182,0.1)", border:"rgba(244,114,182,0.25)" },
};

const DIFF_META = {
  Easy:   { color:"#34d399", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.25)"  },
  Medium: { color:"#fb923c", bg:"rgba(251,146,60,0.1)",  border:"rgba(251,146,60,0.25)"  },
  Hard:   { color:"#f87171", bg:"rgba(248,113,113,0.1)", border:"rgba(248,113,113,0.25)" },
};

const formatDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-US",{ month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
};

/* ─── TOKENS ─── */
const mono = { fontFamily:"'DM Mono','Fira Code',monospace" };
const card = { background:"#13161e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"14px" };
const lbl  = { ...mono, fontSize:"9px", letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(148,163,184,0.45)" };
const hex2rgba = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

/* ─── SCAN LINE ─── */
function ScanLine({ color="#a78bfa" }) {
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
    <>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{ padding:"12px 18px",
          borderBottom:"1px solid rgba(255,255,255,0.04)",
          display:"flex", alignItems:"center", gap:"12px" }}>
          <motion.div animate={{ opacity:[0.15,0.38,0.15] }}
            transition={{ duration:1.4, repeat:Infinity, delay:i*0.09 }}
            style={{ width:"30px", height:"20px", borderRadius:"6px",
              background:"rgba(255,255,255,0.07)", flexShrink:0 }}/>
          {[38,16,14,10,12].map((w,j)=>(
            <motion.div key={j} animate={{ opacity:[0.15,0.32,0.15] }}
              transition={{ duration:1.4, repeat:Infinity, delay:i*0.09+j*0.06 }}
              style={{ height:"9px", borderRadius:"4px",
                background:"rgba(255,255,255,0.07)",
                width:`${w}%`, flexShrink:j===0?1:0 }}/>
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

/* ─── QUESTION ROW ─── */
function QuestionRow({ question, index }) {
  const [hov, setHov] = useState(false);
  const roundMeta = ROUND_META[question.roundCode] ?? ROUND_META.R1;
  const diffMeta  = DIFF_META[question.difficulty]  ?? null;

  return (
    <motion.div
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:Math.min(index*0.025, 0.25) }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:"grid",
        gridTemplateColumns:"64px 1fr 110px 100px 52px 110px",
        alignItems:"center",
        padding:"11px 18px", gap:"10px",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        background:hov?"rgba(255,255,255,0.025)":"transparent",
        transition:"background 0.14s",
      }}
    >
      {/* Round badge */}
      <span style={{ ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.12em",
        padding:"4px 0", borderRadius:"999px", textAlign:"center",
        color:roundMeta.color, background:roundMeta.bg, border:`1px solid ${roundMeta.border}` }}>
        {question.roundCode}
      </span>

      {/* Title + subRound */}
      <div style={{ minWidth:0 }}>
        <p style={{ ...mono, fontSize:"12.5px", fontWeight:600,
          color:hov?"#f1f5f9":"rgba(226,232,240,0.85)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          transition:"color 0.14s" }}>
          {question.title}
        </p>
        {question.subRound && (
          <p style={{ ...lbl, fontSize:"7px", marginTop:"2px",
            color:"rgba(100,116,139,0.55)", overflow:"hidden",
            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {question.subRound}
          </p>
        )}
      </div>

      {/* Type */}
      <span style={{ ...mono, fontSize:"11px", color:"rgba(148,163,184,0.6)",
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {question.type || "—"}
      </span>

      {/* Difficulty */}
      {diffMeta ? (
        <span style={{ ...mono, fontSize:"9px", fontWeight:700, letterSpacing:"0.12em",
          padding:"3px 9px", borderRadius:"999px", textAlign:"center",
          color:diffMeta.color, background:diffMeta.bg, border:`1px solid ${diffMeta.border}` }}>
          {question.difficulty}
        </span>
      ) : (
        <span style={{ ...mono, fontSize:"11px", color:"rgba(100,116,139,0.45)" }}>
          {question.difficulty || "—"}
        </span>
      )}

      {/* Marks */}
      <span style={{ ...mono, fontSize:"13px", fontWeight:700, textAlign:"right",
        color:hov?"#38bdf8":"rgba(203,213,225,0.7)", transition:"color 0.14s" }}>
        {question.marks}
      </span>

      {/* Updated */}
      <span style={{ ...mono, fontSize:"10px", color:"rgba(100,116,139,0.5)",
        textAlign:"right", whiteSpace:"nowrap" }}>
        {formatDateTime(question.updatedAt)}
      </span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function QuestionsPage() {
  const [search,    setSearch]    = useState("");
  const [round,     setRound]     = useState("All");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [questions, setQuestions] = useState([]);
  const [pulse,     setPulse]     = useState(false);
  const [counts, setCounts] = useState({ total:0, round1:0, round2:0, round3:0 });

  useEffect(()=>{
    let active = true;
    const sync = async (silent=false) => {
      if (!silent) setLoading(true);
      try {
        const data = await getAdminQuestions({
          search, round:round==="All"?"all":round,
        });
        if (!active) return;
        setQuestions(Array.isArray(data?.questions)?data.questions:[]);
        setCounts({
          total:  Number(data?.counts?.total)  ||0,
          round1: Number(data?.counts?.round1) ||0,
          round2: Number(data?.counts?.round2) ||0,
          round3: Number(data?.counts?.round3) ||0,
        });
        setError("");
        if (silent) { setPulse(true); setTimeout(()=>setPulse(false),600); }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load questions from database."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void sync();
    const id = setInterval(()=>void sync(true), QUESTION_POLL_INTERVAL_MS);
    return ()=>{ active=false; clearInterval(id); };
  }, [search, round]);

  const stats = useMemo(()=>[
    { label:"Total",    value:counts.total,  accent:"#e2e8f0", delay:0.05 },
    { label:"Round 1",  value:counts.round1, accent:"#38bdf8", delay:0.1  },
    { label:"Round 2",  value:counts.round2, accent:"#a78bfa", delay:0.15 },
    { label:"Round 3",  value:counts.round3, accent:"#f472b6", delay:0.2  },
  ], [counts]);

  const activeFilter = ROUND_FILTERS.find(f=>f.value===round);

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
      style={{ display:"flex", flexDirection:"column", gap:"14px", ...mono, color:"#e2e8f0" }}
    >

      {/* ── HEADER ── */}
      <div style={{ ...card, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <ScanLine />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px",
          background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.45),rgba(56,189,248,0.3),transparent)" }}/>
        <motion.div animate={{ height:["30%","70%","30%"] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
            width:"3px", borderRadius:"0 3px 3px 0",
            background:"linear-gradient(to bottom,transparent,#a78bfa,transparent)" }}/>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          flexWrap:"wrap", gap:"14px", position:"relative", zIndex:1 }}>
          <div>
            <p style={{ ...lbl, color:"rgba(167,139,250,0.65)" }}>Admin · Question Bank</p>
            <h2 style={{ fontSize:"20px", fontWeight:700, color:"#f1f5f9",
              marginTop:"5px", letterSpacing:"-0.01em" }}>
              Current Questions From DB
            </h2>
          </div>

          {/* Controls */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            {/* Search */}
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:"11px", top:"50%",
                transform:"translateY(-50%)", fontSize:"11px",
                color:"rgba(148,163,184,0.35)", pointerEvents:"none" }}>◎</span>
              <input type="text" placeholder="Search questions..."
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{
                  paddingLeft:"30px", paddingRight:"12px", paddingTop:"8px", paddingBottom:"8px",
                  borderRadius:"9px", ...mono, fontSize:"11px",
                  background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
                  color:"#e2e8f0", outline:"none", width:"200px", transition:"border 0.15s",
                }}
                onFocus={e=>e.target.style.borderColor="rgba(167,139,250,0.45)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.09)"}
              />
            </div>

            {/* Round filter pill group */}
            <div style={{ display:"flex", gap:"4px", padding:"4px",
              borderRadius:"10px", background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.07)" }}>
              {ROUND_FILTERS.map(f=>{
                const active = round===f.value;
                return (
                  <motion.button key={f.value} type="button" whileTap={{ scale:0.95 }}
                    onClick={()=>setRound(f.value)}
                    style={{
                      padding:"5px 12px", borderRadius:"7px",
                      ...mono, fontSize:"10px", fontWeight:600,
                      letterSpacing:"0.1em", textTransform:"uppercase",
                      cursor:"pointer", transition:"all 0.14s", border:"none",
                      background: active ? hex2rgba(f.accent,0.18) : "transparent",
                      color: active ? f.accent : "rgba(148,163,184,0.5)",
                      boxShadow: active ? `0 0 10px ${hex2rgba(f.accent,0.2)}` : "none",
                    }}
                    onMouseEnter={e=>{if(!active){e.currentTarget.style.color="#cbd5e1";}}}
                    onMouseLeave={e=>{if(!active){e.currentTarget.style.color="rgba(148,163,184,0.5)";}}}
                  >
                    {f.label}
                  </motion.button>
                );
              })}
            </div>

            {/* Sync dot */}
            <motion.div animate={{ opacity:pulse?1:0.3 }} transition={{ duration:0.3 }}
              style={{ display:"flex", alignItems:"center", gap:"5px" }}>
              <motion.span animate={pulse?{scale:[1,1.5,1]}:{}}
                transition={{ duration:0.4 }}
                style={{ width:"5px", height:"5px", borderRadius:"50%",
                  background:"#a78bfa", flexShrink:0 }}/>
              <span style={{ ...lbl, fontSize:"8px" }}>{QUESTION_POLL_INTERVAL_MS/1000}s</span>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px" }}>
        {stats.map(s => <StatTile key={s.label} {...s} />)}
      </div>

      {/* ── TABLE ── */}
      <div style={{ ...card, overflow:"hidden" }}>
        {/* Column headers */}
        <div style={{
          display:"grid",
          gridTemplateColumns:"64px 1fr 110px 100px 52px 110px",
          padding:"10px 18px", gap:"10px",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          background:"rgba(255,255,255,0.02)",
        }}>
          {["Round","Title","Type","Difficulty","Marks","Updated"].map((h,i)=>(
            <span key={h} style={{ ...lbl, fontSize:"8px",
              color:"rgba(100,116,139,0.5)",
              textAlign:["Marks","Updated"].includes(h)?"right":"left" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div>
          {loading ? (
            <Skeleton />
          ) : questions.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center",
              display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"22px" }}>○</span>
              <p style={{ ...lbl, fontSize:"10px", color:"rgba(100,116,139,0.5)" }}>
                No questions found in database
              </p>
            </div>
          ) : (
            questions.map((q,i)=>(
              <QuestionRow key={q._id} question={q} index={i} />
            ))
          )}
        </div>

        {/* Footer */}
        {!loading && questions.length > 0 && (
          <div style={{ padding:"10px 18px", borderTop:"1px solid rgba(255,255,255,0.05)",
            background:"rgba(0,0,0,0.2)", display:"flex", alignItems:"center",
            justifyContent:"space-between" }}>
            <span style={{ ...lbl, fontSize:"8px", color:"rgba(100,116,139,0.4)" }}>
              {questions.length} question{questions.length!==1?"s":""} ·{" "}
              {activeFilter?.label ?? "All"}
            </span>
            <div style={{ display:"flex", gap:"10px" }}>
              {Object.entries(DIFF_META).map(([k,v])=>(
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