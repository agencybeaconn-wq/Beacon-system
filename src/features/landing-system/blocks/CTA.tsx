import { tokens } from "../tokens";
import type { CTAItem } from "../schemas";
import { CTAButton } from "./_internal/CTAButton";

export interface CTAProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctas: CTAItem[];
  /** Surface tonal: "muted" (cinza claro) ou "accent" (vermelho Lever). */
  tone?: "muted" | "accent" | "invert";
}

export function CTA({ eyebrow, title, subtitle, ctas, tone = "muted" }: CTAProps) {
  const surface =
    tone === "accent"
      ? tokens.surface.accent
      : tone === "invert"
        ? tokens.surface.invert
        : tokens.surface.muted;

  return (
    <section className={`${tokens.layout.section} ${surface}`}>
      <div className={`${tokens.layout.containerNarrow} text-center`}>
        {eyebrow && (
          <span className={tone === "accent" ? "text-xs md:text-sm font-medium uppercase tracking-[0.18em] opacity-80" : tokens.typography.eyebrow}>
            {eyebrow}
          </span>
        )}
        <h2 className={`${tokens.typography.h2} mt-4 ${tone === "accent" || tone === "invert" ? "text-current" : ""}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-6 max-w-2xl mx-auto text-lg leading-relaxed ${tone === "accent" || tone === "invert" ? "opacity-90" : "text-muted-foreground"}`}>
            {subtitle}
          </p>
        )}
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          {ctas.map((cta) => (
            <CTAButton key={cta.href} cta={cta} position="cta-section" />
          ))}
        </div>
      </div>
    </section>
  );
}
