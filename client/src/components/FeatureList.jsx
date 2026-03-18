export default function FeatureList({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-glow" />
          <span className="text-sm text-ink/90">{item}</span>
        </div>
      ))}
    </div>
  );
}
