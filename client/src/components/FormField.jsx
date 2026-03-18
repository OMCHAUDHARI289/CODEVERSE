export default function FormField({
  label,
  name,
  value,
  type = "text",
  placeholder,
  autoComplete,
  onChange
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-muted">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accentSoft"
      />
    </label>
  );
}
