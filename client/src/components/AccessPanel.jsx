import FormField from "./FormField";
import RoleToggle from "./RoleToggle";
import StatusMessage from "./StatusMessage";

export default function AccessPanel({
  role,
  roleOptions,
  currentRole,
  form,
  title = "Access Console",
  subtitle = "Sign in as an admin or a team from the same gateway.",
  showRoleToggle = true,
  onRoleChange,
  onChange,
  onSubmit,
  status,
  loading
}) {
  return (
    <section className="panel animate-slide-up">
      <header>
        <p className="text-lg font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </header>

      {showRoleToggle && roleOptions ? (
        <RoleToggle role={role} options={roleOptions} onChange={onRoleChange} />
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <FormField
          label={currentRole.field.label}
          name={currentRole.field.name}
          value={form[currentRole.field.name]}
          onChange={onChange}
          placeholder={currentRole.field.placeholder}
          type={role === "admin" ? "email" : "text"}
          autoComplete={role === "admin" ? "email" : "username"}
        />

        <FormField
          label="Password"
          name="password"
          value={form.password}
          onChange={onChange}
          placeholder="Enter password"
          type="password"
          autoComplete={role === "admin" ? "current-password" : "password"}
        />

        <StatusMessage status={status} />

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-accent to-blue-400 px-4 py-3 text-base font-semibold text-slate transition hover:-translate-y-0.5 hover:shadow-panel disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Authenticating..." : "Login"}
        </button>
      </form>

      <div className="flex flex-col gap-1 border-t border-white/10 pt-4 text-xs text-muted sm:flex-row sm:justify-between">
        <span>Need access?</span>
        <span>Contact the CodeVerse admin team.</span>
      </div>
    </section>
  );
}
