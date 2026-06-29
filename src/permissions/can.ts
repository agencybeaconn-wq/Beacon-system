// ═══════════════════════════════════════════════════════════════════════════
// can.ts — Unified Permission Checker
// ═══════════════════════════════════════════════════════════════════════════
// Single entry point for ALL permission checks in the frontend.
// Supports: static policies, DB overrides, ABAC context, wildcard roles.

import { policies, type Action, type Role, type PermissionLevel, levelToActions } from './policies';

// ─── Types ────────────────────────────────────────────────────────────────

export type ABACContext = {
    ownerId?: string;
};

export type PermissionUser = {
    role: Role;
    clienteId?: string;
    [key: string]: any;
};

/** DB-stored overrides in PermissionLevel format (from permissions_config) */
export type PermissionOverrides = Record<string, PermissionLevel>;

// Re-export for backward compatibility (PermissionGuard.tsx imports `User`)
export type User = PermissionUser;

// ─── ABAC Context Check (internal) ───────────────────────────────────────

function checkABAC(user: PermissionUser, context?: ABACContext): boolean {
    if (context?.ownerId && user.clienteId) {
        return context.ownerId === user.clienteId;
    }
    return true;
}

// ─── Main Permission Checker ──────────────────────────────────────────────

/**
 * Unified permission checker.
 *
 * Priority order:
 *   1. DB overrides (permissions_config) — most specific
 *   2. Static policies from policies.ts — role defaults
 *   3. ABAC context — ownership filter (applied on top of 1 or 2)
 *
 * @param user       The permission user (role + optional clienteId)
 * @param action     The CRUD action to check
 * @param resource   The feature/resource name to check
 * @param context    Optional ABAC context (ownership check)
 * @param overrides  Optional DB-stored permission overrides
 */
export function can(
    user: PermissionUser | null | undefined,
    action: Action,
    resource: string,
    context?: ABACContext,
    overrides?: PermissionOverrides,
): boolean {
    if (!user || !user.role) return false;

    const role = user.role;

    // 1. Check DB overrides first (most specific)
    if (overrides && resource in overrides) {
        const allowedActions = levelToActions(overrides[resource] as PermissionLevel);
        if (!allowedActions.includes(action)) return false;
        return checkABAC(user, context);
    }

    // 2. Check static policies
    const policy = policies[role];
    if (!policy) return false;

    // Wildcard: role has access to everything (ADMIN)
    if ('*' in policy) {
        return checkABAC(user, context);
    }

    const allowed = policy[resource];
    if (!allowed || !allowed.includes(action)) return false;

    return checkABAC(user, context);
}

// ─── Feature-level Convenience Helpers ────────────────────────────────────
// These map the UI concepts (view/edit) to CRUD actions.
// Used by PermissionsContext to delegate canView/canEdit.

/**
 * Checks if a user can VIEW a feature (maps to 'read' action).
 */
export function canViewFeature(
    user: PermissionUser | null | undefined,
    feature: string,
    overrides?: PermissionOverrides,
): boolean {
    return can(user, 'read', feature, undefined, overrides);
}

/**
 * Checks if a user can EDIT a feature (maps to 'update' action).
 */
export function canEditFeature(
    user: PermissionUser | null | undefined,
    feature: string,
    overrides?: PermissionOverrides,
): boolean {
    return can(user, 'update', feature, undefined, overrides);
}
