export default function StatusMessage({ status }) {
  if (!status || status.type === "idle") {
    return null;
  }

  const base = "rounded-xl border px-4 py-3 text-sm";
  const styles =
    status.type === "success"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
      : "border-rose-400/40 bg-rose-400/10 text-rose-100";

  return <div className={`${base} ${styles}`}>{status.message}</div>;
}
