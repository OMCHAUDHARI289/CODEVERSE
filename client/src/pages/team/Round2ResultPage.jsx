import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getRound2Result } from "../../api/round2Api";
import { getApiErrorMessage } from "../../api/httpClient";
import { ROUND_CONFIG } from "../../data/roundConfig";

const mono = { fontFamily: "'DM Mono','Fira Code',monospace" };
const card = { background: "#13161e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
const lbl = { ...mono, fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" };

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function Round2ResultPage() {
  const navigate = useNavigate();
  const config = ROUND_CONFIG.round2;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const payload = await getRound2Result();
        if (!active) return;

        if (!(payload?.subA?.isSubmitted && payload?.subB?.isSubmitted)) {
          navigate(payload?.subA?.isStarted || payload?.subB?.isStarted ? config.routes.arena : config.routes.terms, {
            replace: true
          });
          return;
        }

        setStatus(payload);
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, "Unable to load Round 2 result."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [config.routes.arena, config.routes.terms, navigate]);

  const statCards = useMemo(() => {
    if (!status) return [];

    return [
      {
        label: "Sub A",
        score: status.subA?.score || 0,
        baseScore: status.subA?.baseScore || 0,
        bonusPoints: status.subA?.bonusPoints || 0,
        visiblePassed: status.subA?.visiblePassed || 0,
        hiddenPassed: status.subA?.hiddenPassed || 0,
        hiddenTotal: status.subA?.hiddenTotal || 0,
        passed: Boolean(status.subA?.passed),
        submittedAt: status.subA?.submittedAt
      },
      {
        label: "Sub B",
        score: status.subB?.score || 0,
        baseScore: status.subB?.baseScore || 0,
        bonusPoints: status.subB?.bonusPoints || 0,
        visiblePassed: status.subB?.visiblePassed || 0,
        hiddenPassed: status.subB?.hiddenPassed || 0,
        hiddenTotal: status.subB?.hiddenTotal || 0,
        passed: Boolean(status.subB?.passed),
        submittedAt: status.subB?.submittedAt
      }
    ];
  }, [status]);

  if (loading) {
    return (
      <div style={{ ...card, padding: "22px 24px", color: "#cbd5e1", ...mono }}>
        Loading Round 2 result...
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: "14px", color: "#e2e8f0", ...mono }}
    >
      <div style={{ ...card, padding: "24px 26px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,rgba(167,139,250,.55),transparent)" }} />
        <p style={{ ...lbl, color: "rgba(167,139,250,.65)" }}>Round 2 Complete</p>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", marginTop: "6px" }}>Coding Engine Result</h2>
        <div style={{ marginTop: "18px", display: "flex", alignItems: "end", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "40px", fontWeight: 700, color: "#a78bfa", lineHeight: 1 }}>{status?.totalScore || 0}</span>
          <span style={{ fontSize: "14px", color: "rgba(167,139,250,.55)", marginBottom: "6px" }}>/ {config.maxScore} pts</span>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", color: "#fca5a5", fontSize: "12px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
        {statCards.map((item) => (
          <div key={item.label} style={{ ...card, padding: "18px 20px" }}>
            <p style={{ ...lbl, color: item.passed ? "rgba(52,211,153,.6)" : "rgba(248,113,113,.6)" }}>{item.label}</p>
            <p style={{ marginTop: "8px", fontSize: "24px", fontWeight: 700, color: item.passed ? "#34d399" : "#f87171" }}>{item.score} pts</p>
            <p style={{ marginTop: "6px", fontSize: "11px", color: "rgba(203,213,225,.62)" }}>
              Visible: {item.visiblePassed}/3 · Hidden: {item.hiddenPassed}/{item.hiddenTotal}
            </p>
            <p style={{ marginTop: "6px", fontSize: "11px", color: "rgba(125,211,252,.75)" }}>
              Base: {item.baseScore} · Bonus: {item.bonusPoints}
            </p>
            <p style={{ marginTop: "12px", fontSize: "10px", color: "rgba(148,163,184,.55)" }}>
              Submitted: {formatDateTime(item.submittedAt)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: "18px 20px" }}>
        <p style={{ ...lbl, color: "rgba(56,189,248,.6)" }}>Timeline</p>
        <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "11px", color: "rgba(148,163,184,.58)" }}>Round Started</p>
            <p style={{ marginTop: "4px", fontSize: "13px", color: "#e2e8f0" }}>{formatDateTime(status?.startedAt)}</p>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "rgba(148,163,184,.58)" }}>Round Submitted</p>
            <p style={{ marginTop: "4px", fontSize: "13px", color: "#e2e8f0" }}>{formatDateTime(status?.submittedAt)}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => navigate(config.routes.arena)}
          style={{ ...mono, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "11px 18px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", color: "#e2e8f0", cursor: "pointer" }}
        >
          Review Arena
        </button>
        <button
          type="button"
          onClick={() => navigate(config.routes.nextRound)}
          style={{ ...mono, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "11px 18px", borderRadius: "10px", border: "1px solid rgba(52,211,153,.3)", background: "rgba(52,211,153,.1)", color: "#86efac", cursor: "pointer" }}
        >
          Continue to Round 3
        </button>
      </div>
    </motion.section>
  );
}
