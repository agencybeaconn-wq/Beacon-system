import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ExternalLink, Unlink, Loader2, Store, ShoppingCart, Zap, RefreshCw, AlertCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/contexts/DashboardContext";
import { LEVER_SHOPIFY_SCOPES_CSV } from "@/constants/shopifyScopes";

interface AdAccount {
    account_id: string;
    name: string;
    currency: string;
    status: string;
    business_name?: string;
}

interface ShopifyConnection {
    shopify_domain: string | null;
    shopify_status: 'disconnected' | 'pending' | 'connected' | 'error';
    shopify_shop_name: string | null;
    shopify_connected_at: string | null;
}

interface CartPandaConnection {
    cartpanda_store_slug: string | null;
    cartpanda_status: 'disconnected' | 'pending' | 'connected' | 'error';
    cartpanda_store_name: string | null;
    cartpanda_connected_at: string | null;
}

interface ClarityConnection {
    clarity_project_id: string | null;
    clarity_status: 'disconnected' | 'pending' | 'connected' | 'error';
    clarity_connected_at: string | null;
    clarity_snippet_installed: boolean;
}

interface ConnectionsHubProps {
    onConnectionChange?: (type: 'meta' | 'shopify' | 'kartpanda', connected: boolean, data?: any) => void;
}

export function ConnectionsHub({ onConnectionChange }: ConnectionsHubProps) {
    const { toast } = useToast();
    const { selectedClientId, clientData, refreshClients, workspaceId } = useDashboard();
    const [searchParams, setSearchParams] = useSearchParams();

    // Meta State
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [savedAccounts, setSavedAccounts] = useState<string[]>([]); // Track what's actually saved in DB
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [accountsError, setAccountsError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [hasMetaConnection, setHasMetaConnection] = useState(false);
    const [accountSearch, setAccountSearch] = useState("");

    // Shopify State - Real Integration
    const [shopifyDomain, setShopifyDomain] = useState("");
    const [shopifyClientId, setShopifyClientId] = useState("");
    const [shopifyClientSecret, setShopifyClientSecret] = useState("");
    const [isShopifyLoading, setIsShopifyLoading] = useState(false);
    const [shopifyConnection, setShopifyConnection] = useState<ShopifyConnection | null>(null);

    // CartPanda State
    const [cartpandaStoreSlug, setCartpandaStoreSlug] = useState("");
    const [cartpandaBearerToken, setCartpandaBearerToken] = useState("");
    const [isCartPandaLoading, setIsCartPandaLoading] = useState(false);
    const [cartpandaConnection, setCartpandaConnection] = useState<CartPandaConnection | null>(null);

    // Clarity State
    const [clarityProjectId, setClarityProjectId] = useState("");
    const [clarityApiToken, setClarityApiToken] = useState("");
    const [isClarityLoading, setIsClarityLoading] = useState(false);
    const [clarityConnection, setClarityConnection] = useState<ClarityConnection | null>(null);

    // Load ad accounts and client's selected accounts on mount
    useEffect(() => {
        if (workspaceId) loadAdAccounts();
    }, [workspaceId]);

    // Sync local states with clientData from context
    useEffect(() => {
        if (clientData) {
            const accounts = (clientData as any).selected_ad_accounts || [];
            setSelectedAccounts(accounts);
            setSavedAccounts(accounts);

            setShopifyConnection({
                shopify_domain: (clientData as any).shopify_domain || null,
                shopify_status: (clientData as any).shopify_status || 'disconnected',
                shopify_shop_name: (clientData as any).shopify_shop_name || null,
                shopify_connected_at: (clientData as any).shopify_connected_at || null
            });

            if ((clientData as any).shopify_domain) {
                setShopifyDomain((clientData as any).shopify_domain);
            }
            if ((clientData as any).shopify_client_id) {
                setShopifyClientId((clientData as any).shopify_client_id);
            }
            if ((clientData as any).shopify_client_secret) {
                setShopifyClientSecret((clientData as any).shopify_client_secret);
            }

            setCartpandaConnection({
                cartpanda_store_slug: (clientData as any).cartpanda_store_slug || null,
                cartpanda_status: (clientData as any).cartpanda_status || 'disconnected',
                cartpanda_store_name: (clientData as any).cartpanda_store_name || null,
                cartpanda_connected_at: (clientData as any).cartpanda_connected_at || null
            });

            if ((clientData as any).cartpanda_store_slug) {
                setCartpandaStoreSlug((clientData as any).cartpanda_store_slug);
            }

            setClarityConnection({
                clarity_project_id: (clientData as any).clarity_project_id || null,
                clarity_status: (clientData as any).clarity_status || 'disconnected',
                clarity_connected_at: (clientData as any).clarity_connected_at || null,
                clarity_snippet_installed: (clientData as any).clarity_snippet_installed || false,
            });

            if ((clientData as any).clarity_project_id) {
                setClarityProjectId((clientData as any).clarity_project_id);
            }
        }
    }, [clientData]);

    // Handle Shopify OAuth callback from URL params
    useEffect(() => {
        const shopifyStatus = searchParams.get('shopify');
        const shopifyShop = searchParams.get('shop');

        if (shopifyStatus === 'success' && shopifyShop) {
            toast({
                title: "Shopify conectado!",
                description: `Loja ${shopifyShop} vinculada com sucesso.`
            });
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('shopify');
            newParams.delete('shop');
            setSearchParams(newParams, { replace: true });
            refreshClients();
        } else if (shopifyStatus === 'error') {
            const message = searchParams.get('message') || 'Erro desconhecido';
            toast({
                title: "Erro na conexao Shopify",
                description: message,
                variant: "destructive"
            });
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('shopify');
            newParams.delete('message');
            setSearchParams(newParams, { replace: true });
        }
    }, [searchParams]);

    const loadAdAccounts = async () => {
        setIsLoadingAccounts(true);
        setAccountsError(null);

        try {
            console.log('[ConnectionsHub] Loading ad accounts for workspace:', workspaceId);

            // First, get the Meta connection with access token filtered by workspace
            let query = (supabase as any)
                .from('fb_connections')
                .select('id, name, access_token, status')
                .eq('status', 'connected');

            if (workspaceId) {
                query = query.eq('workspace_id', workspaceId);
            }

            const { data: connections, error: connError } = await query.limit(1);

            console.log('[ConnectionsHub] fb_connections result:', { count: connections?.length, error: connError?.message });

            if (connError) throw connError;

            if (!connections || connections.length === 0) {
                setHasMetaConnection(false);
                setAdAccounts([]);
                console.log('[ConnectionsHub] No Meta connections found for this workspace');
                return;
            }

            setHasMetaConnection(true);
            const accessToken = connections[0].access_token;

            if (!accessToken) {
                setAccountsError('Token de acesso nao encontrado');
                console.error('[ConnectionsHub] Connection exists but token is empty');
                return;
            }

            console.log('[ConnectionsHub] Token found, calling list-ad-accounts...');

            // Call the edge function to list ad accounts
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/list-ad-accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accessToken })
            });

            const data = await response.json();
            console.log('[ConnectionsHub] list-ad-accounts response:', { accountsCount: data.accounts?.length, error: data.error });

            if (data.error) {
                throw new Error(data.error);
            }

            setAdAccounts(data.accounts || []);
        } catch (error: any) {
            console.error('[ConnectionsHub] Error loading ad accounts:', error);
            setAccountsError(error.message || 'Erro ao carregar contas');
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    // Removed loadClientSelectedAccounts, loadShopifyConnection, loadCartPandaConnection
    // They are now handled by the useEffect syncing with clientData from DashboardContext

    const handleCartPandaConnect = async () => {
        if (!cartpandaStoreSlug.trim() || !cartpandaBearerToken.trim()) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha o slug da loja e o Bearer Token",
                variant: "destructive"
            });
            return;
        }

        if (!selectedClientId) {
            toast({
                title: "Cliente não selecionado",
                description: "Selecione um cliente antes de conectar",
                variant: "destructive"
            });
            return;
        }

        setIsCartPandaLoading(true);

        try {
            // Use direct fetch to debug CORS issue
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            console.log('Calling cartpanda-validate with fetch...');
            console.log('URL:', `${supabaseUrl}/functions/v1/cartpanda-validate`);

            const response = await fetch(`${supabaseUrl}/functions/v1/cartpanda-validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({
                    storeSlug: cartpandaStoreSlug.trim(),
                    bearerToken: cartpandaBearerToken.trim(),
                    clientId: selectedClientId
                })
            });

            console.log('Fetch response status:', response.status);

            const data = await response.json();
            console.log('Response data:', data);

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Erro ao conectar CartPanda');
            }

            toast({
                title: "CartPanda conectado!",
                description: `Loja ${data.storeName || cartpandaStoreSlug} vinculada com sucesso.`
            });

            setCartpandaConnection({
                cartpanda_store_slug: data.storeSlug,
                cartpanda_status: 'connected',
                cartpanda_store_name: data.storeName,
                cartpanda_connected_at: new Date().toISOString()
            });

            setCartpandaBearerToken(""); // Clear token from UI for security
            onConnectionChange?.('kartpanda', true, { storeSlug: data.storeSlug });
            refreshClients();
        } catch (error: any) {
            console.error('Error connecting CartPanda:', error);
            toast({
                title: "Erro ao conectar",
                description: error.message || "Não foi possível conectar a CartPanda",
                variant: "destructive"
            });
        } finally {
            setIsCartPandaLoading(false);
        }
    };

    const handleCartPandaDisconnect = async () => {
        if (!selectedClientId) return;

        setIsCartPandaLoading(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({
                    cartpanda_status: 'disconnected',
                    cartpanda_bearer_token: null,
                    cartpanda_connected_at: null
                })
                .eq('id', selectedClientId);

            if (error) throw error;

            setCartpandaConnection({
                cartpanda_store_slug: cartpandaConnection?.cartpanda_store_slug || null,
                cartpanda_status: 'disconnected',
                cartpanda_store_name: null,
                cartpanda_connected_at: null
            });

            toast({ title: "CartPanda desconectado" });
            onConnectionChange?.('kartpanda', false);
            refreshClients();
        } catch (error: any) {
            toast({
                title: "Erro ao desconectar",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsCartPandaLoading(false);
        }
    };

    const isCartPandaConnected = cartpandaConnection?.cartpanda_status === 'connected';
    const isCartPandaPending = cartpandaConnection?.cartpanda_status === 'pending';

    // ─────────────── Clarity Handlers ───────────────
    const handleClarityConnect = async () => {
        if (!clarityProjectId.trim() || !clarityApiToken.trim()) {
            toast({
                title: "Preencha todos os campos",
                description: "Project ID e API Token são obrigatórios",
                variant: "destructive"
            });
            return;
        }
        if (!selectedClientId) {
            toast({ title: "Selecione um cliente", variant: "destructive" });
            return;
        }

        setIsClarityLoading(true);
        try {
            const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/clarity-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                },
                body: JSON.stringify({
                    action: 'validate',
                    clientId: selectedClientId,
                    projectId: clarityProjectId.trim(),
                    apiToken: clarityApiToken.trim(),
                }),
            });

            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Falha ao conectar Clarity');

            toast({
                title: "Microsoft Clarity conectado!",
                description: `Project ID ${clarityProjectId.trim()} validado com sucesso.`
            });

            setClarityConnection({
                clarity_project_id: clarityProjectId.trim(),
                clarity_status: 'connected',
                clarity_connected_at: new Date().toISOString(),
                clarity_snippet_installed: false,
            });

            setClarityApiToken(""); // limpa token da UI
            refreshClients();
        } catch (error: any) {
            console.error('Error connecting Clarity:', error);
            toast({
                title: "Erro ao conectar",
                description: error.message || "Não foi possível conectar ao Microsoft Clarity",
                variant: "destructive"
            });
        } finally {
            setIsClarityLoading(false);
        }
    };

    const handleClarityDisconnect = async () => {
        if (!selectedClientId) return;
        setIsClarityLoading(true);
        try {
            const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/clarity-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                },
                body: JSON.stringify({ action: 'disconnect', clientId: selectedClientId }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Falha ao desconectar');
            }

            setClarityConnection({
                clarity_project_id: null,
                clarity_status: 'disconnected',
                clarity_connected_at: null,
                clarity_snippet_installed: false,
            });
            setClarityProjectId("");

            toast({ title: "Microsoft Clarity desconectado" });
            refreshClients();
        } catch (error: any) {
            toast({
                title: "Erro ao desconectar",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsClarityLoading(false);
        }
    };

    const isClarityConnected = clarityConnection?.clarity_status === 'connected';

    const handleToggleAccount = (accountId: string) => {
        setSelectedAccounts(prev => {
            if (prev.includes(accountId)) {
                return prev.filter(id => id !== accountId);
            } else {
                return [...prev, accountId];
            }
        });
    };

    const handleSaveSelectedAccounts = async () => {
        if (!selectedClientId) {
            toast({
                title: "Cliente nao selecionado",
                description: "Selecione um cliente antes de salvar",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({ selected_ad_accounts: selectedAccounts })
                .eq('id', selectedClientId);

            if (error) throw error;

            // Trigger background sync for each selected account
            if (selectedAccounts.length > 0) {
                console.log(`[ConnectionsHub] Disparando sync para ${selectedAccounts.length} contas...`);
                Promise.allSettled(selectedAccounts.map(accountId =>
                    supabase.functions.invoke('sync-meta-campaigns', {
                        body: { accountId, force: true }
                    })
                )).then(results => {
                    console.log('[ConnectionsHub] Resultados do sync:', results);
                });
            }

            // Update saved accounts state
            setSavedAccounts([...selectedAccounts]);

            toast({
                title: "Contas vinculadas!",
                description: `${selectedAccounts.length} conta(s) de anuncio vinculada(s) ao cliente.`
            });
            onConnectionChange?.('meta', selectedAccounts.length > 0, { accounts: selectedAccounts });
            refreshClients();
        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearSelection = async () => {
        if (!selectedClientId) return;

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({ selected_ad_accounts: [] })
                .eq('id', selectedClientId);

            if (error) throw error;

            setSelectedAccounts([]);
            setSavedAccounts([]);
            toast({ title: "Contas desvinculadas" });
            onConnectionChange?.('meta', false);
            refreshClients();
        } catch (error: any) {
            toast({
                title: "Erro ao desvincular",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Save Shopify credentials (domain, client_id, client_secret)
    const handleShopifySaveCredentials = async () => {
        if (!shopifyDomain.trim() || !shopifyClientId.trim() || !shopifyClientSecret.trim() || !selectedClientId) {
            toast({ title: "Preencha todos os campos", variant: "destructive" });
            return;
        }

        setIsShopifyLoading(true);
        try {
            const domain = shopifyDomain.trim().includes('.myshopify.com')
                ? shopifyDomain.trim()
                : `${shopifyDomain.trim()}.myshopify.com`;

            const { error: updateError } = await (supabase as any)
                .from('agency_clients')
                .update({
                    shopify_domain: domain,
                    shopify_status: 'pending',
                    shopify_client_id: shopifyClientId.trim(),
                    shopify_client_secret: shopifyClientSecret.trim()
                })
                .eq('id', selectedClientId);

            if (updateError) throw updateError;

            setShopifyDomain(domain);
            setShopifyConnection({
                shopify_domain: domain,
                shopify_status: 'pending',
                shopify_shop_name: null,
                shopify_connected_at: null
            });

            toast({
                title: "Credenciais salvas!",
                description: "Agora clique em 'Verificar Conexão' para conectar.",
            });

            refreshClients();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setIsShopifyLoading(false);
        }
    };

    // Verify connection: trigger OAuth to get the access token
    const handleShopifyConnect = async () => {
        if (!selectedClientId || !shopifyDomain || !shopifyClientId) {
            toast({ title: "Dados incompletos", description: "Configure as credenciais primeiro.", variant: "destructive" });
            return;
        }

        setIsShopifyLoading(true);

        // 42 escopos canônicos Lever (mesma lista com que o app é criado no Dev Dashboard).
        // Antes pedia só 13 hardcoded — o token saía capado (sem markets, inventory,
        // metaobjects, translations, etc). Fonte única em @/constants/shopifyScopes.
        const scopes = LEVER_SHOPIFY_SCOPES_CSV;
        // redirect_uri tem que (a) bater exatamente com o whitelistado no app Shopify do cliente
        // e (b) rotear pro edge function do Beacon. window.location.origin resolve pro domínio
        // atual (ex: https://agencybeacon.site) e o rewrite do vercel.json manda /api/shopify/callback
        // pro shopify-oauth-callback no Supabase do Beacon. NUNCA hardcodar domínio da Lever aqui —
        // senão o token OAuth é gravado no banco errado.
        const redirectUri = `${window.location.origin}/api/shopify/callback`;
        const authUrl = `https://${shopifyDomain}/admin/oauth/authorize?client_id=${shopifyClientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${selectedClientId}`;

        window.location.href = authUrl;
    };

    const handleShopifyDisconnect = async () => {
        if (!selectedClientId) return;

        setIsShopifyLoading(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({
                    shopify_status: 'disconnected',
                    shopify_access_token: null,
                    shopify_connected_at: null
                })
                .eq('id', selectedClientId);

            if (error) throw error;

            setShopifyConnection({
                shopify_domain: shopifyConnection?.shopify_domain || null,
                shopify_status: 'disconnected',
                shopify_shop_name: null,
                shopify_connected_at: null
            });

            toast({ title: "Shopify desconectado" });
            onConnectionChange?.('shopify', false);
            refreshClients();
        } catch (error: any) {
            toast({
                title: "Erro ao desconectar",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsShopifyLoading(false);
        }
    };

    const isShopifyConnected = shopifyConnection?.shopify_status === 'connected';
    const isShopifyPending = shopifyConnection?.shopify_status === 'pending';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Removed */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Meta Ads Connection */}
                <Card className="group relative overflow-hidden border-border/40 transition-all duration-300">

                    <CardHeader className="pb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1877F2">
                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                                    </svg>
                                </div>
                                <div className="space-y-0.5">
                                    <CardTitle className="text-lg font-bold">Meta Ads</CardTitle>
                                    <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-70">Contas de Anúncio</CardDescription>
                                </div>
                            </div>
                            {hasMetaConnection ? (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                                    Conectado
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                                    <AlertCircle className="w-3 h-3 mr-1.5" />
                                    Pendente
                                </Badge>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {isLoadingAccounts ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
                                <span className="text-xs font-medium text-muted-foreground animate-pulse">Sincronizando contas...</span>
                            </div>
                        ) : !hasMetaConnection ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 px-4 bg-muted/30 rounded-2xl border border-dashed border-border/60">
                                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                                    <Zap className="w-8 h-8 text-amber-500" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">Conexão Necessária</p>
                                    <p className="text-xs text-muted-foreground max-w-[240px]">
                                        Você precisa conectar sua conta Meta Business na central de conexões.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full shadow-sm hover:bg-background"
                                    onClick={() => window.location.href = '/connections?action=connect'}
                                >
                                    Ir para Central de Conexões
                                    <ExternalLink className="w-3.5 h-3.5 ml-2" />
                                </Button>
                            </div>
                        ) : accountsError ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 px-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                                <AlertCircle className="w-10 h-10 text-red-500/50" />
                                <p className="text-sm font-medium text-red-600">{accountsError}</p>
                                <Button variant="outline" size="sm" onClick={loadAdAccounts} className="rounded-full">
                                    <RefreshCw className="w-3 h-3 mr-2" />
                                    Tentar Novamente
                                </Button>
                            </div>
                        ) : adAccounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-muted/20 rounded-2xl">
                                <p className="text-sm text-muted-foreground font-medium">Nenhuma conta de anúncio encontrada.</p>
                                <Button variant="outline" size="sm" onClick={loadAdAccounts} className="rounded-full">
                                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                    Recarregar
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                                        Lista de Contas
                                    </Label>
                                    <button
                                        onClick={loadAdAccounts}
                                        className="text-primary hover:text-primary/80 transition-colors p-1"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        type="text"
                                        placeholder="Buscar por nome ou BM..."
                                        value={accountSearch}
                                        onChange={(e) => setAccountSearch(e.target.value)}
                                        className="pl-9 h-9 text-sm bg-background border-border/50 rounded-lg"
                                    />
                                </div>

                                {(() => {
                                    const q = accountSearch.trim().toLowerCase();
                                    const filtered = q
                                        ? adAccounts.filter(a =>
                                            a.name.toLowerCase().includes(q) ||
                                            (a.business_name || '').toLowerCase().includes(q) ||
                                            a.account_id.includes(q)
                                        )
                                        : adAccounts;
                                    if (filtered.length === 0) {
                                        return (
                                            <div className="py-6 text-center text-xs text-muted-foreground">
                                                Nenhuma conta encontrada para "{accountSearch}".
                                            </div>
                                        );
                                    }
                                    return (
                                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filtered.map(account => {
                                        const isSelected = selectedAccounts.includes(account.account_id);
                                        const isSaved = savedAccounts.includes(account.account_id);
                                        return (
                                            <div
                                                key={account.account_id}
                                                className={cn(
                                                    "group/item flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative",
                                                    isSelected
                                                        ? "bg-blue-500/[0.03] border-blue-500/30 ring-1 ring-blue-500/10"
                                                        : "bg-background border-border/50 hover:border-border hover:bg-muted/10",
                                                    account.status !== 'ACTIVE' && "opacity-50"
                                                )}
                                                onClick={() => account.status === 'ACTIVE' && handleToggleAccount(account.account_id)}
                                            >
                                                <div className={cn(
                                                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                                    isSelected ? "bg-blue-600 border-blue-600" : "border-border/80"
                                                )}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-sm font-bold truncate">{account.name}</span>
                                                        {isSaved && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold">
                                                        <span className="uppercase">{account.currency}</span>
                                                        <span className="opacity-30">•</span>
                                                        <span className="tabular-nums">{account.account_id}</span>
                                                        {account.business_name && (
                                                            <>
                                                                <span className="opacity-30">•</span>
                                                                <span className="truncate opacity-70 italic font-medium">{account.business_name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    account.status === 'ACTIVE' ? "bg-emerald-500" : "bg-muted-foreground/30"
                                                )} />
                                            </div>
                                        );
                                    })}
                                </div>
                                    );
                                })()}

                                {/* Save/Clear Bar */}
                                {(selectedAccounts.length > 0 || savedAccounts.length > 0) && (
                                    <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                                        {JSON.stringify(selectedAccounts.sort()) !== JSON.stringify(savedAccounts.sort()) ? (
                                            <Button
                                                onClick={handleSaveSelectedAccounts}
                                                disabled={isSaving}
                                                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold"
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <Zap className="w-4 h-4 mr-2" />
                                                )}
                                                Sincronizar {selectedAccounts.length} Contas
                                            </Button>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-600 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                                <Check className="w-3.5 h-3.5" />
                                                Configuração Salva
                                            </div>
                                        )}
                                        {savedAccounts.length > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleClearSelection}
                                                disabled={isSaving}
                                                className="h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-colors"
                                            >
                                                <Unlink className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Shopify & CartPanda Integrated Card Stack */}
                <div className="space-y-8">
                    {/* Shopify */}
                    <Card className="group relative overflow-hidden border-border/40 transition-all duration-300">
                        <CardHeader className="pb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 overflow-hidden p-2.5">
                                        <img src="https://pub-741e79c7a4b84c228594bbc296d1fbdd.r2.dev/lever-system/Logos/shopify-logo-png-transparent.png" alt="Shopify Logo" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <CardTitle className="text-lg font-bold">Shopify</CardTitle>
                                        <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-70">Ecommerce Engine</CardDescription>
                                    </div>
                                </div>
                                {isShopifyConnected ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] font-bold uppercase tracking-wider">
                                        Conectado
                                    </Badge>
                                ) : isShopifyPending ? (
                                    <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px] font-bold uppercase tracking-wider">
                                        Pendente
                                    </Badge>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!isShopifyConnected && !isShopifyPending ? (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Domínio da Loja</Label>
                                        <Input
                                            placeholder="ex: minha-loja.myshopify.com"
                                            value={shopifyDomain}
                                            onChange={(e) => setShopifyDomain(e.target.value)}
                                            className="bg-muted/10 border-border/50 focus:ring-primary/20 transition-all rounded-xl h-11 font-mono text-xs"
                                            disabled={isShopifyLoading}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Client ID</Label>
                                            <Input
                                                placeholder="Shopify Partners → Credenciais"
                                                value={shopifyClientId}
                                                onChange={(e) => setShopifyClientId(e.target.value)}
                                                className="bg-muted/10 border-border/50 focus:ring-primary/20 transition-all rounded-xl h-11 font-mono text-xs"
                                                disabled={isShopifyLoading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Client Secret</Label>
                                            <Input
                                                type="password"
                                                placeholder="Shopify Partners → Credenciais"
                                                value={shopifyClientSecret}
                                                onChange={(e) => setShopifyClientSecret(e.target.value)}
                                                className="bg-muted/10 border-border/50 focus:ring-primary/20 transition-all rounded-xl h-11 font-mono text-xs"
                                                disabled={isShopifyLoading}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleShopifySaveCredentials}
                                        disabled={!shopifyDomain || !shopifyClientId || !shopifyClientSecret || isShopifyLoading}
                                        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                                    >
                                        {isShopifyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
                                        Salvar Credenciais
                                    </Button>
                                    <p className="text-[10px] text-center text-muted-foreground/60">
                                        Credenciais do app criado no Shopify Partners para este cliente
                                    </p>
                                </div>
                            ) : !isShopifyConnected && isShopifyPending ? (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm">Aguardando verificação</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {shopifyConnection?.shopify_domain || shopifyDomain}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Instale o app na loja pelo Shopify Partners, depois clique em verificar.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleShopifyConnect}
                                        disabled={isShopifyLoading}
                                        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                                    >
                                        {isShopifyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                        Verificar Conexão
                                    </Button>
                                    <button
                                        onClick={() => {
                                            setShopifyConnection(prev => prev ? { ...prev, shopify_status: 'disconnected' } : null);
                                        }}
                                        className="w-full text-[10px] text-center font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
                                    >
                                        Reconfigurar credenciais
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <Check className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm text-emerald-900 dark:text-emerald-100">
                                                {shopifyConnection?.shopify_shop_name || 'Loja Ativa'}
                                            </p>
                                            <p className="text-xs font-semibold text-muted-foreground truncate">
                                                {shopifyConnection?.shopify_domain}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/10">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 h-9 rounded-xl text-emerald-600 hover:bg-emerald-500/10 font-bold"
                                            onClick={() => window.open(`https://${shopifyConnection?.shopify_domain}/admin`, '_blank')}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                            Dashboard
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/5 tranistion-colors"
                                            onClick={handleShopifyDisconnect}
                                            disabled={isShopifyLoading}
                                        >
                                            <Unlink className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* CartPanda */}
                    <Card className="group relative overflow-hidden border-border/40 transition-all duration-300">
                        <CardHeader className="pb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center flex-shrink-0">
                                        <img src="https://pub-741e79c7a4b84c228594bbc296d1fbdd.r2.dev/lever-system/Logos/cartpanda.avif" alt="CartPanda Logo" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <CardTitle className="text-lg font-bold">CartPanda</CardTitle>
                                        <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-70">Checkout de Pagamento</CardDescription>
                                    </div>
                                </div>
                                {isCartPandaConnected && (
                                    <Badge className="bg-blue-500/10 text-blue-600 border-0 text-[10px] font-bold uppercase tracking-wider">
                                        Ativo
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!isCartPandaConnected ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Slug da Loja</Label>
                                            <Input
                                                placeholder="ex: minhaloja"
                                                value={cartpandaStoreSlug}
                                                onChange={(e) => setCartpandaStoreSlug(e.target.value)}
                                                className="bg-muted/10 border-border/50 rounded-xl h-11 transition-all"
                                                disabled={isCartPandaLoading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Bearer Token</Label>
                                            <Input
                                                type="password"
                                                placeholder="Token secreto"
                                                value={cartpandaBearerToken}
                                                onChange={(e) => setCartpandaBearerToken(e.target.value)}
                                                className="bg-muted/10 border-border/50 rounded-xl h-11 transition-all"
                                                disabled={isCartPandaLoading}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleCartPandaConnect}
                                        disabled={!cartpandaStoreSlug || !cartpandaBearerToken || isCartPandaLoading}
                                        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm hover:shadow-md transition-all"
                                    >
                                        {isCartPandaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2 text-white/90" />}
                                        Autenticar Integração
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-blue-500/[0.03] border border-blue-500/10 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                            <Check className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm text-blue-900 dark:text-blue-100">
                                                {cartpandaConnection?.cartpanda_store_name || 'CartPanda Store'}
                                            </p>
                                            <p className="text-xs font-semibold text-muted-foreground truncate">
                                                {cartpandaConnection?.cartpanda_store_slug}.mycartpanda.com
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-blue-500/10">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 h-9 rounded-xl text-blue-600 hover:bg-blue-500/10 font-bold"
                                            onClick={() => window.open(`https://${cartpandaConnection?.cartpanda_store_slug}.mycartpanda.com`, '_blank')}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                            Admin
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-colors"
                                            onClick={handleCartPandaDisconnect}
                                            disabled={isCartPandaLoading}
                                        >
                                            <Unlink className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Microsoft Clarity */}
                    <Card className="group relative overflow-hidden border-border/40 transition-all duration-300">
                        <CardHeader className="pb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 border border-purple-500/20">
                                        <svg viewBox="0 0 32 32" className="w-7 h-7 text-purple-600" fill="currentColor">
                                            <path d="M16 4L4 12v8l12 8 12-8v-8L16 4zm0 4.5l8 5.3v4.4l-8 5.3-8-5.3v-4.4l8-5.3z"/>
                                        </svg>
                                    </div>
                                    <div className="space-y-0.5">
                                        <CardTitle className="text-lg font-bold">Microsoft Clarity</CardTitle>
                                        <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-70">Heatmap & Sessions</CardDescription>
                                    </div>
                                </div>
                                {isClarityConnected && (
                                    <Badge className="bg-purple-500/10 text-purple-600 border-0 text-[10px] font-bold uppercase tracking-wider">
                                        Ativo
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!isClarityConnected ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Project ID</Label>
                                            <Input
                                                placeholder="ex: abc123xyz"
                                                value={clarityProjectId}
                                                onChange={(e) => setClarityProjectId(e.target.value)}
                                                className="bg-muted/10 border-border/50 rounded-xl h-11 transition-all"
                                                disabled={isClarityLoading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">API Token</Label>
                                            <Input
                                                type="password"
                                                placeholder="JWT do Data Export"
                                                value={clarityApiToken}
                                                onChange={(e) => setClarityApiToken(e.target.value)}
                                                className="bg-muted/10 border-border/50 rounded-xl h-11 transition-all"
                                                disabled={isClarityLoading}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                                        Gere o token em <span className="font-semibold">Clarity → Settings → Data Export → Generate new API token</span>. Limite: 10 requests/dia/projeto.
                                    </p>
                                    <Button
                                        onClick={handleClarityConnect}
                                        disabled={!clarityProjectId || !clarityApiToken || isClarityLoading}
                                        className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 font-bold text-white shadow-sm hover:shadow-md transition-all"
                                    >
                                        {isClarityLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2 text-white/90" />}
                                        Autenticar Integração
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-purple-500/[0.03] border border-purple-500/10 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                            <Check className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm text-purple-900 dark:text-purple-100">
                                                Clarity Project conectado
                                            </p>
                                            <p className="text-xs font-semibold text-muted-foreground truncate">
                                                ID: {clarityConnection?.clarity_project_id}
                                            </p>
                                            {!clarityConnection?.clarity_snippet_installed && (
                                                <p className="text-[10px] mt-1 text-amber-600 font-medium">
                                                    ⚠ Snippet ainda não injetado no tema. Rode `node .claude/skills/clarity/inject-snippet.mjs &lt;cliente&gt;` ou injete manualmente.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-purple-500/10">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 h-9 rounded-xl text-purple-600 hover:bg-purple-500/10 font-bold"
                                            onClick={() => window.open(`https://clarity.microsoft.com/projects/view/${clarityConnection?.clarity_project_id}/dashboard`, '_blank')}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                            Dashboard
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-colors"
                                            onClick={handleClarityDisconnect}
                                            disabled={isClarityLoading}
                                        >
                                            <Unlink className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
