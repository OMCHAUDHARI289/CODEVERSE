import { useMemo, useState } from "react";
import AccessPanel from "../components/AccessPanel";
import HeroPanel from "../components/HeroPanel";
import { roleOptions } from "../data/authOptions";
import { content } from "../data/content";

const defaultStatus = { type: "idle", message: "" };

export default function LoginPage() {
  const role = "team";
  const [form, setForm] = useState({ teamId: "", email: "", password: "" });
  const [status, setStatus] = useState(defaultStatus);
  const [loading, setLoading] = useState(false);

  const apiBase = import.meta.env.VITE_API_BASE || "";
  const currentRole = useMemo(() => roleOptions[role], [role]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(defaultStatus);

    const payload =
      role === "admin"
        ? { email: form.email.trim(), password: form.password }
        : { teamId: form.teamId.trim(), password: form.password };

    if (!payload.password || (!payload.email && !payload.teamId)) {
      setStatus({ type: "error", message: "All fields are required." });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${apiBase}${currentRole.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Login failed. Please try again.");
      }

      localStorage.setItem("codeverse_token", data.token);
      localStorage.setItem("codeverse_role", role);
      localStorage.setItem(
        "codeverse_user",
        JSON.stringify(data.admin || data.team || {})
      );

      setStatus({
        type: "success",
        message: `Welcome ${role === "admin" ? "Admin" : "Team"}. Access granted.`
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Something went wrong."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <HeroPanel content={content} />
        <AccessPanel
          role={role}
          currentRole={currentRole}
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          status={status}
          loading={loading}
          showRoleToggle={false}
          title="Team Access"
          subtitle="Login with your team id to continue."
        />
      </main>
    </div>
  );
}
