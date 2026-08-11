import type { Config } from "tailwindcss";

/**
 * NODE — configuracao de tema.
 *
 * O ponto importante deste arquivo e a escala `fontSize`: cada tamanho carrega
 * SEU proprio tracking e SUA propria entrelinha. Isso e o que faz toda a
 * tipografia do sistema ficar certa sem editar pagina nenhuma — `text-3xl` ja
 * chega apertado, `text-xs` ja chega folgado.
 *
 * Tracking e funcao do tamanho: texto grande le com as letras longe demais
 * (precisa de negativo), texto miudo le com as letras coladas (precisa de
 * positivo). Um `letter-spacing` global e necessariamente errado em algum
 * tamanho. Ver skill /apple-design §15.
 */
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"SF Pro Display"', '"SF Pro Text"', '"SF Pro"', '"Geist"', '"Inter Tight"', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
      },

      /* Escala tipografica: [tamanho, { entrelinha, tracking }].
         Entrelinha anda ao contrario do tamanho — apertada no display, folgada
         no corpo. Tracking sai de +0.01em no miudo e desce ate -0.026em no
         display. */
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.01em" }],
        sm: ["0.875rem", { lineHeight: "1.45", letterSpacing: "0.006em" }],
        base: ["1rem", { lineHeight: "1.5", letterSpacing: "0em" }],
        lg: ["1.125rem", { lineHeight: "1.45", letterSpacing: "-0.004em" }],
        xl: ["1.25rem", { lineHeight: "1.4", letterSpacing: "-0.008em" }],
        "2xl": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.012em" }],
        "3xl": ["1.875rem", { lineHeight: "1.22", letterSpacing: "-0.016em" }],
        "4xl": ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.019em" }],
        "5xl": ["3rem", { lineHeight: "1.08", letterSpacing: "-0.021em" }],
        "6xl": ["3.75rem", { lineHeight: "1.05", letterSpacing: "-0.023em" }],
        "7xl": ["4.5rem", { lineHeight: "1.03", letterSpacing: "-0.024em" }],
        "8xl": ["6rem", { lineHeight: "1", letterSpacing: "-0.025em" }],
        "9xl": ["8rem", { lineHeight: "0.95", letterSpacing: "-0.026em" }],
      },

      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* Texto sobre material translucido — ver .vibrant no index.css */
        vibrant: {
          DEFAULT: "hsl(var(--vib-primary))",
          secondary: "hsl(var(--vib-secondary))",
          tertiary: "hsl(var(--vib-tertiary))",
        },
        success: {
          DEFAULT: "hsl(var(--system-success))",
          foreground: "hsl(var(--success-foreground))",
          light: "hsl(var(--success-light))",
        },
        cost: {
          DEFAULT: "hsl(var(--cost))",
          foreground: "hsl(var(--cost-foreground))",
          light: "hsl(var(--cost-light))",
        },
        warning: {
          DEFAULT: "hsl(var(--system-warning))",
          foreground: "hsl(var(--warning-foreground))",
          light: "hsl(var(--warning-light))",
        },
        system: {
          info: "hsl(var(--system-info))",
          purple: "hsl(var(--system-purple))",
          danger: "hsl(var(--system-danger))",
        }
      },

      /* Raio concentrico. O filho sempre menor que o pai pela medida do padding
         entre eles — senao o canto interno parece torto dentro do externo. */
      borderRadius: {
        sm: "var(--r-inner)",
        md: "var(--r-control)",
        lg: "var(--r-card)",
        xl: "var(--r-window)",
        "2xl": "22px",
      },

      /* Espessura de material. Superficie maior le como mais espessa. */
      backdropBlur: {
        chrome: "24px",
        float: "32px",
        sheet: "40px",
      },

      boxShadow: {
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
        "elev-4": "var(--elev-4)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        /* Materializar, nao so aparecer: superficie de vidro entra com o blur e
           a escala subindo JUNTOS, pra ler como material chegando — e nao como
           um retangulo que ganhou opacidade. */
        materialize: {
          from: { opacity: "0", transform: "scale(0.96)", backdropFilter: "blur(0px)" },
          to: { opacity: "1", transform: "scale(1)", backdropFilter: "blur(32px)" },
        },
        dematerialize: {
          from: { opacity: "1", transform: "scale(1)", backdropFilter: "blur(32px)" },
          to: { opacity: "0", transform: "scale(0.96)", backdropFilter: "blur(0px)" },
        },
      },

      /* Curvas espelhadas: a volta refaz o caminho da ida.
         Entrada desacelera (out), saida acelera (in) — pontos de controle
         invertidos um do outro. */
      transitionTimingFunction: {
        "material-in": "cubic-bezier(0.16, 1, 0.3, 1)",
        "material-out": "cubic-bezier(0.7, 0, 0.84, 0)",
      },

      animation: {
        "accordion-down": "accordion-down 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-up": "accordion-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
        materialize: "materialize 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        dematerialize: "dematerialize 0.2s cubic-bezier(0.7, 0, 0.84, 0)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
