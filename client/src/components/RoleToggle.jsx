export default function RoleToggle({ role, options, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
      {Object.keys(options).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            role === key
              ? "bg-accent text-slate shadow-glow"
              : "text-ink/80 hover:bg-white/10"
          }`}
        >
          {options[key].label}
        </button>
      ))}
    </div>
  );
}
