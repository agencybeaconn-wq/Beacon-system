import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/contexts/DashboardContext";
import {
    Loader2,
    Plus,
    Folder,
    ShoppingCart,
    FileText,
    BookOpen,
    Globe,
    Instagram,
    Activity,
    Link,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

// Wizard state types
type WizardStep = 'IDLE' | 'BUSINESS_SELECT' | 'ACCOUNT_SELECT' | 'CONFIGURE_DEFAULTS';
type AccountType = 'ecom' | 'leads' | 'infoproduto';

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
    pages: { id: string; name: string; picture?: string }[];
    instagrams: { id: string; name: string; picture?: string }[];
    pixels: { id: string; name: string; is_active?: boolean }[];
    forms: { id: string; name: string }[];
    isLoading: boolean;
}

interface ConnectAdAccountWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ConnectAdAccountWizard({ open, onOpenChange, onSuccess }: ConnectAdAccountWizardProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { refreshProfiles } = useDashboard();

    const [wizardStep, setWizardStep] = useState<WizardStep>('IDLE');
    const [businesses, setBusinesses] = useState<any[]>([]);
    const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
    const [adAccounts, setAdAccounts] = useState<any[]>([]);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [tempToken, setTempToken] = useState<string | null>(null);
    const [accountDefaults, setAccountDefaults] = useState<AccountDefaults[]>([]);
    const [existingAccountIds, setExistingAccountIds] = useState<Set<string>>(new Set());

    // Load existing accounts for exclusion
    useEffect(() => {
        if (open) {
            fetchExistingAccounts();
            startWizard();
        } else {
            // Reset state on close
            setWizardStep('IDLE');
            setBusinesses([]);
            setSelectedBusiness(null);
            setAdAccounts([]);
            setSelectedAccountIds([]);
            setAccountDefaults([]);
            setTempToken(null);
        }
    }, [open]);

    const fetchExistingAccounts = async () => {
        const { data: accountsData } = await supabase
            .from('ad_accounts')
            .select('id')
            .eq('status', 'ACTIVE');

        if (accountsData) {
            const ids = new Set(accountsData.map(a => a.id));
            setExistingAccountIds(ids);
        }
    };

    const startWizard = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error(t('common.error', 'User not authenticated'));

            // Get first fb_connection token
            const { data: connections } = await (supabase as any)
                .from('fb_connections')
                .select('id, workspace_id')
                .eq('is_patriarch', true);

            const connection = connections?.[0];

            if (!connection) {
                toast({
                    title: t('connections.wizard.toasts.no_profile', 'No Facebook profile connected'),
                    description: t('connections.wizard.toasts.connect_first', 'Go to Connections to connect your profile first.'),
                    variant: "destructive"
                });
                onOpenChange(false);
                return;
            }

            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-fb-token', {
                body: { connectionId: connection.id }
            });

            if (tokenError || !tokenData?.accessToken) {
                throw new Error(t('connections.wizard.toasts.token_error', 'Could not obtain token'));
            }

            setTempToken(tokenData.accessToken);

            const { data, error } = await supabase.functions.invoke('get-meta-hierarchy', {
                body: { action: 'GET_BUSINESSES', accessToken: tokenData.accessToken }
            });

            if (error) throw error;
            setBusinesses(data.businesses || []);
            setWizardStep('BUSINESS_SELECT');

        } catch (error: any) {
            console.error('Erro ao iniciar wizard:', error);
            toast({ title: t('common.error', 'Error'), description: error.message, variant: "destructive" });
            onOpenChange(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBusinessSelect = async (business: any) => {
        setSelectedBusiness(business);
        setWizardStep('ACCOUNT_SELECT');
        setAdAccounts([]);
        setIsLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('get-meta-hierarchy', {
                body: { action: 'GET_AD_ACCOUNTS', accessToken: tempToken, businessId: business.id }
            });

            if (error) throw error;
            setAdAccounts(data.accounts || []);
        } catch (error: any) {
            console.error('Erro ao buscar contas:', error);
            toast({ title: t('connections.wizard.toasts.fetch_error', 'Error fetching accounts'), description: error.message, variant: "destructive" });
            setWizardStep('BUSINESS_SELECT');
        } finally {
            setIsLoading(false);
        }
    };

    const proceedToConfigureDefaults = async () => {
        if (selectedAccountIds.length === 0 || !tempToken) return;

        setIsLoading(true);
        const selectedAccounts = adAccounts.filter(acc => selectedAccountIds.includes(acc.id));
        const initialDefaults: AccountDefaults[] = selectedAccounts.map(acc => ({
            accountId: acc.id,
            accountName: acc.name,
            accountType: 'ecom',
            defaultPageId: '',
            defaultPageName: '',
            defaultInstagramId: '',
            defaultInstagramName: '',
            defaultPixelId: '',
            defaultPixelName: '',
            defaultDomain: '',
            defaultFormId: '',
            defaultFormName: '',
            pages: [],
            instagrams: [],
            pixels: [],
            forms: [],
            isLoading: true,
        }));

        setAccountDefaults(initialDefaults);
        setWizardStep('CONFIGURE_DEFAULTS');

        const updatedDefaults = await Promise.all(
            initialDefaults.map(async (def) => {
                const accountId = def.accountId.startsWith('act_') ? def.accountId : `act_${def.accountId}`;
                try {
                    console.log(`[Wizard] Fetching assets for account: ${accountId}`);
                    const pagesRes = await fetch(`https://graph.facebook.com/v24.0/${accountId}/promote_pages?fields=id,name,picture{url}&access_token=${tempToken}`);
                    const pagesData = pagesRes.ok ? await pagesRes.json() : { data: [] };
                    if (!pagesRes.ok) console.warn(`[Wizard] Pages fetch error for ${accountId}:`, pagesData);

                    const pixelsRes = await fetch(`https://graph.facebook.com/v24.0/${accountId}/adspixels?fields=id,name,is_unavailable&access_token=${tempToken}`);
                    const pixelsData = pixelsRes.ok ? await pixelsRes.json() : { data: [] };
                    if (!pixelsRes.ok) console.warn(`[Wizard] Pixels fetch error for ${accountId}:`, pixelsData);

                    let instagrams: any[] = [];
                    if (pagesData.data && pagesData.data.length > 0) {
                        for (const page of pagesData.data.slice(0, 3)) {
                            try {
                                const igRes = await fetch(`https://graph.facebook.com/v24.0/${page.id}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${tempToken}`);
                                const igData = igRes.ok ? await igRes.json() : null;
                                if (igData?.instagram_business_account) {
                                    instagrams.push({
                                        id: igData.instagram_business_account.id,
                                        name: igData.instagram_business_account.username || page.name,
                                        picture: igData.instagram_business_account.profile_picture_url
                                    });
                                }
                            } catch (e) {
                                console.warn(`[Wizard] Instagram fetch error for page ${page.id}:`, e);
                            }
                        }
                    }

                    let forms: any[] = [];
                    if (pagesData.data && pagesData.data.length > 0) {
                        for (const page of pagesData.data.slice(0, 3)) {
                            try {
                                const formsRes = await fetch(`https://graph.facebook.com/v24.0/${page.id}/leadgen_forms?fields=id,name&access_token=${tempToken}`);
                                const formsData = formsRes.ok ? await formsRes.json() : { data: [] };
                                if (formsData.data) {
                                    forms = forms.concat(formsData.data.map((f: any) => ({ id: f.id, name: f.name })));
                                }
                            } catch (e) {
                                console.warn(`[Wizard] Lead forms fetch error for page ${page.id}:`, e);
                            }
                        }
                    }

                    console.log(`[Wizard] Assets for ${accountId}:`, {
                        pages: pagesData.data?.length || 0,
                        pixels: pixelsData.data?.length || 0,
                        instagrams: instagrams.length,
                        forms: forms.length
                    });

                    return {
                        ...def,
                        pages: pagesData.data?.map((p: any) => ({ id: p.id, name: p.name, picture: p.picture?.data?.url })) || [],
                        pixels: pixelsData.data?.map((p: any) => ({ id: p.id, name: p.name, is_active: !p.is_unavailable })) || [],
                        instagrams,
                        forms,
                        isLoading: false,
                    };
                } catch (error) {
                    console.error(`[Wizard] Fatal error fetching assets for ${accountId}:`, error);
                    return { ...def, isLoading: false };
                }
            })
        );

        setAccountDefaults(updatedDefaults);
        setIsLoading(false);
    };

    const updateAccountDefault = (accountId: string, field: keyof AccountDefaults, value: any) => {
        setAccountDefaults(prev => prev.map(acc =>
            acc.accountId === accountId ? { ...acc, [field]: value } : acc
        ));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error(t('common.error', "User not authenticated"));

            const accountsToSave = adAccounts
                .filter(acc => selectedAccountIds.includes(acc.id))
                .map(acc => ({
                    id: acc.id,
                    name: acc.name,
                    user_id: user.id,
                    access_token: tempToken!,
                    currency: acc.currency,
                    status: 'ACTIVE',
                    business_id: selectedBusiness?.id || null
                }));

            const { error: accError } = await supabase.from('ad_accounts').upsert(accountsToSave);
            if (accError) throw accError;

            const settingsToSave = accountDefaults.map(def => ({
                ad_account_id: def.accountId,
                account_type: def.accountType,
                default_page_id: def.defaultPageId || null,
                default_page_name: def.defaultPageName || null,
                default_instagram_id: def.defaultInstagramId || null,
                default_instagram_name: def.defaultInstagramName || null,
                default_pixel_id: def.defaultPixelId || null,
                default_pixel_name: def.defaultPixelName || null,
                default_domain: def.defaultDomain || null,
                default_form_id: def.defaultFormId || null,
                default_form_name: def.defaultFormName || null,
                risk_threshold: 0.2,
                target_value: 3.0,
                primary_kpi: 'ROAS',
            }));

            if (settingsToSave.length > 0) {
                await (supabase as any).from('account_settings').upsert(settingsToSave, { onConflict: 'ad_account_id' });
            }

            accountsToSave.forEach(async (acc) => {
                supabase.functions.invoke('sync-meta-campaigns', {
                    body: { accountId: acc.id, accessToken: tempToken }
                });
            });

            toast({ title: t('connections.wizard.toasts.configured', "Accounts Configured!"), description: t('connections.wizard.toasts.accounts_added', { count: accountsToSave.length, defaultValue: `${accountsToSave.length} accounts added.` }) });
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: t('connections.wizard.toasts.save_error', "Error saving"), description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {wizardStep === 'BUSINESS_SELECT' && t('connections.wizard.select_bm', "Select Business Manager")}
                        {wizardStep === 'ACCOUNT_SELECT' && t('connections.wizard.accounts_in', { name: selectedBusiness?.name, defaultValue: `Accounts in ${selectedBusiness?.name}` })}
                        {wizardStep === 'CONFIGURE_DEFAULTS' && t('connections.wizard.configure_defaults', "Configure Default Assets")}
                        {wizardStep === 'IDLE' && t('connections.wizard.title', "Add Accounts")}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    {isLoading && wizardStep !== 'CONFIGURE_DEFAULTS' ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground italic">{t('connections.wizard.loading_meta', 'Loading Meta data...')}</p>
                        </div>
                    ) : (
                        <>
                            {wizardStep === 'BUSINESS_SELECT' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {businesses.map((biz) => (
                                        <Card
                                            key={biz.id}
                                            className="cursor-pointer hover:border-primary/50 transition-colors"
                                            onClick={() => handleBusinessSelect(biz)}
                                        >
                                            <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-4">
                                                {biz.profile_picture_uri ? (
                                                    <img src={biz.profile_picture_uri} alt={`Logo ${biz.name}`} className="w-10 h-10 rounded-full" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                                                        {biz.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <CardTitle className="text-sm">{biz.name}</CardTitle>
                                                    <p className="text-[10px] text-muted-foreground">ID: {biz.id}</p>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {wizardStep === 'ACCOUNT_SELECT' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                                        {adAccounts.map((acc) => {
                                            const isSelected = selectedAccountIds.includes(acc.id);
                                            const isAlreadyAdded = existingAccountIds.has(acc.id) || existingAccountIds.has(`act_${acc.id}`);

                                            return (
                                                <div
                                                    key={acc.id}
                                                    className={`p-3 border rounded-lg flex items-center justify-between transition-all ${isAlreadyAdded ? 'opacity-50 grayscale cursor-not-allowed bg-muted' :
                                                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent cursor-pointer'
                                                        }`}
                                                    onClick={() => {
                                                        if (isAlreadyAdded) return;
                                                        if (isSelected) setSelectedAccountIds(prev => prev.filter(id => id !== acc.id));
                                                        else setSelectedAccountIds(prev => [...prev, acc.id]);
                                                    }}
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold flex items-center gap-2">
                                                            {acc.name}
                                                            {isAlreadyAdded && <Badge variant="secondary" className="text-[8px] h-4">{t('connections.wizard.already_added', 'Already added')}</Badge>}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">ID: {acc.account_id} • {acc.currency}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                                                        {isSelected && <span className="text-white text-[10px]">✓</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        className="w-full h-11"
                                        disabled={selectedAccountIds.length === 0}
                                        onClick={proceedToConfigureDefaults}
                                    >
                                        {t('connections.wizard.continue_selected', { count: selectedAccountIds.length, defaultValue: `Continue (${selectedAccountIds.length} selected)` })}
                                    </Button>
                                    <Button variant="ghost" className="w-full" onClick={() => setWizardStep('BUSINESS_SELECT')}>
                                        {t('connections.wizard.back', 'Back')}
                                    </Button>
                                </div>
                            )}

                            {wizardStep === 'CONFIGURE_DEFAULTS' && (
                                <div className="space-y-6">
                                    {accountDefaults.map((acc) => (
                                        <Card key={acc.accountId} className="overflow-hidden border-border/50">
                                            <CardHeader className="bg-muted/30 py-2 px-4 flex flex-row items-center justify-between">
                                                <CardTitle className="text-sm font-bold truncate max-w-[200px]">{acc.accountName}</CardTitle>
                                                <Badge variant="outline" className="text-[9px]">{acc.accountId.replace('act_', '')}</Badge>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-4">
                                                {acc.isLoading ? (
                                                    <div className="flex items-center gap-2 py-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span className="text-xs text-muted-foreground italic">{t('connections.wizard.syncing_assets', 'Syncing assets...')}</span>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">{t('connections.wizard.type', 'Type')}</label>
                                                            <div className="flex gap-1.5">
                                                                {(['ecom', 'leads', 'infoproduto'] as AccountType[]).map(type => (
                                                                    <Button
                                                                        key={type}
                                                                        variant={acc.accountType === type ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => updateAccountDefault(acc.accountId, 'accountType', type)}
                                                                        className="h-8 px-2 text-[10px]"
                                                                    >
                                                                        {type === 'ecom' ? 'Ecommerce' : type === 'leads' ? 'Leads' : 'Infoproduto'}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">{t('connections.wizard.default_page', 'Default Page')}</label>
                                                            <Select value={acc.defaultPageId} onValueChange={(val) => {
                                                                const p = acc.pages.find(x => x.id === val);
                                                                updateAccountDefault(acc.accountId, 'defaultPageId', val);
                                                                updateAccountDefault(acc.accountId, 'defaultPageName', p?.name || '');
                                                            }}>
                                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('connections.wizard.select_placeholder', 'Select...')} /></SelectTrigger>
                                                                <SelectContent>
                                                                    {acc.pages.map(p => (
                                                                        <SelectItem key={p.id} value={p.id} className="text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                {p.picture && <img src={p.picture} alt="" className="w-4 h-4 rounded-full" />}
                                                                                <span>{p.name}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">{t('connections.wizard.default_instagram', 'Default Instagram')}</label>
                                                            <Select value={acc.defaultInstagramId} onValueChange={(val) => {
                                                                const ig = acc.instagrams.find(x => x.id === val);
                                                                updateAccountDefault(acc.accountId, 'defaultInstagramId', val);
                                                                updateAccountDefault(acc.accountId, 'defaultInstagramName', ig?.name || '');
                                                            }}>
                                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('connections.wizard.select_placeholder', 'Select...')} /></SelectTrigger>
                                                                <SelectContent>
                                                                    {acc.instagrams.map(i => (
                                                                        <SelectItem key={i.id} value={i.id} className="text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                {i.picture && <img src={i.picture} alt="" className="w-4 h-4 rounded-full" />}
                                                                                <span>@{i.name}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">{t('connections.wizard.default_pixel', 'Default Pixel')}</label>
                                                            <Select value={acc.defaultPixelId} onValueChange={(val) => {
                                                                const pixel = acc.pixels.find(x => x.id === val);
                                                                updateAccountDefault(acc.accountId, 'defaultPixelId', val);
                                                                updateAccountDefault(acc.accountId, 'defaultPixelName', pixel?.name || '');
                                                            }}>
                                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('connections.wizard.select_placeholder', 'Select...')} /></SelectTrigger>
                                                                <SelectContent>
                                                                    {acc.pixels.map(p => (
                                                                        <SelectItem key={p.id} value={p.id} className="text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                                <span>{p.name}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5 md:col-span-2">
                                                            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">{t('connections.wizard.default_url', 'Default URL')}</label>
                                                            <Input
                                                                className="h-9 text-xs"
                                                                placeholder="https://..."
                                                                value={acc.defaultDomain}
                                                                onChange={(e) => updateAccountDefault(acc.accountId, 'defaultDomain', e.target.value)}
                                                            />
                                                        </div>
                                                        {acc.accountType === 'leads' && (
                                                            <div className="space-y-1.5 md:col-span-2">
                                                                <label className="text-[10px] font-bold uppercase text-muted-foreground/70">{t('connections.wizard.lead_form', 'Lead Form')}</label>
                                                                <Select value={acc.defaultFormId} onValueChange={(val) => {
                                                                    const f = acc.forms.find(x => x.id === val);
                                                                    updateAccountDefault(acc.accountId, 'defaultFormId', val);
                                                                    updateAccountDefault(acc.accountId, 'defaultFormName', f?.name || '');
                                                                }}>
                                                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('connections.wizard.select_form_placeholder', 'Select form...')} /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {acc.forms.map(f => (
                                                                            <SelectItem key={f.id} value={f.id} className="text-xs">
                                                                                {f.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button className="w-full h-11" onClick={handleSave} disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {t('connections.wizard.save_and_finish', 'Save All and Finish')}
                                    </Button>
                                    <Button variant="ghost" className="w-full" onClick={() => setWizardStep('ACCOUNT_SELECT')}>
                                        {t('connections.wizard.back', 'Back')}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
