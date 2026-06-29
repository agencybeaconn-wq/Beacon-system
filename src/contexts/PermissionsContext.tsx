import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from './DashboardContext';
import { useAuth } from './AuthContext';
import { type Role, type PermissionLevel, FEATURE_KEYS, policies, actionsToLevel } from '@/permissions/policies';
import { canViewFeature, canEditFeature, type PermissionOverrides, type PermissionUser } from '@/permissions/can';

// ─── Types (backward-compatible) ──────────────────────────────────────────

export type { PermissionLevel } from '@/permissions/policies';

export interface PermissionsConfig {
    dashboard: PermissionLevel;
    clients: PermissionLevel;
    demands: PermissionLevel;
    solicitacoes_forms: PermissionLevel;
    solicitacoes_list: PermissionLevel;
    products: PermissionLevel;
    connections: PermissionLevel;
    analytics: PermissionLevel;
    reports: PermissionLevel;
    settings_general: PermissionLevel;
    team: PermissionLevel;
    notifications: PermissionLevel;
    governance: PermissionLevel;
    financial: PermissionLevel;
    tracking: PermissionLevel;
    account_groups: PermissionLevel;
    crm: PermissionLevel;
    [key: string]: PermissionLevel;
}

interface PermissionsContextValue {
    permissions: PermissionsConfig | null;
    isLoading: boolean;
    isLoadingPermissions: boolean;
    isAdmin: boolean;
    isClient: boolean;
    isPendingIdentity: boolean;
    linkedClientId: string | null;
    linkedClientName: string | null;
    abacRole: Role | null;
    canView: (feature: keyof PermissionsConfig | string) => boolean;
    canEdit: (feature: keyof PermissionsConfig | string) => boolean;
    getDataFilter: () => { client_id?: string } | null;
    refreshPermissions: () => void;
}

// ─── Utility: Build PermissionsConfig from role + overrides ───────────────
// Generates the backward-compatible permissions object from the unified engine.

function buildPermissionsConfig(role: Role, overrides?: PermissionOverrides): PermissionsConfig {
    const config = {} as PermissionsConfig;
    const policy = policies[role];
    const hasWildcard = '*' in policy;

    for (const feature of FEATURE_KEYS) {
        // DB overrides take precedence
        if (overrides && feature in overrides) {
            config[feature] = overrides[feature] as PermissionLevel;
        } else if (hasWildcard) {
            config[feature] = 'edit';
        } else {
            config[feature] = actionsToLevel(policy[feature] || []);
        }
    }
    return config;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const [permissions, setPermissions] = useState<PermissionsConfig | null>(null);
    const [dbOverrides, setDbOverrides] = useState<PermissionOverrides | undefined>(undefined);
    const [internalLoading, setInternalLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [isPendingIdentity, setIsPendingIdentity] = useState(false);
    const [linkedClientId, setLinkedClientId] = useState<string | null>(null);
    const [linkedClientName, setLinkedClientName] = useState<string | null>(null);
    const [abacRole, setAbacRole] = useState<Role | null>(null);

    const { workspaceId, selectedClientId, selectedClientName, setWorkspaceId, isLoading: dashboardIsLoading } = useDashboard();
    const { user, isLoading: authIsLoading } = useAuth();

    // Derived loading state: wait for auth, dashboard (workspaceId), and internal fetch
    const isLoading = authIsLoading || dashboardIsLoading || internalLoading;

    const loadPermissions = async () => {
        if (!user?.email) {
            setInternalLoading(false);
            return;
        }

        console.log('[Permissions] Starting load. Workspace:', workspaceId || 'NONE');
        setInternalLoading(true);
        let skipFinally = false;

        try {
            // Se workspaceId for null, aguarda pois o DashboardContext agora gerencia isso
            if (!workspaceId) {
                console.warn('[Permissions] Dashboard loaded mas não tem workspace. Identidade pendente.');
                setIsPendingIdentity(true);
                setInternalLoading(false);
                return;
            }

            // We found a workspace (from context), clear pending flag
            setIsPendingIdentity(false);

            // 1. Fetch Workspace ownership AND member data IN PARALLEL (performance boost)
            const [wsResult, memberResult] = await Promise.all([
                supabase
                    .from('workspaces')
                    .select('owner_id')
                    .eq('id', workspaceId)
                    .maybeSingle(),
                (supabase as any)
                    .from('team_members')
                    .select(`
                        id,
                        role,
                        status,
                        linked_client_id,
                        user_type,
                        member_access_levels (
                            agency_access_levels (
                                permissions_config
                            )
                        )
                    `)
                    .ilike('email', user.email)
                    .eq('workspace_id', workspaceId)
                    .maybeSingle()
            ]);

            const activeWorkspace = wsResult.data;
            if (wsResult.error) console.error('[Permissions] Workspace fetch error:', wsResult.error);

            const isOwner = activeWorkspace?.owner_id === user.id;

            // ⚡ FAST PATH: If user is OWNER, grant full access immediately
            if (isOwner) {
                console.log('[Permissions] FAST PATH: User is owner. Granting instant admin.');
                const ownerRole: Role = 'ADMIN';
                setAbacRole(ownerRole);
                setPermissions(buildPermissionsConfig(ownerRole));
                setDbOverrides(undefined);
                setIsAdmin(true);
                setIsClient(false);
                setLinkedClientId(selectedClientId || null);
                setLinkedClientName(selectedClientName || null);
                return; // Skip ALL member lookups and bridge rescue
            }

            let { data: memberData, error: memberError } = memberResult;
            console.log('[Permissions] Direct member fetch result:', memberData ? 'FOUND' : 'NOT FOUND');

            if (memberError) {
                console.error('[Permissions] Error fetching member data:', memberError);
            }

            // --- RESCUE: If no member data, try a global direct lookup ---
            if (!memberData && user?.email) {
                console.warn('[Permissions] Identity incomplete. Attempting direct rescue for:', user.email);

                const { data: memberLookup } = await (supabase as any)
                    .from('team_members')
                    .select('workspace_id, linked_client_id, user_type, role')
                    .ilike('email', user.email)
                    .limit(1)
                    .maybeSingle();

                if (memberLookup?.workspace_id) {
                    console.log('[Permissions] Direct Lookup SUCCESS! Workspace found:', memberLookup.workspace_id);

                    if (memberLookup.workspace_id !== workspaceId) {
                        console.log('[Permissions] Syncing workspace to Direct Lookup result:', memberLookup.workspace_id);
                        setWorkspaceId(memberLookup.workspace_id);
                        skipFinally = true;
                        return;
                    }

                    // EMERGENCY RESCUE: same workspace but relation fetch failed
                    memberData = {
                        id: 'direct-rescue-' + (memberLookup.linked_client_id || 'admin'),
                        role: memberLookup.role || 'operator',
                        user_type: memberLookup.user_type || 'agency',
                        status: memberLookup.linked_client_id ? 'invited' : 'active',
                        linked_client_id: memberLookup.linked_client_id,
                        workspace_id: memberLookup.workspace_id
                    } as any;
                }
            }

            // ────────────────────────────────────────────────────────────
            // NOTE: Master email fallback REMOVED (Phase 1 security fix).
            // The email leverecomm@gmail.com is now treated as a regular
            // user and must be in team_members to gain admin access.
            // ────────────────────────────────────────────────────────────

            // 3. Determine Final State
            let finalIsAdmin = isOwner;
            let finalIsClient = false;
            let finalLinkedClientId: string | null = null;
            let finalLinkedClientName: string | null = null;
            let finalRole: Role | null = null;
            let finalOverrides: PermissionOverrides | undefined = undefined;

            if (memberData) {
                // STRUCTURAL FIX: Always sync user_id to auth.uid()
                // This guarantees RLS policies can match the user.
                // Previously only ran on activation, leaving stale user_ids.
                const needsUserIdSync = memberData.user_id !== user.id;
                const needsActivation = memberData.status !== 'active';

                if (needsUserIdSync || needsActivation) {
                    const updatePayload: any = { user_id: user.id };
                    if (needsActivation) {
                        updatePayload.status = 'active';
                        updatePayload.joined_at = new Date().toISOString();
                    }
                    console.log('[Permissions] Syncing team_members:', needsUserIdSync ? 'user_id' : '', needsActivation ? 'status' : '');
                    supabase.from('team_members')
                        .update(updatePayload)
                        .eq('id', memberData.id)
                        .then();
                }

                const accessLevel = memberData.member_access_levels?.[0]?.agency_access_levels;

                // --- REDUNDANT IDENTIFICATION ---
                // Priority 1: Direct link (the most reliable)
                // Priority 2: user_type tag
                // Priority 3: permission config role_type
                // Priority 4: role tag
                let roleType = memberData.user_type || (accessLevel?.permissions_config as any)?.role_type || memberData.role || '';

                if (memberData.linked_client_id) {
                    roleType = 'client';
                }

                roleType = String(roleType).toLowerCase();
                const isClientRole = roleType === 'client';
                const directLinkedClientId = memberData.linked_client_id;

                if (isClientRole || accessLevel?.permissions_config) {
                    const config = (accessLevel?.permissions_config as any) || {};

                    if (isClientRole) {
                        if (isOwner) {
                            finalIsAdmin = true;
                            finalIsClient = false;
                            finalRole = 'ADMIN';
                        } else {
                            finalIsClient = true;
                            finalIsAdmin = false;
                            finalRole = 'CLIENTE';
                            finalLinkedClientId = directLinkedClientId || config.linked_client_id || null;

                            console.log('[Permissions] Detected Client. ID:', finalLinkedClientId);

                            // --- CACHE CLEANUP ---
                            if (typeof window !== 'undefined') {
                                const storedType = localStorage.getItem('lads_account_type');
                                if (storedType === 'agency' || storedType === 'owner') {
                                    localStorage.removeItem('lads_account_type');
                                    localStorage.removeItem('lastWorkspaceId');
                                }
                            }

                            // Client overrides: start with all 'none', then apply DB config
                            finalOverrides = {
                                dashboard: 'none',
                                clients: 'none',
                                solicitacoes_list: 'none',
                                products: 'none',
                                connections: 'none',
                                analytics: 'none',
                                reports: 'none',
                                settings_general: 'none',
                                team: 'none',
                                governance: 'none',
                                financial: 'none',
                                crm: 'none',
                                ...config,
                            };

                            if (finalLinkedClientId) {
                                // Optimized: Use name from bridge if available
                                if ((memberData as any).cached_client_name) {
                                    finalLinkedClientName = (memberData as any).cached_client_name;
                                    console.log('[Permissions] Using cached name from bridge:', finalLinkedClientName);
                                } else {
                                    const { data: clientData } = await (supabase as any)
                                        .from('agency_clients')
                                        .select('name')
                                        .eq('id', finalLinkedClientId)
                                        .maybeSingle();

                                    if (clientData?.name) {
                                        finalLinkedClientName = clientData.name;
                                    }
                                }
                            }
                        }
                    } else {
                        // Non-client with custom permissions_config
                        if (isOwner) {
                            finalRole = 'ADMIN';
                            finalIsAdmin = true;
                        } else {
                            finalIsAdmin = memberData.role === 'admin';
                            finalRole = finalIsAdmin ? 'ADMIN' : 'FUNCIONARIO';
                            // DB overrides for non-client user
                            if (Object.keys(config).length > 0) {
                                finalOverrides = config;
                            }
                        }
                        finalIsClient = false;
                    }
                } else if (!isOwner) {
                    finalIsAdmin = memberData.role === 'admin';
                    finalRole = finalIsAdmin ? 'ADMIN' : 'FUNCIONARIO';
                }
            }

            // Resolve final role
            if (!finalRole) {
                if (finalIsAdmin) {
                    finalRole = 'ADMIN';
                } else if (finalIsClient) {
                    finalRole = 'CLIENTE';
                } else if (memberData) {
                    finalRole = 'FUNCIONARIO';
                }
            }

            // Build permissions config from unified engine
            const finalPermissions = finalRole
                ? buildPermissionsConfig(finalRole, finalOverrides)
                : null;

            setPermissions(finalPermissions);
            setDbOverrides(finalOverrides);
            setIsAdmin(finalIsAdmin);
            setIsClient(finalIsClient);
            setAbacRole(finalRole);

            console.log('[Permissions] Final State:', {
                role: finalRole,
                isAdmin: finalIsAdmin,
                isClient: finalIsClient,
                linkedClientId: finalLinkedClientId,
                dashboardClientId: selectedClientId,
                hasDbOverrides: !!finalOverrides,
            });

            // SYNC: For admins, use Dashboard's selected client if no direct link exists
            if (finalIsAdmin && !finalLinkedClientId && selectedClientId) {
                console.log('[Permissions] Admin Impersonation Active for:', selectedClientId);
                setLinkedClientId(selectedClientId);
                setLinkedClientName(selectedClientName);
            } else {
                setLinkedClientId(finalLinkedClientId);
                setLinkedClientName(finalLinkedClientName);
            }
        } catch (error: any) {
            console.error('[Permissions] CRITICAL ERROR:', error);
        } finally {
            if (!(skipFinally as any)) {
                setInternalLoading(false);
            }
        }
    };

    useEffect(() => {
        // Trigger whenever auth, workspace OR selected client changes
        if (!authIsLoading && !dashboardIsLoading) {
            loadPermissions();
        }
    }, [workspaceId, user?.email, authIsLoading, dashboardIsLoading, selectedClientId]);

    // ─── Unified canView / canEdit — delegates to can.ts engine ───────────

    // Build the PermissionUser from resolved state
    const currentUser: PermissionUser | null = abacRole
        ? { role: abacRole, clienteId: linkedClientId || undefined }
        : null;

    const canView = (feature: keyof PermissionsConfig | string): boolean => {
        if (isAdmin) return true;
        return canViewFeature(currentUser, feature as string, dbOverrides);
    };

    const canEdit = (feature: keyof PermissionsConfig | string): boolean => {
        if (isAdmin) return true;
        return canEditFeature(currentUser, feature as string, dbOverrides);
    };

    const getDataFilter = React.useCallback((): { client_id?: string } | null => {
        // Admins see everything
        if (isAdmin) return null;

        // Clients see only their data
        if (isClient && linkedClientId) return { client_id: linkedClientId };

        // During loading, don't filter (let data load)
        if (isLoading) return null;

        // FUNCIONARIO: return null (no client filter)
        // The employee-specific filtering (assignee_id) is handled by TasksContext L255
        // Previously returned a zeroed UUID which blocked ALL task queries for employees
        if (abacRole === 'FUNCIONARIO') return null;

        // True fallback: unknown role after loading complete
        // This should rarely happen - log for debugging
        if (abacRole) return null; // Has a role, just not one we explicitly handled

        console.warn('[Permissions] getDataFilter: No role detected after loading. Restricting access.');
        return { client_id: '00000000-0000-0000-0000-000000000000' };
    }, [isAdmin, isClient, linkedClientId, isLoading, abacRole]);

    return (
        <PermissionsContext.Provider
            value={{
                permissions,
                isLoading,
                isLoadingPermissions: isLoading,
                isAdmin,
                isClient,
                isPendingIdentity,
                linkedClientId,
                linkedClientName,
                abacRole,
                canView,
                canEdit,
                getDataFilter,
                refreshPermissions: loadPermissions,
            }}
        >
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissions() {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
}
