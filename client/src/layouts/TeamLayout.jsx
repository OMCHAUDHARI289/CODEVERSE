import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutUser, getCurrentUser } from "../api/authApi";
import { getEventStatus } from "../api/eventApi";
import { getRound1Status } from "../api/round1Api";
import { getRound2Result } from "../api/round2Api";
import { fetchRound3Progress } from "../api/round3MockApi";
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
  "/team/round2/terms": "Round 2 - Terms",
  "/team/round2/arena": "Round 2 - Coding Engine",
  "/team/round2/result": "Round 2 - Result",
  "/team/round3": "Round 3 - Bug Apocalypse",
  "/team/round3/terms": "Round 3 - Terms",
  "/team/round3/language": "Round 3 - Language",
  "/team/round3/arena": "Round 3 - Debugging Battle",
  "/team/round3/result": "Round 3 - Result",
  "/team/round3/editor": "Round 3 - Debugging Battle",
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
  const [round2State, setRound2State] = useState({ started: false, submitted: false, activeSub: null });
  const [round3State, setRound3State] = useState({ started: false, submitted: false });
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

        if (mergedTeam.currentRound >= 2) {
          try {
            const r2 = await getRound2Result();
            if (!active) return;

            const subAStarted = Boolean(r2?.subA?.isStarted);
            const subASubmitted = Boolean(r2?.subA?.isSubmitted);
            const subBStarted = Boolean(r2?.subB?.isStarted);
            const subBSubmitted = Boolean(r2?.subB?.isSubmitted);
            const r2Started = subAStarted || subBStarted;
            const r2Submitted = subASubmitted && subBSubmitted;

            setRound2State({
              started: r2Started,
              submitted: r2Submitted,
              activeSub: r2?.activeSub || null
            });
          } catch {
            if (!active) return;
            setRound2State({ started: false, submitted: false, activeSub: null });
          }
        } else {
          setRound2State({ started: false, submitted: false, activeSub: null });
        }

        if (mergedTeam.currentRound >= 3) {
          try {
            const r3 = await fetchRound3Progress();
            if (!active) return;
            setRound3State({
              started: Boolean(r3?.isStarted),
              submitted: Boolean(r3?.isSubmitted)
            });
          } catch {
            if (!active) return;
            setRound3State({ started: false, submitted: false });
          }
        } else {
          setRound3State({ started: false, submitted: false });
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
  const isRound1Active = round1State.started && !round1State.submitted;
  const isRound2Active = round2State.started && !round2State.submitted;
  const isRound3Active = round3State.started && !round3State.submitted;
  const activeRoundNumber = isRound1Active ? 1 : isRound2Active ? 2 : isRound3Active ? 3 : null;
  const isAnyRoundActive = Boolean(activeRoundNumber);

  const isNavItemLocked = useMemo(
    () => (item) => {
      const isOnRound3Page = location.pathname.includes("/round3/") && !location.pathname.includes("/round3/result");
      if (isOnRound3Page && !location.pathname.startsWith(item.path) && item.path !== "/team") {
        return true;
      }

      if (hardLockToRound1 && !item.path.startsWith(ROUND1_PATH_PREFIX)) {
        return true;
      }

      if (item.path.startsWith("/team/round1") && team.currentRound > 1 && !location.pathname.startsWith("/team/round1/result")) {
        return true;
      }

      if (item.path.startsWith("/team/round2") && team.currentRound > 2 && !location.pathname.startsWith("/team/round2/result")) {
        return true;
      }

      if (item.minRound > team.currentRound) {
        return true;
      }

      if (item.path === "/team/leaderboard" && team.currentRound < 3) {
        return true;
      }
      return false;
    },
    [hardLockToRound1, team.currentRound, location.pathname]
  );

  useEffect(() => {
    if (loadingMeta) return;

    const isRound1LockedByProgression = location.pathname.startsWith("/team/round1") && team.currentRound > 1;
    const isRound2LockedByProgression = location.pathname.startsWith("/team/round2") && team.currentRound > 2 && !location.pathname.startsWith("/team/round2/result");

    if (!hardLockToRound1 && !isRound1LockedByProgression && !isRound2LockedByProgression) {
      return;
    }

    let cancelled = false;

    const verifyLock = async () => {
      try {
        const userResp = await getCurrentUser();
        if (cancelled) return;

        const apiTeam = userResp?.team || {};
        const currentRound = Number(apiTeam.currentRound) || 1;

        if (currentRound > 1 && location.pathname.startsWith("/team/round1")) {
          setTeam((prev) => ({
            ...prev,
            teamName: apiTeam.teamName || prev.teamName,
            teamId: apiTeam.teamId || prev.teamId,
            currentRound,
            totalScore: Number(apiTeam.totalScore) || prev.totalScore
          }));
          setRound1State({ started: false, submitted: true });
          if (!cancelled) navigate("/team/round2", { replace: true });
          return;
        }

        if (currentRound > 2 && location.pathname.startsWith("/team/round2") && !location.pathname.startsWith("/team/round2/result")) {
          setTeam((prev) => ({
            ...prev,
            teamName: apiTeam.teamName || prev.teamName,
            teamId: apiTeam.teamId || prev.teamId,
            currentRound,
            totalScore: Number(apiTeam.totalScore) || prev.totalScore
          }));
          setRound2State({ started: false, submitted: true, activeSub: null });
          if (!cancelled) navigate("/team/round3", { replace: true });
          return;
        }

        if (hardLockToRound1 && !location.pathname.startsWith(ROUND1_PATH_PREFIX)) {
          const round1Status = await getRound1Status();
          if (cancelled) return;
          if (round1Status?.submitted) {
            setRound1State({ started: false, submitted: true });
            return;
          }
        }
      } catch {
        // fall through to arena redirect
      }

      if (!cancelled) {
        if (location.pathname.startsWith("/team/round1") && team.currentRound > 1) {
          navigate("/team/round2", { replace: true });
        } else if (location.pathname.startsWith("/team/round2") && team.currentRound > 2) {
          navigate("/team/round3", { replace: true });
        } else if (hardLockToRound1) {
          navigate(ROUND1_ARENA_PATH, { replace: true });
        }
      }
    };

    void verifyLock();
    return () => {
      cancelled = true;
    };
  }, [hardLockToRound1, loadingMeta, location.pathname, navigate, team.currentRound]);

  const handleLogout = async () => {
    if (activeRoundNumber === 1) {
      setMetaError("Cannot logout while Round 1 is active. Please submit your answers first.");
      return;
    }
    if (activeRoundNumber === 2) {
      setMetaError("Cannot logout while Round 2 is active. Please submit your code first.");
      return;
    }
    if (activeRoundNumber === 3) {
      setMetaError("Cannot logout while Round 3 is active. Please submit your code first.");
      return;
    }

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
  const displayRoundCode = team.currentRound > 3 ? "LB" : `R${team.currentRound}`;
  const totalScoreVisible = team.currentRound > 3;
  const displayScore = totalScoreVisible ? team.totalScore : "Hidden";

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
                      <span>{displayRoundCode}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(148,163,184,0.58)", display: "flex", justifyContent: "space-between" }}>
                      <span>Score</span>
                      <span>{displayScore}</span>
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
              disabled={isAnyRoundActive}
              title={
                !expanded
                  ? "Logout"
                  : isAnyRoundActive
                    ? `Logout disabled while Round ${activeRoundNumber} is active`
                    : undefined
              }
              style={{
                width: "100%",
                borderRadius: "11px",
                padding: expanded ? "11px 12px" : "10px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: expanded ? "space-between" : "center",
                gap: "10px",
                background: isAnyRoundActive
                  ? "rgba(100,116,139,0.08)" 
                  : "rgba(244,63,94,0.08)",
                border: isAnyRoundActive
                  ? "1px solid rgba(100,116,139,0.15)"
                  : "1px solid rgba(244,63,94,0.22)",
                color: isAnyRoundActive
                  ? "rgba(100,116,139,0.5)"
                  : "rgba(251,113,133,0.95)",
                cursor: isAnyRoundActive ? "not-allowed" : "pointer",
                transition: "all 0.14s",
                opacity: isAnyRoundActive ? 0.6 : 1
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
          <div style={{ width: "100%" }}>
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
