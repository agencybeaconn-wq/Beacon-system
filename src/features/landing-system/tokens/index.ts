/**
 * Lever Landing System — Design Tokens
 *
 * Fonte canônica de classes Tailwind pra LPs do Lever Site.
 * Blocks SEMPRE importam daqui — nunca usar string Tailwind crua pra
 * tipografia, spacing ou cor de marca. Quando o sistema visual mudar,
 * troca este arquivo e todas as LPs herdam.
 *
 * Identidade base:
 *  - font: Inter Tight (sans + mono) — tailwind.config.ts
 *  - primary: hsl(0 72% 51%) — vermelho Lever — src/index.css
 *  - radius scale: 8/10/12px — tailwind.config.ts
 *  - container max: 1400px — tailwind.config.ts
 *  - motion: fade-in-up com cubic-bezier(0.16, 1, 0.3, 1) — 0.5s
 */

export const layout = {
  section: "py-20 md:py-28 lg:py-32",
  sectionTight: "py-12 md:py-16",
  container: "container mx-auto px-6 md:px-8",
  containerNarrow: "container mx-auto px-6 md:px-8 max-w-3xl",
  containerWide: "container mx-auto px-6 md:px-8 max-w-7xl",
} as const;

export const typography = {
  eyebrow:
    "inline-flex items-center gap-2 text-xs md:text-sm font-medium uppercase tracking-[0.18em] text-primary",
  display:
    "text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground",
  h1: "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-foreground",
  h2: "text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] text-foreground",
  h3: "text-2xl md:text-3xl font-semibold tracking-tight text-foreground",
  lead: "text-lg md:text-xl text-muted-foreground leading-relaxed",
  body: "text-base text-muted-foreground leading-relaxed",
  small: "text-sm text-muted-foreground",
  micro: "text-xs uppercase tracking-wider text-muted-foreground",
} as const;

export const surface = {
  base: "bg-background text-foreground",
  muted: "bg-muted text-foreground",
  card: "bg-card text-card-foreground border border-border rounded-xl",
  invert: "bg-foreground text-background",
  accent: "bg-primary text-primary-foreground",
} as const;

export const button = {
  primary:
    "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-md bg-primary text-primary-foreground font-medium text-base transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  secondary:
    "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-md bg-secondary text-secondary-foreground font-medium text-base transition-all hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ghost:
    "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-md text-foreground font-medium text-base transition-all hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  link:
    "inline-flex items-center gap-1 text-primary font-medium hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
} as const;

export const motion = {
  fadeInUp: "animate-fade-in-up",
  fadeInUpDelayed: "animate-fade-in-up [animation-delay:120ms]",
} as const;

export const grid = {
  cols2: "grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12",
  cols3: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8",
  cols4: "grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8",
} as const;

export const tokens = {
  layout,
  typography,
  surface,
  button,
  motion,
  grid,
} as const;

export type Tokens = typeof tokens;
