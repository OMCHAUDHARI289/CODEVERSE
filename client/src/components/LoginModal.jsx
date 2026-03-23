import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { roleOptions } from "../data/authOptions";
import { loginAdmin, loginTeam } from "../api/authApi";
import { getApiErrorMessage } from "../api/httpClient";
import { setAuthSession } from "../api/session";
import StatusMessage from "./StatusMessage";

const defaultStatus = { type: "idle", message: "" };

export default function LoginModal({ isOpen, onClose }) {
  const [role, setRole] = useState("team");
  const [form, setForm] = useState({ teamId: "", email: "", password: "" });
  const [status, setStatus] = useState(defaultStatus);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const currentRole = useMemo(() => roleOptions[role], [role]);

  useEffect(() => {
    if (!isOpen) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isOpen, onClose]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setStatus(defaultStatus);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(defaultStatus);

    const payload =
      role === "admin"
        ? { email: form.email.trim(), password: form.password }
        : { teamId: form.teamId.trim(), password: form.password };

    if (!payload.password || (!payload.teamId && !payload.email)) {
      setStatus({ type: "error", message: "All fields are required." });
      return;
    }

    setLoading(true);

    try {
      const data = role === "admin"
        ? await loginAdmin(payload)
        : await loginTeam(payload);

      setAuthSession({
        token: data.token,
        role,
        user: data.admin || data.team || {}
      });

      setStatus({
        type: "success",
        message: `Welcome ${role === "admin" ? "Admin" : "Team"}. Access granted.`
      });

      setTimeout(() => {
        onClose?.();
        if (role === "admin") {
          navigate("/admin");
        } else {
          navigate("/team");
        }
      }, 800);
    } catch (error) {
      setStatus({
        type: "error",
        message: getApiErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            aria-label="Close login modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border border-white/15 bg-black/65 p-8 text-white shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 40, scale: 0.95, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <motion.div
              className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-fuchsia-500/40 blur-3xl"
              animate={{ y: [0, 12, 0], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-28 -left-20 h-52 w-52 rounded-full bg-sky-400/30 blur-3xl"
              animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-fuchsia-200/70">
                  Secure Access
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  Log in to CodeVerse
                </h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 p-1">
                {Object.keys(roleOptions).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleRoleChange(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${role === key
                        ? "bg-white/20 text-white"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    {roleOptions[key].label}
                  </button>
                ))}
              </div>
            </div>

            <motion.form
              className="mt-6 space-y-4"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { staggerChildren: 0.08, delayChildren: 0.1 }
                }
              }}
              onSubmit={handleSubmit}
            >
              <motion.label
                className="block text-xs uppercase tracking-[0.3em] text-fuchsia-200/70"
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              >
                {currentRole.field.label}
                <input
                  type={role === "admin" ? "email" : "text"}
                  name={currentRole.field.name}
                  value={form[currentRole.field.name]}
                  onChange={handleChange}
                  autoComplete={role === "admin" ? "email" : "username"}
                  placeholder={currentRole.field.placeholder}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/40 shadow-[0_10px_30px_-20px_rgba(236,72,153,0.6)] focus:border-fuchsia-300 focus:outline-none focus:ring-1 focus:ring-fuchsia-300/60"
                />
              </motion.label>
              <motion.label
                className="block text-xs uppercase tracking-[0.3em] text-fuchsia-200/70"
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              >
                Access Key
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete={
                    role === "admin" ? "current-password" : "password"
                  }
                  placeholder="********"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/40 shadow-[0_10px_30px_-20px_rgba(99,102,241,0.6)] focus:border-fuchsia-300 focus:outline-none focus:ring-1 focus:ring-fuchsia-300/60"
                />
              </motion.label>

              <StatusMessage status={status} />

              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Biometric lock enabled</span>
                <span>Signal: Stable</span>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                className="relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-20px_rgba(217,70,239,0.9)] transition disabled:cursor-not-allowed disabled:opacity-80"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <motion.span
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)]"
                  animate={{ x: ["-100%", "120%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
                {loading ? "Authenticating..." : "Enter the Arena"}
              </motion.button>
            </motion.form>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:bg-white/10"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
