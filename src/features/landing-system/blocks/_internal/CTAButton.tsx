import { tokens } from "../../tokens";
import type { CTAItem } from "../../schemas";

interface CTAButtonProps {
  cta: CTAItem;
  /** Posição da CTA na LP, vai pro analytics. */
  position: string;
}

export function CTAButton({ cta, position }: CTAButtonProps) {
  const variant = cta.variant ?? "primary";
  const className = tokens.button[variant];

  function handleClick() {
    const event = cta.trackEvent ?? "landing_cta_click";
    window.dispatchEvent(
      new CustomEvent(event, { detail: { position, label: cta.label, href: cta.href } }),
    );
  }

  if (cta.external) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={handleClick}
      >
        {cta.label}
      </a>
    );
  }

  return (
    <a href={cta.href} className={className} onClick={handleClick}>
      {cta.label}
    </a>
  );
}
