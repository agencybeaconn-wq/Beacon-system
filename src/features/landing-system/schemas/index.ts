/**
 * Lever Landing System — Tipos compartilhados entre blocks.
 * Blocks com props específicas declaram interface ao lado do componente.
 */

import type { ReactNode } from "react";

export interface CTAItem {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "ghost" | "link";
  external?: boolean;
  /** Event name pra analytics. Default: `landing_cta_click`. */
  trackEvent?: string;
}

export interface MediaItem {
  type: "image" | "video";
  src: string;
  /** OBRIGATÓRIO em image — QA bloqueia LP sem alt. */
  alt: string;
  width?: number;
  height?: number;
}

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface LandingMeta {
  /** Slug da LP — usado em analytics e como key. */
  slug: string;
  /** Title pra <title> e og:title. */
  title: string;
  /** Description pra meta + og:description. Max ~155 chars. */
  description: string;
  /** Path absoluto a partir da raiz, ex: /carreiras. */
  path: string;
}

/** Wrapper genérico de seção pra blocks adicionarem header/eyebrow. */
export interface SectionShellProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}
