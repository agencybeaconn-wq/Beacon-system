/**
 * Authority System Utilities
 * Calculates user tier/level based on lifetime_spend and provides tier metadata
 */

export type AuthorityTier = {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  minSpend: number;
  maxSpend: number | null; // null means infinity
};

export const AUTHORITY_TIERS: AuthorityTier[] = [
  {
    id: "rookie_scaler",
    name: "Rookie Scaler",
    displayName: "Rookie Scaler",
    icon: "Sprout",
    color: "text-green-500",
    minSpend: 0,
    maxSpend: 10000,
  },
  {
    id: "validated_buyer",
    name: "Validated Buyer",
    displayName: "Validated Buyer",
    icon: "CheckCircle",
    color: "text-blue-500",
    minSpend: 10000,
    maxSpend: 50000,
  },
  {
    id: "scale_specialist",
    name: "Scale Specialist",
    displayName: "Scale Specialist",
    icon: "TrendingUp",
    color: "text-purple-500",
    minSpend: 50000,
    maxSpend: 100000,
  },
  {
    id: "elite_operator",
    name: "Elite Operator",
    displayName: "Elite Operator",
    icon: "ShieldCheck",
    color: "text-indigo-500",
    minSpend: 100000,
    maxSpend: 250000,
  },
  {
    id: "account_master",
    name: "Account Master",
    displayName: "Account Master",
    icon: "Crown",
    color: "text-amber-500",
    minSpend: 250000,
    maxSpend: 500000,
  },
  {
    id: "legacy_director",
    name: "Legacy Director",
    displayName: "Legacy Director",
    icon: "Award",
    color: "text-slate-400",
    minSpend: 500000,
    maxSpend: 1000000,
  },
  {
    id: "market_architect",
    name: "Market Architect",
    displayName: "Market Architect",
    icon: "Landmark",
    color: "text-yellow-600",
    minSpend: 1000000,
    maxSpend: null,
  },
];

/**
 * Calculate user's current tier based on lifetime_spend
 */
export function calculateTier(lifetimeSpend: number): AuthorityTier {
  for (let i = AUTHORITY_TIERS.length - 1; i >= 0; i--) {
    const tier = AUTHORITY_TIERS[i];
    if (lifetimeSpend >= tier.minSpend) {
      return tier;
    }
  }
  return AUTHORITY_TIERS[0]; // Fallback to Operator
}

/**
 * Calculate progress to next tier (0-1)
 */
export function calculateProgressToNextTier(
  lifetimeSpend: number,
  currentTier: AuthorityTier
): number {
  const nextTierIndex = AUTHORITY_TIERS.findIndex((t) => t.id === currentTier.id) + 1;

  if (nextTierIndex >= AUTHORITY_TIERS.length) {
    return 1; // Already at max tier
  }

  const nextTier = AUTHORITY_TIERS[nextTierIndex];
  const range = nextTier.minSpend - currentTier.minSpend;
  const progress = lifetimeSpend - currentTier.minSpend;

  return Math.min(Math.max(progress / range, 0), 1);
}

/**
 * Get next tier or null if at max
 */
export function getNextTier(currentTier: AuthorityTier): AuthorityTier | null {
  const currentIndex = AUTHORITY_TIERS.findIndex((t) => t.id === currentTier.id);
  if (currentIndex >= AUTHORITY_TIERS.length - 1) {
    return null;
  }
  return AUTHORITY_TIERS[currentIndex + 1];
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format number for display (abbreviated)
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}

