import BrandBadge from "./BrandBadge";
import FeatureList from "./FeatureList";

export default function HeroPanel({ content }) {
  return (
    <section className="flex flex-col gap-5 px-2 py-4 animate-fade-in">
      <BrandBadge label={content.brand} />
      <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">
        {content.title}
      </h1>
      <p className="max-w-xl text-base text-muted">{content.description}</p>
      <FeatureList items={content.highlights} />
      <div className="rounded-2xl border-l-4 border-accent bg-black/30 px-4 py-3 text-sm">
        <p className="text-ink/90">{content.tagline}</p>
        <p className="mt-1 text-xs text-muted">Secure tokens. Fast access. Zero clutter.</p>
      </div>
    </section>
  );
}
