import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutUser, getCurrentUser } from "../api/authApi";
import { getEventStatus } from "../api/eventApi";
import { getRound1Status } from "../api/round1Api";
import { clearAuthSession } from "../api/session";
import { getApiErrorMessage } from "../api/httpClient";

const NAV_ITEMS = [
  { path: "/team", label: "Dashboard", code: "DB", accent: "#38bdf8", minRound: 1 },
  { path: "/team/round1", label: "Round 1", code: "R1", accent: "#a78bfa", minRound: 1 },
  { path: "/team/round2", label: "Round 2", code: "R2", accent: "#34d399", minRound: 2 },
  { path: "/team/round3", label: "Round 3", code: "R3", accent: "#fb923c", minRound: 3 },
  { path: "/team/leaderboard", label: "Leaderboard", code: "LB", accent: "#f472b6", minRound: 1 }
];

const PAGE_TITLE = {
  "/team": "Team Dashboard",
  "/team/round1": "Round 1 - MCQ Arena",
  "/team/round1/terms": "Round 1 - Terms",
  "/team/round1/arena": "Round 1 - MCQ Arena",
  "/team/round1/result": "Round 1 - Result",
  "/team/round2": "Round 2 - Coding Engine",
  "/team/round3": "Round 3 - Bug Hunter",
  "/team/leaderboard": "Live Leaderboard"
};

const ROUND1_PATH_PREFIX = "/team/round1";
const ROUND1_ARENA_PATH = "/team/round1/arena";
const META_SYNC_INTERVAL_MS = 20000;

const isPathActive = (pathname, path) =>
  pathname === path || (path !== "/team" && pathname.startsWith(path));

const hex2rgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const readCachedTeam = () => {
  try {
    const raw = localStorage.getItem("codeverse_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persistTeamCache = (team) => {
  try {
    const prev = readCachedTeam() || {};
    localStorage.setItem("codeverse_user", JSON.stringify({ ...prev, ...team }));
  } catch {
    // no-op
  }
};

export default function TeamLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(new Date());

  const [team, setTeam] = useState(() => {
    const cached = readCachedTeam();
    return {
      teamName: cached?.teamName || cached?.name || "Team",
      teamId: cached?.teamId || "T1",
      currentRound: Number(cached?.currentRound) || 1,
      totalScore: Number(cached?.totalScore) || 0
    };
  });

  const [eventLive, setEventLive] = useState(false);
  const [round1State, setRound1State] = useState({ started: false, submitted: false });
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState("");

  const title = PAGE_TITLE[location.pathname] || "Team Console";

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;

    const syncMeta = async () => {
      try {
        const [userResp, eventResp] = await Promise.all([getCurrentUser(), getEventStatus()]);
        if (!active) return;

        const apiTeam = userResp?.team || {};
        const mergedTeam = {
          teamName: apiTeam.teamName || "Team",
          teamId: apiTeam.teamId || "T1",
          currentRound: Number(apiTeam.currentRound) || 1,
          totalScore: Number(apiTeam.totalScore) || 0
        };

        setTeam(mergedTeam);
        persistTeamCache({ ...apiTeam, ...mergedTeam });
        setEventLive(Boolean(eventResp?.isLive));
        setMetaError("");

        if (mergedTeam.currentRound === 1) {
          try {
            const r1 = await getRound1Status();
            if (!active) return;
            setRound1State({
              started: Boolean(r1?.started),
              submitted: Boolean(r1?.submitted)
            });
          } catch (error) {
            if (!active) return;
            if (error?.response?.status !== 403) {
              setMetaError(getApiErrorMessage(error, "Unable to sync round status."));
            }
            setRound1State({ started: false, submitted: false });
          }
        } else {
          setRound1State({ started: false, submitted: true });
        }
      } catch (error) {
        if (!active) return;
        const cached = readCachedTeam();
        if (cached) {
          setTeam({
            teamName: cached.teamName || cached.name || "Team",
            teamId: cached.teamId || "T1",
            currentRound: Number(cached.currentRound) || 1,
            totalScore: Number(cached.totalScore) || 0
          });
        }
        setMetaError(getApiErrorMessage(error, "Unable to sync team access data."));
      } finally {
        if (active) {
          setLoadingMeta(false);
        }
      }
    };

    void syncMeta();
    const pollId = setInterval(() => {
      void syncMeta();
    }, META_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(pollId);
    };
  }, []);

  const hardLockToRound1 =
    team.currentRound === 1 && round1State.started && !round1State.submitted;

  const isNavItemLocked = useMemo(
    () => (item) => {
      if (hardLockToRound1 && !item.path.startsWith(ROUND1_PATH_PREFIX)) {
        return true;
      }
      if (item.minRound > team.currentRound) {
        return true;
      }
      return false;
    },
    [hardLockToRound1, team.currentRound]
  );

  useEffect(() => {
    if (loadingMeta) return;
    if (!hardLockToRound1 || location.pathname.startsWith(ROUND1_PATH_PREFIX)) {
      return;
    }

    let cancelled = false;

    const verifyLock = async () => {
      try {
        const userResp = await getCurrentUser();
        if (cancelled) return;

        const apiTeam = userResp?.team || {};
        const currentRound = Number(apiTeam.currentRound) || 1;
        if (currentRound > 1) {
          setTeam((prev) => ({
            ...prev,
            teamName: apiTeam.teamName || prev.teamName,
            teamId: apiTeam.teamId || prev.teamId,
            currentRound,
            totalScore: Number(apiTeam.totalScore) || prev.totalScore
          }));
          setRound1State({ started: false, submitted: true });
          return;
        }

        const round1Status = await getRound1Status();
        if (cancelled) return;
        if (round1Status?.submitted) {
          setRound1State({ started: false, submitted: true });
          return;
        }
      } catch {
        // fall through to arena redirect
      }

      if (!cancelled) {
        navigate(ROUND1_ARENA_PATH, { replace: true });
      }
    };

    void verifyLock();
    return () => {
      cancelled = true;
    };
  }, [hardLockToRound1, loadingMeta, location.pathname, navigate]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // clear local session even if server logout fails
    } finally {
      clearAuthSession();
      navigate("/", { replace: true });
    }
  };

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  const signalLabel = hardLockToRound1 ? "Round Locked" : eventLive ? "Stable" : "Standby";
  const signalAccent = hardLockToRound1 ? "#fb923c" : eventLive ? "#4ade80" : "#94a3b8";

  return (
    <div
      style={{
        height: "100vh",
        background: "#0d0f14",
        fontFamily: "'DM Mono', 'Fira Code', monospace",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: "62px",
          background: "#13161e",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 18px rgba(56,189,248,0.25)"
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
              &lt;/&gt;
            </span>
          </div>
          <div>
            <span style={{ fontSize: "17px", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.01em", lineHeight: 1 }}>
              Codeverse
            </span>
            <p style={{ fontSize: "9px", letterSpacing: "0.28em", color: "rgba(148,163,184,0.4)", textTransform: "uppercase", marginTop: "3px" }}>
              Team Console
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.06em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{hh}</span>
            <motion.span animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1, marginBottom: "1px" }}>:</motion.span>
            <span style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.06em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{mm}</span>
            <motion.span animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1, marginBottom: "1px" }}>:</motion.span>
            <span style={{ fontSize: "22px", fontWeight: 700, background: "linear-gradient(135deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.06em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{ss}</span>
          </div>
          <span style={{ fontSize: "9px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(148,163,184,0.38)" }}>
            {dateStr}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "9px", letterSpacing: "0.26em", color: "rgba(148,163,184,0.35)", textTransform: "uppercase", marginBottom: "2px" }}>
              Viewing
            </p>
            <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", letterSpacing: "0.01em" }}>
              {title}
            </h2>
          </div>
          <div style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.07)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", borderRadius: "10px", background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.17)" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px rgba(56,189,248,0.95)" }} />
            <span style={{ fontSize: "12px", letterSpacing: "0.14em", color: "#7dd3fc", textTransform: "uppercase", fontWeight: 500 }}>
              {team.teamName} [{team.teamId}]
            </span>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: expanded ? "232px" : "66px",
            flexShrink: 0,
            transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
            display: "flex",
            flexDirection: "column",
            background: "#13161e",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
            height: "100%"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "space-between" : "center",
              padding: "14px 12px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <AnimatePresence>
              {expanded && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} style={{ fontSize: "9px", letterSpacing: "0.32em", color: "rgba(100,116,139,0.55)", textTransform: "uppercase" }}>
                  Navigation
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label="Toggle sidebar"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(203,213,225,0.5)",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
                flexShrink: 0
              }}
            >
              {expanded ? "<" : ">"}
            </button>
          </div>

          <nav style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
            {NAV_ITEMS.map((item, index) => {
              const active = isPathActive(location.pathname, item.path);
              const locked = isNavItemLocked(item);
              const baseColor = locked ? "rgba(100,116,139,0.42)" : active ? item.accent : "rgba(148,163,184,0.5)";
              return (
                <Link
                  key={item.path}
                  to={locked ? location.pathname : item.path}
                  title={!expanded ? item.label : undefined}
                  onClick={(event) => {
                    if (locked) event.preventDefault();
                  }}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: "11px",
                    padding: expanded ? "10px 11px 10px 14px" : "10px 0",
                    justifyContent: expanded ? "flex-start" : "center",
                    borderRadius: "11px",
                    textDecoration: "none",
                    transition: "all 0.14s",
                    background: active ? hex2rgba(item.accent, 0.09) : "transparent",
                    border: `1px solid ${active ? hex2rgba(item.accent, 0.22) : "transparent"}`,
                    color: baseColor,
                    overflow: "hidden",
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.6 : 1
                  }}
                >
                  {active && !locked && (
                    <motion.span
                      layoutId="sidebarBar"
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "18%",
                        bottom: "18%",
                        width: "3px",
                        borderRadius: "0 3px 3px 0",
                        background: item.accent,
                        boxShadow: `0 0 10px ${hex2rgba(item.accent, 0.65)}`
                      }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}

                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      flexShrink: 0,
                      borderRadius: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      background: active && !locked ? hex2rgba(item.accent, 0.14) : "rgba(255,255,255,0.05)",
                      border: `1px solid ${active && !locked ? hex2rgba(item.accent, 0.28) : "rgba(255,255,255,0.07)"}`,
                      color: active && !locked ? item.accent : "rgba(148,163,184,0.4)",
                      transition: "all 0.14s",
                      boxShadow: active && !locked ? `0 0 14px ${hex2rgba(item.accent, 0.22)}` : "none"
                    }}
                  >
                    {item.code}
                  </span>

                  <AnimatePresence>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -7 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -7 }}
                        transition={{ duration: 0.16, delay: index * 0.018 }}
                        style={{ fontSize: "13px", fontWeight: active ? 600 : 400, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {locked && expanded && (
                    <span style={{ fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,113,113,0.8)" }}>
                      Lock
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div style={{ padding: "10px" }}>
            <div style={{ borderRadius: "11px", padding: expanded ? "13px 14px" : "10px 8px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "9px", alignItems: expanded ? "stretch" : "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: expanded ? "space-between" : "center", gap: "8px" }}>
                <AnimatePresence>
                  {expanded && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "10px", color: "rgba(148,163,184,0.4)", letterSpacing: "0.04em" }}>
                      Signal
                    </motion.span>
                  )}
                </AnimatePresence>
                <span style={{ display: "flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "999px", fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: signalAccent, background: hex2rgba(signalAccent, 0.1), border: `1px solid ${hex2rgba(signalAccent, 0.24)}` }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: signalAccent, boxShadow: `0 0 6px ${hex2rgba(signalAccent, 0.85)}` }} />
                  {expanded && signalLabel}
                </span>
              </div>

              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(148,163,184,0.58)", display: "flex", justifyContent: "space-between" }}>
                      <span>Round</span>
                      <span>R{team.currentRound}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(148,163,184,0.58)", display: "flex", justifyContent: "space-between" }}>
                      <span>Score</span>
                      <span>{team.totalScore}</span>
                    </div>
                    {metaError && (
                      <div style={{ fontSize: "9px", color: "rgba(251,146,60,0.75)", lineHeight: 1.4 }}>
                        Sync delayed
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ padding: "0 10px 12px" }}>
            <button
              type="button"
              onClick={handleLogout}
              title={!expanded ? "Logout" : undefined}
              style={{
                width: "100%",
                borderRadius: "11px",
                padding: expanded ? "11px 12px" : "10px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: expanded ? "space-between" : "center",
                gap: "10px",
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.22)",
                color: "rgba(251,113,133,0.95)",
                cursor: "pointer",
                transition: "all 0.14s"
              }}
            >
              <span style={{ width: "30px", height: "30px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.28)" }}>
                OUT
              </span>
              <AnimatePresence>
                {expanded && (
                  <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.14 }} style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "28px 24px", background: "#0d0f14" }}>
          <div style={{ maxWidth: "1152px", margin: "0 auto" }}>
            {loadingMeta ? (
              <div style={{ padding: "18px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(148,163,184,0.65)" }}>
                Syncing team access...
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;600&display=swap');
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing: border-box; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 4px; }
      `}</style>
    </div>
  );
}
