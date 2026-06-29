import { tokens } from "../tokens";
import type { CTAItem, MediaItem } from "../schemas";
import { CTAButton } from "./_internal/CTAButton";

export interface HeroProps {
  eyebrow?: string;
  /** H1 da página. EXATAMENTE 1 Hero por LP. */
  title: string;
  subtitle?: string;
  ctas?: CTAItem[];
  media?: MediaItem;
  /** Layout: "centered" (sem mídia) ou "split" (texto + mídia 50/50). */
  variant?: "centered" | "split";
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  ctas = [],
  media,
  variant = "centered",
}: HeroProps) {
  const isSplit = variant === "split" && !!media;

  return (
    <section className={`${tokens.layout.section} ${tokens.surface.base} relative`}>
      <div
        className={
          isSplit
            ? `${tokens.layout.containerWide} ${tokens.grid.cols2} items-center`
            : `${tokens.layout.containerNarrow} text-center`
        }
      >
        <div className={tokens.motion.fadeInUp}>
          {eyebrow && <span className={tokens.typography.eyebrow}>{eyebrow}</span>}
          <h1 className={`${tokens.typography.display} mt-4`}>{title}</h1>
          {subtitle && (
            <p className={`${tokens.typography.lead} mt-6 max-w-2xl ${isSplit ? "" : "mx-auto"}`}>
              {subtitle}
            </p>
          )}
          {ctas.length > 0 && (
            <div className={`mt-10 flex flex-wrap gap-3 ${isSplit ? "" : "justify-center"}`}>
              {ctas.map((cta) => (
                <CTAButton key={cta.href} cta={cta} position="hero" />
              ))}
            </div>
          )}
        </div>
        {isSplit && media && <HeroMedia media={media} />}
      </div>
    </section>
  );
}

function HeroMedia({ media }: { media: MediaItem }) {
  if (media.type === "video") {
    return (
      <div className="rounded-xl overflow-hidden border border-border bg-muted aspect-video">
        <video
          src={media.src}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <img
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      loading="eager"
      decoding="async"
      className="rounded-xl border border-border w-full h-auto"
    />
  );
}
