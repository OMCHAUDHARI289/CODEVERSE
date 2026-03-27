import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { roleOptions } from "../data/authOptions";
import { loginAdmin, loginTeam } from "../api/authApi";
import { getApiErrorMessage } from "../api/httpClient";
import { setAuthSession } from "../api/session";

const defaultStatus = { type: "idle", message: "" };

/* ─── Password Strength ─────────────────────────────────────────── */
function getStrength(v) {
  let s = 0;
  if (v.length > 4) s++;
  if (v.length > 8) s++;
  if (/[A-Z]/.test(v) && /[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return Math.min(4, s);
}
const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

/* ─── Animated Input ────────────────────────────────────────────── */
function Field({ label, hint, onHintClick, children, extra }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </span>
        {hint && (
          <button type="button" onClick={onHintClick}
            style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(124,58,237,.7)", background: "none", border: "none", cursor: "pointer" }}>
            {hint}
          </button>
        )}
      </div>
      {children}
      {extra}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */
export default function LoginModal({ isOpen, onClose }) {
  const [role, setRole] = useState("team");
  const [form, setForm] = useState({ teamId: "", email: "", password: "" });
  const [status, setStatus] = useState(defaultStatus);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showSuccessLoader, setShowSuccessLoader] = useState(false);
  const redirectTimerRef = useRef(null);
  const navigate = useNavigate();
  const currentRole = useMemo(() => roleOptions[role], [role]);
  const strength = getStrength(form.password);

  useEffect(() => {
    if (!isOpen) return;
    const pH = document.documentElement.style.overflow, pB = document.body.style.overflow;
    document.documentElement.style.overflow = document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.documentElement.style.overflow = pH; document.body.style.overflow = pB; };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      setShowSuccessLoader(false);
      setLoading(false);
      return;
    }
    setStatus(defaultStatus);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }, []);

  const handleRoleChange = useCallback((next) => {
    setRole(next);
    setStatus(defaultStatus);
    setShowSuccessLoader(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(defaultStatus);
    const payload = role === "admin"
      ? { email: form.email.trim(), password: form.password }
      : { teamId: form.teamId.trim(), password: form.password };
    if (!payload.password || (!payload.teamId && !payload.email)) {
      setStatus({ type: "error", message: "All fields are required to proceed." }); return;
    }
    setLoading(true);
    try {
      const data = role === "admin" ? await loginAdmin(payload) : await loginTeam(payload);
      setAuthSession({ token: data.token, role, user: data.admin || data.team || {} });
      setStatus({ type: "success", message: "Access granted. Initializing ICEM..." });
      setShowSuccessLoader(true);
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        onClose?.();
        navigate(role === "admin" ? "/admin" : "/team");
        redirectTimerRef.current = null;
      }, 2300);
    } catch (err) {
      setShowSuccessLoader(false);
      setStatus({ type: "error", message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <button type="button" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", border: "none", cursor: "default" }} onClick={onClose} />

          {/* Card */}
          <motion.div role="dialog" aria-modal="true"
            style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420, background: "#0d0d12", borderRadius: 28, padding: "36px 32px 28px", overflow: "hidden", border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 0 0 1px rgba(255,255,255,.03),0 40px 100px rgba(0,0,0,.6)", fontFamily: "'Inter',sans-serif" }}
            initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            {/* Top accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#7c3aed 30%,#06b6d4 70%,transparent)" }} />
            {/* Top glow */}
            <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 300, height: 160, background: "radial-gradient(ellipse,rgba(124,58,237,.15),transparent 70%)", pointerEvents: "none" }} />

            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(124,58,237,.4)", flexShrink: 0, fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
                CV
              </div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>CodeVerse</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 1 }}>Developer Platform</div>
              </div>
            </div>

            <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)", marginBottom: 24 }} />

            {showSuccessLoader ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ padding: "14px 0 10px" }}
              >
                <AuthSuccessLoader />
              </motion.div>
            ) : (
              <>
                {/* Role tabs */}
                <div style={{ display: "flex", background: "rgba(255,255,255,.04)", borderRadius: 12, padding: 3, border: "1px solid rgba(255,255,255,.05)", marginBottom: 24 }}>
                  {Object.keys(roleOptions).map((key) => (
                    <button key={key} type="button" onClick={() => handleRoleChange(key)}
                      style={{ flex: 1, padding: "9px 0", border: role === key ? "1px solid rgba(124,58,237,.35)" : "1px solid transparent", cursor: "pointer", borderRadius: 9, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", background: role === key ? "#1a1a2e" : "none", color: role === key ? "#fff" : "rgba(255,255,255,.3)", boxShadow: role === key ? "0 2px 12px rgba(0,0,0,.4)" : "none", transition: "all .25s" }}>
                      {roleOptions[key].label}
                    </button>
                  ))}
                </div>

                {/* Status messages */}
                <AnimatePresence mode="wait">
                  {status.type !== "idle" && (
                    <motion.div key={status.message} initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 12, fontFamily: "'Inter',sans-serif", ...(status.type === "error" ? { background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "rgba(252,165,165,.9)" } : { background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)", color: "rgba(134,239,172,.9)" }) }}>
                      {status.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                  {/* ID / Email field */}
                  <Field label={currentRole.field.label}>
                    <InputFocused type={role === "admin" ? "email" : "text"} name={currentRole.field.name} value={form[currentRole.field.name]} onChange={handleChange} autoComplete={role === "admin" ? "email" : "username"} placeholder={currentRole.field.placeholder} />
                  </Field>

                  {/* Password field */}
                  <Field label="Access Key" hint={showPw ? "Hide" : "Show"} onHintClick={() => setShowPw(p => !p)}
                    extra={
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ height: 2, flex: 1, borderRadius: 2, background: i <= strength ? strengthColor[strength] : "rgba(255,255,255,.08)", transition: "background .3s" }} />
                        ))}
                      </div>
                    }>
                    <InputFocused type={showPw ? "text" : "password"} name="password" value={form.password} onChange={handleChange} autoComplete={role === "admin" ? "current-password" : "password"} placeholder="Enter your access key" />
                  </Field>

                  {/* Status strip */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 10, padding: "8px 12px", marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <motion.span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", display: "inline-block" }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                      <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Secure Session</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 6 }}>Signal</span>
                      {[6,9,13,17].map((h, i) => (
                        <motion.div key={i} style={{ width: 3, height: h, borderRadius: 1, background: "linear-gradient(to top,#06b6d4,#7c3aed)" }} animate={{ opacity: [0.35, 0.9, 0.35] }} transition={{ duration: 1.5, delay: i * 0.12, repeat: Infinity }} />
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.button type="submit" disabled={loading}
                    style={{ width: "100%", border: "none", cursor: loading ? "not-allowed" : "pointer", borderRadius: 14, padding: "15px 20px", position: "relative", overflow: "hidden", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#0891b2 100%)", boxShadow: "0 4px 24px rgba(124,58,237,.4),0 0 0 1px rgba(124,58,237,.2)", opacity: loading ? 0.7 : 1 }}
                    whileHover={!loading ? { translateY: -1, boxShadow: "0 8px 32px rgba(124,58,237,.55)" } : {}}
                    whileTap={!loading ? { scale: 0.99 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}>
                    <motion.div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg,transparent 30%,rgba(255,255,255,.15) 50%,transparent 70%)", pointerEvents: "none" }}
                      animate={{ x: ["-100%", "150%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 0.5 }} />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative" }}>
                      {loading && (
                        <motion.svg width={14} height={14} viewBox="0 0 14 14" fill="none" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}>
                          <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,.25)" strokeWidth="2"/>
                          <path d="M7 2A5 5 0 0 1 12 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </motion.svg>
                      )}
                      <span>{loading ? "Authenticating..." : "Enter the Arena"}</span>
                      {!loading && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7h10M7 2l5 5-5 5" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </motion.button>
                </form>

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 }}>
                  <button type="button" style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(255,255,255,.2)", background: "none", border: "none", cursor: "pointer", transition: "color .2s" }}
                    onMouseEnter={e => e.target.style.color = "rgba(255,255,255,.55)"}
                    onMouseLeave={e => e.target.style.color = "rgba(255,255,255,.2)"}>
                    Forgot access key?
                  </button>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,.12)", display: "inline-block" }} />
                  <button type="button" onClick={onClose} style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(255,255,255,.2)", background: "none", border: "none", cursor: "pointer", transition: "color .2s" }}
                    onMouseEnter={e => e.target.style.color = "rgba(255,255,255,.55)"}
                    onMouseLeave={e => e.target.style.color = "rgba(255,255,255,.2)"}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Focus-tracked input ───────────────────────────────────────── */
function InputFocused(props) {
  const [focused, setFocused] = useState(false);
  return (
    <input {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        background: focused ? "rgba(124,58,237,.08)" : "rgba(255,255,255,.05)",
        border: `1px solid ${focused ? "rgba(124,58,237,.5)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 12, padding: "13px 16px",
        fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 400, color: "#fff",
        outline: "none", caretColor: "#a855f7",
        boxShadow: focused ? "0 0 0 4px rgba(124,58,237,.1)" : "none",
        transition: "all .2s ease",
      }}
    />
  );
}

function AuthSuccessLoader() {
  return (
    <div className="cv-auth-loader-shell" aria-live="polite">
      <div className="cv-auth-loader-track">
        <svg height="0" width="0" viewBox="0 0 64 64" className="cv-auth-loader-abs" aria-hidden="true">
          <defs xmlns="http://www.w3.org/2000/svg">
            <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="cv-auth-b">
              <stop stopColor="#973BED" />
              <stop stopColor="#007CFF" offset="1" />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id="cv-auth-c">
              <stop stopColor="#FFC800" />
              <stop stopColor="#F0F" offset="1" />
              <animateTransform
                repeatCount="indefinite"
                keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1"
                keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1"
                dur="8s"
                values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32"
                type="rotate"
                attributeName="gradientTransform"
              />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="cv-auth-d">
              <stop stopColor="#00E0ED" />
              <stop stopColor="#00DA72" offset="1" />
            </linearGradient>
          </defs>
        </svg>

        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="64" className="cv-auth-loader-inline" aria-hidden="true">
          <path
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth="8"
            stroke="url(#cv-auth-b)"
            d="M 54.722656,3.9726563 A 2.0002,2.0002 0 0 0 54.941406,4 h 5.007813 C 58.955121,17.046124 49.099667,27.677057 36.121094,29.580078 a 2.0002,2.0002 0 0 0 -1.708985,1.978516 V 60 H 29.587891 V 31.558594 A 2.0002,2.0002 0 0 0 27.878906,29.580078 C 14.900333,27.677057 5.0448787,17.046124 4.0507812,4 H 9.28125 c 1.231666,11.63657 10.984383,20.554048 22.6875,20.734375 a 2.0002,2.0002 0 0 0 0.02344,0 c 11.806958,0.04283 21.70649,-9.003371 22.730469,-20.7617187 z"
            className="cv-auth-loader-dash"
            pathLength="360"
          />
        </svg>

        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="64" className="cv-auth-loader-inline" aria-hidden="true">
          <path
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth="10"
            stroke="url(#cv-auth-c)"
            d="M 32 32 m 0 -27 a 27 27 0 1 1 0 54 a 27 27 0 1 1 0 -54"
            className="cv-auth-loader-spin"
            pathLength="360"
          />
        </svg>

        <div className="cv-auth-loader-gap" />

        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="64" className="cv-auth-loader-inline" aria-hidden="true">
          <path
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth="8"
            stroke="url(#cv-auth-d)"
            d="M 4,4 h 4.6230469 v 25.
            919922 c -0.00276,11.916203 9.8364941,21.550422 21.7500001,21.296875 11.616666,-0.240651 21.014356,-9.63894 21.253906,-21.25586 a 2.0002,2.0002 0 0 0 0,-0.04102 V 4 H 56.25 v 25.919922 c 0,14.33873 -11.581192,25.919922 -25.919922,25.919922 a 2.0002,2.0002 0 0 0 -0.0293,0 C 15.812309,56.052941 3.998433,44.409961 4,29.919922 Z"
            className="cv-auth-loader-dash"
            pathLength="360"
          />
        </svg>
      </div>

      <div className="cv-auth-loader-word">ICEM</div>
      <div className="cv-auth-loader-sub">Initializing secure workspace...</div>
    </div>
  );
}