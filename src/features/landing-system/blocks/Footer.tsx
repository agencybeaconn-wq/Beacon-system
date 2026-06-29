import { tokens } from "../tokens";
import type { NavItem } from "../schemas";

export interface FooterProps {
  /** Grupos de links agrupados por título. */
  groups?: { title: string; items: NavItem[] }[];
  /** Tagline curta abaixo do logo. */
  tagline?: string;
  /** Texto de copyright. Default: © {year} Lever. */
  copyright?: string;
  /** Links inferiores legais (privacy, terms). */
  legal?: NavItem[];
}

export function Footer({ groups = [], tagline, copyright, legal = [] }: FooterProps) {
  const year = new Date().getFullYear();
  const copy = copyright ?? `© ${year} Beacon. Todos os direitos reservados.`;

  return (
    <footer className={`${tokens.surface.muted} border-t border-border`}>
      <div className={`${tokens.layout.containerWide} py-16 md:py-20`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4">
            <div className="text-xl font-bold tracking-tight text-foreground">Beacon</div>
            {tagline && <p className={`${tokens.typography.small} mt-3 max-w-xs`}>{tagline}</p>}
          </div>
          {groups.length > 0 && (
            <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
              {groups.map((group) => (
                <div key={group.title}>
                  <h4 className="text-sm font-semibold text-foreground">{group.title}</h4>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noopener noreferrer" : undefined}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <p className={tokens.typography.small}>{copy}</p>
          {legal.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {legal.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
