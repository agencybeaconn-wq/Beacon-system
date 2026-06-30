import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type ViewMode = 'client' | 'account' | 'all';

// =============================================================================
// DATE FILTER TYPES (Global date filtering for all pages)
// =============================================================================
export type DateFilterPreset = 'today' | '7d' | 'month' | 'custom';

export interface DateRange {
    from: Date;
    to?: Date;
}

// =============================================================================
// CLIENT DATA INTERFACE (Merged from SelectedClientContext)
// =============================================================================
interface ClientData {
    id: string;
    name: string;
    fee_fixed: number | null;
    commission_rate: number | null;
    calculation_base: string | null;
    created_at: string;
    assigned_products: string[] | null;
    logo_url: string | null;
    selected_ad_accounts?: string[];
    cartpanda_status?: string;
    cartpanda_store_slug?: string;
    payment_due_day?: number;
    workspace_id?: string;
    delivered_at?: string | null;
    // UI-generated fields
    primaryColor?: string;
}

// =============================================================================
// UNIFIED DASHBOARD CONTEXT TYPE
// =============================================================================
interface DashboardContextType {
    // =========================================================================
    // SELECTION STATE
    // =========================================================================
    selectedClientId: string | null;
    selectedAccountId: string | null;
    selectedProfileId: string | null;
    viewMode: ViewMode;

    // =========================================================================
    // GLOBAL DATE FILTER (Used by all pages)
    // =========================================================================
    dateFilter: DateFilterPreset;
    dateRange: DateRange | undefined;
    setDateFilter: (filter: DateFilterPreset) => void;
    setDateRange: (range: DateRange | undefined) => void;
    getDateRangeForAPI: () => { startDate: string; endDate: string };
    dateFilterLabel: string;

    // =========================================================================
    // CLIENT DATA (Merged from SelectedClientContext)
    // =========================================================================
    clients: ClientData[];
    clientData: ClientData | null;  // Data of the currently selected client
    selectedClientName: string | null;
    isLoadingClients: boolean;
    refreshClients: () => Promise<void>;

    // =========================================================================
    // ACTIONS
    // =========================================================================
    selectClient: (clientId: string) => void;
    selectAccount: (accountId: string) => void;
    setSelectedClient: (clientId: string | null) => void; // Alias for compatibility
    setSelectedProfileId: (profileId: string | null) => void;
    resetSelection: () => void;

    // =========================================================================
    // FACEBOOK PROFILES
    // =========================================================================
    profiles: any[];
    isLoading: boolean;
    refreshProfiles: () => Promise<void>;

    // =========================================================================
    // UI STATE
    // =========================================================================
    isAccountWizardOpen: boolean;
    setIsAccountWizardOpen: (open: boolean) => void;
    profilePhotoMap: Record<string, string>;
    cacheProfilePhoto: (userId: string, photoUrl: string) => void;
    workspaceId: string | null;
    workspaces: any[];
    setWorkspaceId: (id: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Generate a color based on client name
const generateColor = (name: string): string => {
    const colors = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#FF6B6B', '#4ECDC4', '#45B7D1'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export function DashboardProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    // =========================================================================
    // 1. ALL STATES
    // =========================================================================
    const [selectedClientId, setSelectedClientId] = useState<string | null>(
        () => localStorage.getItem('dashboard_selectedClientId') || localStorage.getItem('lever_selected_client_id')
    );
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
        () => localStorage.getItem('dashboard_selectedAccountId')
    );
    const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(
        () => (localStorage.getItem('dashboard_viewMode') as ViewMode) || 'all'
    );

    const [dateFilter, setDateFilterState] = useState<DateFilterPreset>(() => {
        const saved = localStorage.getItem('dashboard_dateFilter');
        return (saved as DateFilterPreset) || '7d';
    });
    const [dateRange, setDateRangeState] = useState<DateRange | undefined>(undefined);

    const [clients, setClients] = useState<ClientData[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [isAccountWizardOpen, setIsAccountWizardOpen] = useState(false);
    const [profilePhotoMap, setProfilePhotoMap] = useState<Record<string, string>>({});

    // =========================================================================
    // 2. BASIC CALLBACKS (Setters)
    // =========================================================================
    const setDateFilter = useCallback((filter: DateFilterPreset) => {
        setDateFilterState(filter);
        localStorage.setItem('dashboard_dateFilter', filter);
    }, []);

    const setDateRange = useCallback((range: DateRange | undefined) => {
        setDateRangeState(range);
    }, []);

    const cacheProfilePhoto = useCallback((userId: string, photoUrl: string) => {
        setProfilePhotoMap(prev => ({ ...prev, [userId]: photoUrl }));
    }, []);

    const setSelectedProfileId = useCallback((profileId: string | null) => {
        setSelectedProfileIdState(profileId);
        if (profileId) {
            localStorage.setItem('dashboard_selectedProfileId', profileId);
        } else {
            localStorage.removeItem('dashboard_selectedProfileId');
        }
    }, []);

    const resetSelection = useCallback(() => {
        setSelectedClientId(null);
        setSelectedAccountId(null);
        setViewMode('all');
        localStorage.removeItem('dashboard_selectedClientId');
        localStorage.removeItem('lever_selected_client_id');
        localStorage.removeItem('dashboard_selectedClientName');
        localStorage.removeItem('dashboard_selectedAccountId');
        localStorage.setItem('dashboard_viewMode', 'all');
    }, []);

    // =========================================================================
    // 3. DATA FETCHING ACTIONS
    // =========================================================================
    const refreshClients = useCallback(async () => {
        setIsLoadingClients(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            // 1. Get user type and linked client from team_members
            const { data: memberData } = await (supabase as any)
                .from('team_members')
                .select('user_type, role, linked_client_id')
                .eq('user_id', user.id)
                .maybeSingle();

            const isClientUser = memberData?.user_type === 'client' || memberData?.role === 'client';
            const linkedClientId = memberData?.linked_client_id;

            console.log('[DashboardContext] User identity:', { isClientUser, linkedClientId });

            // 2. Fetch accessible clients
            const selectFields = `
                id, name, fee_fixed, commission_rate, calculation_base, created_at,
                assigned_products, logo_url, client_type, is_archived, is_internal, is_ecommerce, selected_ad_accounts,
                cartpanda_status, cartpanda_store_slug, cartpanda_store_name, cartpanda_connected_at,
                shopify_domain, shopify_status, shopify_shop_name, shopify_connected_at, shopify_client_id, shopify_client_secret,
                profit_gateway_percent, profit_tax_percent, profit_fixed_costs,
                payment_due_day, workspace_id, project_deadline, project_name,
                whatsapp_group_jid, whatsapp_group_name
            `;

            let query = (supabase as any).from('agency_clients').select(selectFields).eq('is_archived', false);

            if (isClientUser && linkedClientId) {
                query = query.eq('id', linkedClientId);
            }

            let { data, error } = await query.order('name', { ascending: true });

            if (error) {
                console.warn('[DashboardContext] Full client query failed, using minimal fallback:', error.message);
                const minimalFields = `
                    id, name, created_at, is_archived, workspace_id
                `;
                let fallbackQuery = (supabase as any).from('agency_clients').select(minimalFields).eq('is_archived', false);
                if (isClientUser && linkedClientId) fallbackQuery = fallbackQuery.eq('id', linkedClientId);
                const result = await fallbackQuery.order('name');
                data = result.data;
                error = result.error;
            }

            if (error) throw error;

            // Auto-provision "Beacon" internal client if it doesn't exist
            let allClients = data || [];
            const hasLever = allClients.some((c: any) => c.name === 'Beacon');
            if (!hasLever && !isClientUser) {
                try {
                    // Get workspace_id from existing clients or query directly
                    let wsId = allClients[0]?.workspace_id;
                    if (!wsId) {
                        const { data: ws } = await (supabase as any)
                            .from('workspaces').select('id').eq('owner_id', user.id).maybeSingle();
                        wsId = ws?.id;
                        if (!wsId) {
                            const { data: member } = await (supabase as any)
                                .from('team_members').select('workspace_id').eq('user_id', user.id).maybeSingle();
                            wsId = member?.workspace_id;
                        }
                    }
                    console.log('[DashboardContext] Creating Lever client with wsId:', wsId);
                    if (wsId) {
                        const { data: newLever, error: leverErr } = await (supabase as any)
                            .from('agency_clients')
                            .insert({ name: 'Beacon', is_archived: false, workspace_id: wsId })
                            .select('*')
                            .single();
                        if (leverErr) {
                            console.error('[DashboardContext] Lever insert error:', JSON.stringify(leverErr));
                        } else if (newLever) {
                            allClients = [...allClients, newLever];
                            console.log('[DashboardContext] Created Lever client:', newLever.id);
                        }
                    } else {
                        console.error('[DashboardContext] No workspace_id found for Lever creation');
                    }
                } catch (e) {
                    console.error('[DashboardContext] Failed to create Lever client:', e);
                }
            }

            const clientsWithColors = allClients.map((c: ClientData) => ({
                ...c,
                primaryColor: generateColor(c.name)
            }));

            setClients(clientsWithColors);

            // 3. AUTO-SELECT
            if (isClientUser && linkedClientId) {
                setSelectedClientId(linkedClientId);
                localStorage.setItem('dashboard_selectedClientId', linkedClientId);
                localStorage.setItem('dashboard_viewMode', 'client');
                setViewMode('client');
            } else if (clientsWithColors.length === 1 && !selectedClientId) {
                const singleClient = clientsWithColors[0];
                setSelectedClientId(singleClient.id);
                localStorage.setItem('dashboard_selectedClientId', singleClient.id);
                localStorage.setItem('dashboard_viewMode', 'client');
                setViewMode('client');
            }
        } catch (error) {
            console.error('[DashboardContext] Error fetching clients:', error);
        } finally {
            setIsLoadingClients(false);
        }
    }, []); // Removed selectedClientId to break infinite loop

    const refreshProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const supabaseAny = supabase as any;

            // Run workspace queries in PARALLEL for faster loading
            const [ownedWSResult, joinedWSResult] = await Promise.all([
                // 1. Get ALL workspaces where user is OWNER
                supabaseAny
                    .from('workspaces')
                    .select('id, name')
                    .eq('owner_id', user.id),
                // 2. Get ALL workspaces where user is MEMBER
                supabaseAny
                    .from('team_members')
                    .select('workspace_id, workspaces(name)')
                    .ilike('email', user.email)
                    .in('status', ['active', 'invited'])
            ]);

            const ownedWS = ownedWSResult.data;
            const joinedWS = joinedWSResult.data;

            const allWorkspaces = [
                ...(ownedWS || []).map(ws => ({ id: ws.id, name: ws.name, role: 'owner' })),
                ...(joinedWS || []).map(m => ({
                    id: m.workspace_id,
                    name: m.workspaces?.name || 'Workspace Convidado',
                    role: 'member'
                }))
            ];

            console.log('[DashboardContext] All discovered workspaces:', allWorkspaces);
            setWorkspaces(allWorkspaces);

            // 3. Determine active workspaceId
            let activeWsId = workspaceId;

            // ALWAYS validate current workspaceId against fresh accessible list
            const isCurrentValid = activeWsId && allWorkspaces.some(w => w.id === activeWsId);

            if (!isCurrentValid) {
                console.log('[DashboardContext] Current workspace invalid or missing from accessible list. Re-validating...');
                const savedWsId = localStorage.getItem('lads_active_workspace_id');

                // Validate: saved workspace must be in user's accessible list
                if (savedWsId && allWorkspaces.some(w => w.id === savedWsId)) {
                    activeWsId = savedWsId;
                } else {
                    // Clear invalid cache
                    if (savedWsId) {
                        console.log('[DashboardContext] Cached workspace not found. Clearing...');
                        localStorage.removeItem('lads_active_workspace_id');
                    }

                    // Priority: First JOINED, then First OWNED
                    const joinedWSList = allWorkspaces.filter(w => w.role === 'member');
                    const ownedWSList = allWorkspaces.filter(w => w.role === 'owner');

                    if (joinedWSList.length > 0) {
                        activeWsId = joinedWSList[0].id;
                    } else if (ownedWSList.length > 0) {
                        activeWsId = ownedWSList[0].id;
                    } else {
                        activeWsId = null;
                    }
                }
            }

            if (!activeWsId) {
                console.warn('[DashboardContext] No active workspace could be determined!');

                // FALLBACK: Attempt to auto-resolve identity for new clients (e.g. magic link login)
                try {
                    console.log('[DashboardContext] Attempting RPC rescue for identity...');
                    const rpcPromise = supabaseAny.rpc('resolve_client_identity', { user_email: user.email });
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 5000));

                    const { data: identity, error: bridgeError } = await Promise.race([rpcPromise, timeoutPromise]) as any;

                    if (!bridgeError && identity && (identity as any[]).length > 0) {
                        const iden = (identity as any[])[0];
                        if (iden.p_workspace_id) {
                            console.log('[DashboardContext] RPC rescue found workspace:', iden.p_workspace_id);
                            activeWsId = iden.p_workspace_id;

                            // Mantenha caches sincronizados
                            allWorkspaces.push({
                                id: activeWsId,
                                name: iden.p_client_name || 'Workspace Resgatado',
                                role: 'member'
                            });
                            setWorkspaces(allWorkspaces);
                        }
                    }
                } catch (err) {
                    console.warn('[DashboardContext] RPC rescue failed or timed out:', err);
                }

                if (!activeWsId) {
                    console.warn('[DashboardContext] FAILED to determine workspace even after rescue.');
                    return;
                }
            }

            console.log('[DashboardContext] Setting active workspaceId:', activeWsId);
            setWorkspaceIdState(activeWsId);

            const { data: connections } = await supabaseAny
                .from('fb_connections')
                .select('id, workspace_id, profile_name, fb_user_id, is_patriarch')
                .eq('workspace_id', activeWsId);

            const loadedProfiles = connections || [];
            setProfiles(loadedProfiles);

            const savedProfileId = localStorage.getItem('dashboard_selectedProfileId');
            if (savedProfileId && loadedProfiles.find((p: any) => p.id === savedProfileId)) {
                setSelectedProfileIdState(savedProfileId);
            } else if (loadedProfiles.length > 0) {
                const defaultProfile = loadedProfiles[0];
                setSelectedProfileId(defaultProfile.id);
            }
        } catch (error) {
            console.error('[DashboardContext] Error refreshing profiles:', error);
        }
    }, [workspaceId, setSelectedProfileId]);

    const setWorkspaceId = useCallback((id: string) => {
        setWorkspaceIdState(id);
        localStorage.setItem('lads_active_workspace_id', id);
        // We will let the useEffect handle refreshing profiles when workspaceId changes if needed,
        // or just call it here.
        setTimeout(() => refreshProfiles(), 0);
    }, [refreshProfiles]);

    // =========================================================================
    // 4. SELECTION ACTIONS
    // =========================================================================
    const selectClient = useCallback((clientId: string) => {
        setSelectedClientId(clientId);
        setSelectedAccountId(null);
        setViewMode('client');
        localStorage.setItem('dashboard_selectedClientId', clientId);
        localStorage.setItem('lever_selected_client_id', clientId);
        localStorage.removeItem('dashboard_selectedAccountId');
        localStorage.setItem('dashboard_viewMode', 'client');
        // Save client name for instant display on page reload
        const client = clients.find(c => c.id === clientId);
        if (client) localStorage.setItem('dashboard_selectedClientName', client.name);
    }, [clients]);

    const setSelectedClient = useCallback((clientId: string | null) => {
        if (clientId) selectClient(clientId);
        else resetSelection();
    }, [selectClient, resetSelection]);

    const selectAccount = useCallback((accountId: string) => {
        setSelectedAccountId(accountId);
        setSelectedClientId(null);
        setViewMode('account');
        localStorage.setItem('dashboard_selectedAccountId', accountId);
        localStorage.removeItem('dashboard_selectedClientId');
        localStorage.removeItem('lever_selected_client_id');
        localStorage.setItem('dashboard_viewMode', 'account');
    }, []);

    // =========================================================================
    // 5. MEMOIZED VALUES
    // =========================================================================
    const getDateRangeForAPI = useCallback(() => {
        const today = new Date();
        const formatDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day} 00:00:00`;
        };
        const formatDateEnd = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day} 23:59:59`;
        };

        if (dateFilter === 'today') return { startDate: formatDate(today), endDate: formatDateEnd(today) };
        if (dateFilter === '7d') {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return { startDate: formatDate(sevenDaysAgo), endDate: formatDateEnd(today) };
        }
        if (dateFilter === 'month') {
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            return { startDate: formatDate(firstDayOfMonth), endDate: formatDateEnd(today) };
        }
        if (dateFilter === 'custom' && dateRange?.from && dateRange?.to) {
            return { startDate: formatDate(dateRange.from), endDate: formatDateEnd(dateRange.to) };
        }
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return { startDate: formatDate(sevenDaysAgo), endDate: formatDateEnd(today) };
    }, [dateFilter, dateRange]);

    const dateFilterLabel = useMemo(() => {
        const today = new Date();
        const formatShortDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        if (dateFilter === 'today') return 'Hoje';
        if (dateFilter === '7d') {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return `${formatShortDate(sevenDaysAgo)} - ${formatShortDate(today)}`;
        }
        if (dateFilter === 'month') {
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            return `${formatShortDate(firstDayOfMonth)} - ${formatShortDate(today)}`;
        }
        if (dateFilter === 'custom' && dateRange?.from && dateRange?.to) {
            return `${formatShortDate(dateRange.from)} - ${formatShortDate(dateRange.to)}`;
        }
        return 'Últimos 7 dias';
    }, [dateFilter, dateRange]);

    const clientData = useMemo(() => {
        if (!selectedClientId || !clients.length) return null;
        return clients.find(c => c.id === selectedClientId) || null;
    }, [selectedClientId, clients]);

    const selectedClientName = useMemo(() => clientData?.name || localStorage.getItem('dashboard_selectedClientName') || null, [clientData]);

    const value = useMemo(() => ({
        selectedClientId, selectedAccountId, selectedProfileId, viewMode,
        dateFilter, dateRange, setDateFilter, setDateRange, getDateRangeForAPI, dateFilterLabel,
        clients, clientData, selectedClientName, isLoadingClients, refreshClients,
        selectClient, selectAccount, setSelectedClient, setSelectedProfileId, resetSelection,
        profiles, isLoading, refreshProfiles,
        isAccountWizardOpen, setIsAccountWizardOpen, profilePhotoMap, cacheProfilePhoto,
        workspaceId, workspaces, setWorkspaceId
    }), [
        selectedClientId, selectedAccountId, selectedProfileId, viewMode,
        dateFilter, dateRange, setDateFilter, setDateRange, getDateRangeForAPI, dateFilterLabel,
        clients, clientData, selectedClientName, isLoadingClients, refreshClients,
        selectClient, selectAccount, setSelectedClient, setSelectedProfileId, resetSelection,
        profiles, isLoading, refreshProfiles,
        isAccountWizardOpen, profilePhotoMap, cacheProfilePhoto,
        workspaceId, workspaces, setWorkspaceId
    ]);

    // =========================================================================
    // 6. INITIALIZATION & EFFECTS
    // =========================================================================

    useEffect(() => {
        const initializeState = async () => {
            setIsLoading(true);
            try {
                // 1. Recover selection FIRST before refreshing
                const savedClientId = localStorage.getItem('dashboard_selectedClientId') || localStorage.getItem('lever_selected_client_id');
                const savedAccountId = localStorage.getItem('dashboard_selectedAccountId');

                if (savedClientId) {
                    setSelectedClientId(savedClientId);
                    setViewMode('client');
                } else if (savedAccountId) {
                    setSelectedAccountId(savedAccountId);
                    setViewMode('account');
                }

                // 2. Load clients AND profiles IN PARALLEL (major speed boost)
                await Promise.all([
                    refreshClients(),
                    refreshProfiles()
                ]);

                // 3. Workspace fallback from localStorage (no more slow RPC call)
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const localWorkspaceId = localStorage.getItem('lastWorkspaceId') || localStorage.getItem('lads_active_workspace_id');

                    if (localWorkspaceId && !workspaceId) {
                        setWorkspaceIdState(localWorkspaceId);
                    }
                }
            } catch (error) {
                console.error('[DashboardContext] Initialization error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            initializeState();
        } else {
            // Se o usuário deslogar, ou antes do login terminar, encerra o loading local
            setIsLoading(false);
        }
    }, [user?.id]); // Run when user changes to properly load after login

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}

// =============================================================================
// HOOKS
// =============================================================================

// Main hook
// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}

// Compatibility alias for components still using useSelectedClient
// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedClient() {
    const dashboard = useDashboard();

    // Return the same interface as the old SelectedClientContext
    return {
        selectedClientId: dashboard.selectedClientId,
        selectedClientName: dashboard.selectedClientName,
        clientData: dashboard.clientData,
        clients: dashboard.clients,
        isLoading: dashboard.isLoadingClients,
        error: null as Error | null,
        setSelectedClient: dashboard.setSelectedClient,
        refreshClientData: dashboard.refreshClients,
    };
}
