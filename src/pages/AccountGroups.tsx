import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { FolderPlus, Folder, User, GripVertical, Trash2, Image as ImageIcon, Settings, Plus, Loader2, ShoppingCart, FileText, BookOpen, Globe, Instagram, Activity, Link, Facebook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AccountSettingsModal } from "@/components/AccountSettingsModal";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Group {
    id: string;
    name: string;
    color: string;
    accounts: AdAccount[];
}

interface AdAccount {
    id: string;
    name: string;
    group_id?: string;
    activeCampaigns?: number;
    pausedCampaigns?: number;
    totalCampaigns?: number;
    settings?: {
        default_page_name?: string;
        default_instagram_name?: string;
        default_pixel_name?: string;
        default_domain?: string;
    }
}


const COLORS = [
    { name: "Azul", value: "#3b82f6" },
    { name: "Verde", value: "#10b981" },
    { name: "Roxo", value: "#8b5cf6" },
    { name: "Laranja", value: "#f97316" },
    { name: "Índigo", value: "#4f46e5" },
    { name: "Rosa", value: "#ec4899" },
];

// Wizard state types
type WizardStep = 'IDLE' | 'BUSINESS_SELECT' | 'ACCOUNT_SELECT' | 'CONFIGURE_DEFAULTS';

// Account types
type AccountType = 'ecom' | 'leads' | 'infoproduto';

// Account defaults configuration
interface AccountDefaults {
    accountId: string;
    accountName: string;
    accountType: AccountType;
    defaultPageId: string;
    defaultPageName: string;
    defaultInstagramId: string;
    defaultInstagramName: string;
    defaultPixelId: string;
    defaultPixelName: string;
    defaultDomain: string;
    defaultFormId: string;
    defaultFormName: string;
    // Available options fetched from Meta
    pages: { id: string; name: string; picture?: string }[];
    instagrams: { id: string; name: string; picture?: string }[];
    pixels: { id: string; name: string; is_active?: boolean }[];
    forms: { id: string; name: string }[];
    isLoading: boolean;
}

const AccountGroups = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { selectAccount, setIsAccountWizardOpen } = useDashboard();
    const [groups, setGroups] = useState<Group[]>([]);
    const [unassignedAccounts, setUnassignedAccounts] = useState<AdAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupColor, setNewGroupColor] = useState(COLORS[0].value);
    const [draggedAccount, setDraggedAccount] = useState<AdAccount | null>(null);
    const { toast } = useToast();
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);


    // Get all existing account IDs (from groups and unassigned)
    const existingAccountIds = new Set([
        ...unassignedAccounts.map(a => a.id),
        ...groups.flatMap(g => g.accounts.map(a => a.id))
    ]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get user's workspace
            const supabaseAny = supabase as any;
            const { data: wsArray } = await supabaseAny.rpc('get_user_workspace', {
                p_user_id: user.id
            });
            const workspace = wsArray && wsArray.length > 0 ? wsArray[0] : null;

            if (!workspace) {
                setIsLoading(false);
                return;
            }

            // 1. Buscar Grupos (Pastas) - stored in account_groups table
            const { data: groupsData } = await supabaseAny
                .from('account_groups')
                .select('*')
                .eq('workspace_id', workspace.id)
                .order('created_at', { ascending: false });

            // 2. Buscar TODAS as contas de anúncio ativas (cast to any because group_id column exists but types not regenerated)
            const { data: accountsData } = await (supabase as any)
                .from('ad_accounts')
                .select('id, name, group_id')
                .eq('user_id', user.id)
                .eq('status', 'ACTIVE');

            // 3. Buscar contagem de campanhas por conta e status
            const { data: campaignsData } = await supabase
                .from('campaigns')
                .select('account_id, status')
                .in('account_id', accountsData?.map(a => a.id) || []);

            // 3. Buscar configurações (para Assets)
            const { data: settingsData } = await (supabase as any)
                .from('account_settings')
                .select('ad_account_id, default_page_name, default_instagram_name, default_pixel_name, default_domain')
                .in('ad_account_id', accountsData?.map((a: any) => a.id) || []);

            const settingsMap = new Map();
            settingsData?.forEach((s: any) => settingsMap.set(s.ad_account_id, s));

            // Agregar contagem de campanhas por conta
            const campaignStats: Record<string, { active: number; paused: number; total: number }> = {};
            campaignsData?.forEach((c: any) => {
                if (!campaignStats[c.account_id]) {
                    campaignStats[c.account_id] = { active: 0, paused: 0, total: 0 };
                }
                campaignStats[c.account_id].total++;
                if (c.status === 'ACTIVE') campaignStats[c.account_id].active++;
                else if (c.status === 'PAUSED') campaignStats[c.account_id].paused++;
            });

            // Processar e Agrupar
            const processedGroups: Group[] = groupsData?.map((group: any) => ({
                ...group,
                accounts: []
            })) || [];

            const unassigned: AdAccount[] = [];

            accountsData?.forEach((acc: any) => {
                const stats = campaignStats[acc.id] || { active: 0, paused: 0, total: 0 };
                const settings = settingsMap.get(acc.id);
                const enrichedAcc: AdAccount = {
                    ...acc,
                    activeCampaigns: stats.active,
                    pausedCampaigns: stats.paused,
                    totalCampaigns: stats.total,
                    settings
                };
                if (acc.group_id) {
                    const group = processedGroups.find(g => g.id === acc.group_id);
                    if (group) {
                        group.accounts.push(enrichedAcc);
                    } else {
                        unassigned.push(enrichedAcc);
                    }
                } else {
                    unassigned.push(enrichedAcc);
                }
            });

            setGroups(processedGroups);
            setUnassignedAccounts(unassigned);

        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            toast({ title: t('common.error', 'Error'), description: t('account_groups.toasts.fetch_error', 'Failed to load assets.'), variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const supabaseAny = supabase as any;
            const { data: wsArray } = await supabaseAny.rpc('get_user_workspace', {
                p_user_id: user.id
            });
            const workspace = wsArray && wsArray.length > 0 ? wsArray[0] : null;

            if (!workspace) return;

            const { error } = await supabaseAny
                .from('account_groups')
                .insert({ name: newGroupName, color: newGroupColor, workspace_id: workspace.id });

            if (error) throw error;

            toast({ title: t('account_groups.toasts.create_success', 'Group created!'), description: t('account_groups.toasts.create_success_desc', { name: newGroupName }) });
            setNewGroupName("");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
            toast({ title: t('common.error', 'Error'), description: t('account_groups.toasts.create_error', 'Could not create group.'), variant: "destructive" });
        }
    };

    const handleMoveAccount = async (account: AdAccount, targetGroupId: string | null) => {
        try {
            const { error } = await (supabase as any)
                .from('ad_accounts')
                .update({ group_id: targetGroupId })
                .eq('id', account.id);

            if (error) throw error;

            await fetchData();
            toast({ title: t('account_groups.toasts.move_success', 'Account moved successfully!') });

        } catch (error: any) {
            console.error("Erro ao mover conta:", error);
            toast({
                title: t('account_groups.toasts.move_error', 'An error occurred while saving.'),
                description: error.message || t('account_groups.toasts.move_error', "An error occurred while saving."),
                variant: "destructive"
            });
            fetchData();
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm(t('account_groups.toasts.delete_confirm', "Are you sure? Linked accounts will return to 'No Folder'."))) return;
        try {
            const supabaseAny = supabase as any;
            // First, unlink accounts
            await supabaseAny
                .from('ad_accounts')
                .update({ group_id: null })
                .eq('group_id', groupId);
            // Then delete group
            await supabaseAny.from('account_groups').delete().eq('id', groupId);
            fetchData();
            toast({ title: t('account_groups.toasts.delete_success', 'Group removed.') });
        } catch (error) {
            toast({ title: t('common.error', 'Error'), variant: "destructive" });
        }
    };

    const handleDeleteAccount = async (account: AdAccount) => {
        if (!confirm(t('account_groups.toasts.delete_account_confirm', { name: account.name }))) return;

        try {
            const supabaseAny = supabase as any;

            // Delete account settings first
            await supabaseAny
                .from('account_settings')
                .delete()
                .eq('ad_account_id', account.id);

            // Delete the ad account
            await supabaseAny
                .from('ad_accounts')
                .delete()
                .eq('id', account.id);

            fetchData();
            toast({
                title: t('account_groups.toasts.delete_account_success', "Account removed successfully."),
                description: t('account_groups.toasts.delete_account_success', { name: account.name })
            });
        } catch (error: any) {
            console.error("Erro ao remover conta:", error);
            toast({
                title: "Erro ao remover conta",
                description: error.message,
                variant: "destructive"
            });
        }
    };



    // ================= MAIN RENDER =================
    return (
        <div className="pt-8 px-2 sm:px-4 pb-6 space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('account_groups.title', 'Assets')}</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">{t('account_groups.subtitle', 'Organize your ad accounts into groups')}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        onClick={() => setIsAccountWizardOpen(true)}
                        className="w-full sm:w-auto justify-center"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {t('account_groups.add_accounts', 'Add Accounts')}
                    </Button>

                    <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto justify-center">
                                <FolderPlus className="mr-2 h-4 w-4" />
                                {t('account_groups.new_group', 'New Group')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('account_groups.create_group_title', 'Create New Group')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('account_groups.group_name', 'Group Name')}</label>
                                    <Input
                                        placeholder={t('account_groups.group_name_placeholder', 'Ex: E-commerce, Services, etc.')}
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('account_groups.tag_color', 'Tag Color')}</label>
                                    <div className="flex gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color.value}
                                                onClick={() => setNewGroupColor(color.value)}
                                                className={`w-8 h-8 rounded-full transition-all ${newGroupColor === color.value ? 'ring-2 ring-offset-2 ring-black dark:ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                                                style={{ backgroundColor: color.value }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
                                <Button onClick={handleCreateGroup}>{t('account_groups.create_group_button', 'Create Group')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

                {/* COLUNA 1: Biblioteca de Ativos (Accordion) */}
                <Card className="lg:col-span-1 h-[400px] lg:h-[calc(100vh-200px)] flex flex-col bg-muted/30 border-dashed">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            {t('account_groups.library_title', 'Asset Library')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative overflow-hidden">
                        <ScrollArea className="h-full px-4 pb-4">
                            <div className="w-full">
                                {/* ITEM 1: Contas de Anúncio */}
                                {/* ITEM 1: Contas de Anúncio */}
                                <div className="border-b-0">
                                    <div className="pt-2">
                                        {isLoading ? (
                                            [1, 2].map(i => <Skeleton key={i} className="h-12 w-full mb-2" />)
                                        ) : unassignedAccounts.length === 0 ? (
                                            <div className="text-center py-4 text-muted-foreground text-xs">
                                                {t('account_groups.all_organized', 'All accounts are organized!')}
                                            </div>
                                        ) : (
                                            unassignedAccounts.map(account => (
                                                <div
                                                    key={account.id}
                                                    className="group flex items-center justify-between p-3 mb-2 bg-background border rounded-lg transition-all cursor-grab active:cursor-grabbing"
                                                    draggable
                                                    onDragStart={() => setDraggedAccount(account)}
                                                    onDragEnd={() => setDraggedAccount(null)}
                                                >
                                                    <div className="flex items-center justify-between w-full gap-2">
                                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${(account.activeCampaigns || 0) > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    <p className="text-sm font-semibold truncate leading-tight">{account.name}</p>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {account.settings?.default_page_name && (
                                                                            <span title={`${t('common.page', 'Page')}: ${account.settings.default_page_name}`}>
                                                                                <Facebook className="h-3 w-3 text-[#1877F2]" />
                                                                            </span>
                                                                        )}
                                                                        {account.settings?.default_instagram_name && (
                                                                            <span title={`${t('common.instagram', 'Instagram')}: @${account.settings.default_instagram_name}`}>
                                                                                <Instagram className="h-3 w-3 text-pink-500/70" />
                                                                            </span>
                                                                        )}
                                                                        {account.settings?.default_pixel_name && (
                                                                            <span title={`${t('common.pixel', 'Pixel')}: ${account.settings.default_pixel_name}`}>
                                                                                <Activity className="h-3 w-3 text-purple-500/70" />
                                                                            </span>
                                                                        )}
                                                                        {account.settings?.default_domain && (
                                                                            <span title={`${t('common.site', 'Website')}: ${account.settings.default_domain}`}>
                                                                                <Globe className="h-3 w-3 text-green-500/70" />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="-mt-0.5">
                                                                    <span className="text-[10px] text-muted-foreground truncate leading-none">{account.id.replace('act_', '')}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSettingsAccountId(account.id);
                                                                    setSettingsModalOpen(true);
                                                                }}
                                                                className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-muted"
                                                            >
                                                                <Settings className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* COLUNA 2 e 3: Grupos */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                    {isLoading ? (
                        [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
                    ) : groups.length === 0 ? (
                        <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center py-12 sm:py-20 text-muted-foreground border-2 border-dashed rounded-lg px-4 text-center">
                            <User className="h-12 w-12 mb-4 opacity-20" />
                            <p>{t('account_groups.no_groups', 'You haven\'t created any groups yet.')}</p>
                            <Button variant="link" onClick={() => setIsCreateModalOpen(true)}>{t('account_groups.create_first_group', 'Create my first group')}</Button>
                        </div>
                    ) : (
                        groups.map(group => (
                            <Card
                                key={group.id}
                                className={`group relative transition-all duration-200 ${draggedAccount ? 'border-primary/50 bg-primary/5 border-dashed' : 'hover:border-primary/20'}`}
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary'); }}
                                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ring-2', 'ring-primary'); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                                    if (draggedAccount) {
                                        handleMoveAccount(draggedAccount, group.id);
                                        setDraggedAccount(null);
                                    }
                                }}
                            >
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                                        <CardTitle className="text-base">{group.name}</CardTitle>
                                        <Badge variant="secondary" className="ml-2 text-xs">{group.accounts.length}</Badge>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </CardHeader>
                                <CardContent>

                                    <div className="min-h-[80px] space-y-1">
                                        {group.accounts.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-4 text-center italic">{t('account_groups.drag_accounts_here', 'Drag accounts here')}</p>
                                        ) : (
                                            group.accounts.map(acc => (
                                                <div
                                                    key={acc.id}
                                                    className="flex items-center justify-between p-3 mb-2 bg-background border rounded-lg transition-all hover:border-primary/20 cursor-pointer group/item"
                                                    onClick={() => {
                                                        selectAccount(acc.id);
                                                        navigate('/assets');
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                        {/* Status dot */}
                                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${(acc.activeCampaigns || 0) > 0 ? 'bg-green-500' : 'bg-gray-400'
                                                            }`} title={
                                                                (acc.activeCampaigns || 0) > 0
                                                                    ? t('account_groups.active_campaigns', { count: acc.activeCampaigns })
                                                                    : t('account_groups.no_active_campaigns', 'No active campaigns')
                                                            } />

                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <div className="flex items-center gap-1 min-w-0">
                                                                <span className="text-sm font-semibold truncate leading-tight">{acc.name}</span>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {acc.settings && (
                                                                        <>
                                                                            {acc.settings.default_page_name && (
                                                                                <span title={`${t('common.page', 'Page')}: ${acc.settings.default_page_name}`}>
                                                                                    <Facebook className="h-3 w-3 text-[#1877F2]" />
                                                                                </span>
                                                                            )}
                                                                            {acc.settings.default_instagram_name && (
                                                                                <span title={`${t('common.instagram', 'Instagram')}: @${acc.settings.default_instagram_name}`}>
                                                                                    <Instagram className="h-3 w-3 text-pink-500/70" />
                                                                                </span>
                                                                            )}
                                                                            {acc.settings.default_pixel_name && (
                                                                                <span title={`${t('common.pixel', 'Pixel')}: ${acc.settings.default_pixel_name}`}>
                                                                                    <Activity className="h-3 w-3 text-purple-500/70" />
                                                                                </span>
                                                                            )}
                                                                            {acc.settings.default_domain && (
                                                                                <span title={`${t('common.site', 'Website')}: ${acc.settings.default_domain}`}>
                                                                                    <Globe className="h-3 w-3 text-green-500/70" />
                                                                                </span>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="-mt-0.5">
                                                                <span className="text-[10px] text-muted-foreground truncate leading-none">{acc.id.replace('act_', '')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSettingsAccountId(acc.id);
                                                                setSettingsModalOpen(true);
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-muted"
                                                            title={t('sidebar.settings', 'Settings')}
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteAccount(acc);
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-muted"
                                                            title={t('account_groups.remove_account', 'Remove account')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

            </div>

            <AccountSettingsModal
                open={settingsModalOpen}
                onOpenChange={setSettingsModalOpen}
                accountId={settingsAccountId || undefined}
            />
        </div>
    );
};

export default AccountGroups;
