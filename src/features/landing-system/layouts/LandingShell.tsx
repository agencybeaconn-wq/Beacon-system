import { useEffect, type ReactNode } from "react";
import type { LandingMeta, NavItem } from "../schemas";
import { tokens } from "../tokens";
import { Footer, type FooterProps } from "../blocks/Footer";

export interface LandingShellProps {
  meta: LandingMeta;
  nav?: NavItem[];
  /** Props do Footer. Se ausente, esconde footer. */
  footer?: FooterProps;
  children: ReactNode;
}

/**
 * Wrapper de toda LP do Lever Site.
 *  - Aplica meta tags (title + description + og)
 *  - Renderiza header sticky com logo + nav
 *  - Wrap children em <main> com landmark a11y
 *  - Renderiza Footer
 */
export function LandingShell({ meta, nav = [], footer, children }: LandingShellProps) {
  useEffect(() => {
    document.title = meta.title;
    setMeta("description", meta.description);
    setMeta("og:title", meta.title, true);
    setMeta("og:description", meta.description, true);
    setMeta("og:type", "website", true);
  }, [meta]);

  return (
    <div className={tokens.surface.base}>
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className={`${tokens.layout.containerWide} flex h-16 items-center justify-between`}>
          <a href="/" className="text-lg font-bold tracking-tight text-foreground">
            Beacon
          </a>
          {nav.length > 0 && (
            <nav className="flex items-center gap-6">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main>{children}</main>
      {footer && <Footer {...footer} />}
    </div>
  );
}

function setMeta(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
