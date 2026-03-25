import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { getEventStatus } from "../api/eventApi";
import { clearAuthSession } from "../api/session";

const NAV_ITEMS = [
  { path: "/admin", label: "Dashboard", code: "DB", accent: "#f472b6" },
  { path: "/admin/teams", label: "Teams", code: "TM", accent: "#38bdf8" },
  { path: "/admin/questions", label: "Questions", code: "QS", accent: "#a78bfa" },
  { path: "/admin/leaderboard", label: "Leaderboard", code: "LB", accent: "#34d399" },
  { path: "/admin/lifeline", label: "Lifeline", code: "LF", accent: "#f97316" },
  { path: "/admin/controls", label: "Event Control", code: "EC", accent: "#fb923c" }
];

const PAGE_TITLE = {
  "/admin": "Admin Dashboard",
  "/admin/teams": "Team Monitor",
  "/admin/questions": "Question Bank",
  "/admin/leaderboard": "Global Leaderboard",
  "/admin/lifeline": "Lifeline Approval",
  "/admin/controls": "Event Control"
};

const isPathActive = (pathname, path) =>
  pathname === path || (path !== "/admin" && pathname.startsWith(path));

const hexToRgba = (hex, alpha) => {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const handleInactiveHoverIn = (event) => {
  const target = event.currentTarget;
  target.style.background = "rgba(255,255,255,0.04)";
  target.style.color = "#cbd5e1";
  target.style.border = "1px solid rgba(255,255,255,0.07)";
};

const handleInactiveHoverOut = (event) => {
  const target = event.currentTarget;
  target.style.background = "transparent";
  target.style.color = "rgba(148,163,184,0.5)";
  target.style.border = "1px solid transparent";
};

function AdminHeader({ title, eventLive, hh, mm, ss, dateStr }) {
  return (
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
            background: "linear-gradient(135deg, #f472b6 0%, #a855f7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 18px rgba(244,114,182,0.28)"
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.02em"
            }}
          >
            ADM
          </span>
        </div>

        <div>
          <span
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "0.01em",
              lineHeight: 1
            }}
          >
            Codeverse
          </span>
          <p
            style={{
              fontSize: "9px",
              letterSpacing: "0.28em",
              color: "rgba(148,163,184,0.4)",
              textTransform: "uppercase",
              marginTop: "3px"
            }}
          >
            Admin Console
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <span
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "0.06em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {hh}
          </span>
          <motion.span
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#f472b6",
              lineHeight: 1,
              marginBottom: "1px"
            }}
          >
            :
          </motion.span>
          <span
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "0.06em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {mm}
          </span>
          <motion.span
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#f472b6",
              lineHeight: 1,
              marginBottom: "1px"
            }}
          >
            :
          </motion.span>
          <span
            style={{
              fontSize: "22px",
              fontWeight: 700,
              background: "linear-gradient(135deg,#f472b6,#a855f7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.06em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {ss}
          </span>
        </div>
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(148,163,184,0.38)"
          }}
        >
          {dateStr}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: "9px",
              letterSpacing: "0.26em",
              color: "rgba(148,163,184,0.35)",
              textTransform: "uppercase",
              marginBottom: "2px"
            }}
          >
            Viewing
          </p>
          <h2
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#cbd5e1",
              letterSpacing: "0.01em"
            }}
          >
            {title}
          </h2>
        </div>

        <div
          style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.07)" }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 14px",
            borderRadius: "10px",
            background: eventLive ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
            border: eventLive
              ? "1px solid rgba(74,222,128,0.3)"
              : "1px solid rgba(251,191,36,0.3)"
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: eventLive ? "#4ade80" : "#fbbf24",
              boxShadow: eventLive
                ? "0 0 8px rgba(74,222,128,0.95)"
                : "0 0 8px rgba(251,191,36,0.95)"
            }}
          />
          <span
            style={{
              fontSize: "12px",
              letterSpacing: "0.14em",
              color: eventLive ? "#86efac" : "#fcd34d",
              textTransform: "uppercase",
              fontWeight: 500
            }}
          >
            {eventLive ? "Event Live" : "Starting Soon"}
          </span>
        </div>
      </div>
    </header>
  );
}

function AdminSidebar({
  expanded,
  onToggleExpanded,
  pathname,
  admin,
  onLogout
}) {
  return (
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
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{
                fontSize: "9px",
                letterSpacing: "0.32em",
                color: "rgba(100,116,139,0.55)",
                textTransform: "uppercase"
              }}
            >
              Navigation
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={onToggleExpanded}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
        >
          {expanded ? "<" : ">"}
        </button>
      </div>

      <nav
        style={{
          padding: "10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          flex: 1
        }}
      >
        {NAV_ITEMS.map((item, index) => {
          const active = isPathActive(pathname, item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              title={!expanded ? item.label : undefined}
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
                background: active ? hexToRgba(item.accent, 0.09) : "transparent",
                border: `1px solid ${
                  active ? hexToRgba(item.accent, 0.22) : "transparent"
                }`,
                color: active ? item.accent : "rgba(148,163,184,0.5)",
                overflow: "hidden"
              }}
              onMouseEnter={(event) => {
                if (!active) {
                  handleInactiveHoverIn(event);
                }
              }}
              onMouseLeave={(event) => {
                if (!active) {
                  handleInactiveHoverOut(event);
                }
              }}
            >
              {active && (
                <motion.span
                  layoutId="adminSidebarBar"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "18%",
                    bottom: "18%",
                    width: "3px",
                    borderRadius: "0 3px 3px 0",
                    background: item.accent,
                    boxShadow: `0 0 10px ${hexToRgba(item.accent, 0.65)}`
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
                  background: active ? hexToRgba(item.accent, 0.14) : "rgba(255,255,255,0.05)",
                  border: `1px solid ${
                    active ? hexToRgba(item.accent, 0.28) : "rgba(255,255,255,0.07)"
                  }`,
                  color: active ? item.accent : "rgba(148,163,184,0.4)",
                  transition: "all 0.14s",
                  boxShadow: active ? `0 0 14px ${hexToRgba(item.accent, 0.22)}` : "none"
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
                    style={{
                      fontSize: "13px",
                      fontWeight: active ? 600 : 400,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1
                    }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {active && expanded && (
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: item.accent,
                    boxShadow: `0 0 7px ${item.accent}`,
                    flexShrink: 0
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "10px" }}>
        <div
          style={{
            borderRadius: "11px",
            padding: expanded ? "13px 14px" : "10px 8px",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            alignItems: expanded ? "stretch" : "center"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "space-between" : "center",
              gap: "8px"
            }}
          >
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontSize: "10px",
                    color: "rgba(148,163,184,0.4)",
                    letterSpacing: "0.04em"
                  }}
                >
                  Admin
                </motion.span>
              )}
            </AnimatePresence>

            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 8px",
                borderRadius: "999px",
                fontSize: "9px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#f9a8d4",
                background: "rgba(244,114,182,0.08)",
                border: "1px solid rgba(244,114,182,0.18)"
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#f472b6",
                  boxShadow: "0 0 6px rgba(244,114,182,0.85)",
                  animation: "blink 1.8s infinite"
                }}
              />
              {expanded && "Online"}
            </span>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  fontSize: "11px",
                  lineHeight: 1.6,
                  color: "rgba(203,213,225,0.7)"
                }}
              >
                <div>{admin.name}</div>
                <div style={{ color: "rgba(148,163,184,0.6)" }}>
                  {admin.email || "admin@codeverse.com"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ padding: "0 10px 12px" }}>
        <button
          type="button"
          onClick={onLogout}
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
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "rgba(244,63,94,0.15)";
            event.currentTarget.style.border = "1px solid rgba(244,63,94,0.35)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "rgba(244,63,94,0.08)";
            event.currentTarget.style.border = "1px solid rgba(244,63,94,0.22)";
          }}
        >
          <span
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              background: "rgba(244,63,94,0.15)",
              border: "1px solid rgba(244,63,94,0.28)"
            }}
          >
            OUT
          </span>

          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.14 }}
                style={{
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em"
                }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [admin, setAdmin] = useState({ name: "Admin", email: "" });
  const [eventLive, setEventLive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const title = PAGE_TITLE[location.pathname] || "Admin Console";

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("codeverse_user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setAdmin({
        name: parsed.name || "Admin",
        email: parsed.email || ""
      });
    } catch {
      setAdmin({ name: "Admin", email: "" });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const readEvent = async () => {
      try {
        const data = await getEventStatus();
        if (mounted) {
          setEventLive(Boolean(data.isLive));
        }
      } catch {
        if (mounted) {
          setEventLive(false);
        }
      }
    };

    readEvent();
    const poll = setInterval(readEvent, 10000);
    return () => {
      mounted = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const handleEventStatusUpdate = (event) => {
      const nextStatus = Boolean(event?.detail?.isLive);
      setEventLive(nextStatus);
    };

    window.addEventListener("codeverse:event-status", handleEventStatusUpdate);
    return () => {
      window.removeEventListener("codeverse:event-status", handleEventStatusUpdate);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // We still clear client session even if API logout fails.
    } finally {
      clearAuthSession();
      navigate("/", { replace: true });
    }
  };

  const hh = useMemo(() => String(now.getHours()).padStart(2, "0"), [now]);
  const mm = useMemo(() => String(now.getMinutes()).padStart(2, "0"), [now]);
  const ss = useMemo(() => String(now.getSeconds()).padStart(2, "0"), [now]);
  const dateStr = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      }),
    [now]
  );

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
      <AdminHeader title={title} eventLive={eventLive} hh={hh} mm={mm} ss={ss} dateStr={dateStr} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <AdminSidebar
          expanded={expanded}
          onToggleExpanded={() => setExpanded((prev) => !prev)}
          pathname={location.pathname}
          admin={admin}
          onLogout={handleLogout}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            padding: "28px 24px",
            background: "#0d0f14"
          }}
        >
          <div style={{ width: "100%" }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
