// ═══════════════════════════════════════════════════════════════════════════
// policies.ts — Single Source of Truth for Permission Policies
// ═══════════════════════════════════════════════════════════════════════════
// This file defines the DEFAULT permissions per role.
// DB-stored overrides (permissions_config) take precedence at runtime.
// Structured for future migration to a database table.

export type Action = 'create' | 'read' | 'update' | 'delete';
export type Role = 'ADMIN' | 'CLIENTE' | 'FUNCIONARIO';
export type PermissionLevel = 'none' | 'view' | 'edit';

// ─── Utility: PermissionLevel ↔ Action[] conversion ──────────────────────

/**
 * Converts a PermissionLevel ('none'|'view'|'edit') to an Action[] array.
 * Used when converting DB-stored overrides to the unified engine format.
 */
export function levelToActions(level: PermissionLevel): Action[] {
    switch (level) {
        case 'edit': return ['create', 'read', 'update', 'delete'];
        case 'view': return ['read'];
        case 'none': return [];
    }
}

/**
 * Converts an Action[] array back to a PermissionLevel.
 * Used for backward compatibility with the permissions object exposed to UI.
 */
export function actionsToLevel(actions: Action[]): PermissionLevel {
    if (!actions || actions.length === 0) return 'none';
    if (actions.includes('update') || actions.includes('create') || actions.includes('delete')) return 'edit';
    if (actions.includes('read')) return 'view';
    return 'none';
}

// ─── Feature Keys (all features known to the UI) ─────────────────────────

export const FEATURE_KEYS = [
    'dashboard',
    'clients',
    'demands',
    'solicitacoes_forms',
    'solicitacoes_list',
    'products',
    'connections',
    'analytics',
    'reports',
    'settings_general',
    'team',
    'notifications',
    'governance',
    'financial',
    'tracking',
    'account_groups',
    'google_tools',
    'training',
    'crm',
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];

// ─── Shorthand Constants ──────────────────────────────────────────────────

const FULL_CRUD: Action[] = ['create', 'read', 'update', 'delete'];
const READ_ONLY: Action[] = ['read'];
const READ_UPDATE: Action[] = ['read', 'update'];
const CREATE_READ: Action[] = ['create', 'read'];

// ─── Default Policies per Role ────────────────────────────────────────────
// '*' = wildcard, grants all actions on all resources/features.
// If a feature/resource is NOT listed, it is DENIED by default.

export const policies: Record<Role, Record<string, Action[]>> = {
    // ── ADMIN: Full access to everything via wildcard ──
    ADMIN: {
        '*': FULL_CRUD,
    },

    // ── CLIENTE: Resource-level only; feature-level comes from DB overrides ──
    // Clients default to NO feature access. The DB permissions_config
    // controls which features each client can see/edit.
    CLIENTE: {
        // Resource-level (used by PermissionGuard / AbacRoute)
        solicitacoes: CREATE_READ,
        demandas: READ_ONLY,
        tarefas: READ_UPDATE,
        ferramentas: READ_ONLY,
    },

    // ── FUNCIONARIO: Broad access minus restricted features ──
    // Replicates the current behavior: FULL_ACCESS spread minus
    // solicitacoes_list, team, settings_general, financial, governance, account_groups
    FUNCIONARIO: {
        // Feature-level (used by ProtectedRoute / PermissionGate)
        dashboard: FULL_CRUD,
        clients: FULL_CRUD,
        demands: FULL_CRUD,
        solicitacoes_forms: FULL_CRUD,
        products: FULL_CRUD,
        connections: FULL_CRUD,
        analytics: FULL_CRUD,
        reports: FULL_CRUD,
        notifications: FULL_CRUD,
        tracking: FULL_CRUD,
        google_tools: FULL_CRUD,
        training: FULL_CRUD,
        crm: FULL_CRUD,
        // DENIED (not listed): solicitacoes_list, team, settings_general, financial, governance, account_groups

        // Resource-level (used by PermissionGuard / AbacRoute)
        visao_geral: READ_ONLY,
        quadro_geral: READ_ONLY,
        clientes: READ_UPDATE,
        solicitacoes: READ_UPDATE,
        produtos: READ_ONLY,
        dados_inteligentes: READ_ONLY,
        crm: FULL_CRUD,
    },
};
