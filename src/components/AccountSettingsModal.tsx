import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings, CheckCircle2, ShoppingCart, FileText, BookOpen, Globe, Instagram, Activity, Link, Shield, Sliders } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/contexts/ChatContext';
import { AccountGovernanceForm } from "@/components/AccountGovernanceForm";
import { useTranslation } from 'react-i18next';

interface PageOption {
    id: string;
    name: string;
    picture?: string;
}

interface PixelOption {
    id: string;
    name: string;
    is_active?: boolean;
}

interface InstagramOption {
    id: string;
    name: string;
    picture?: string;
}

interface FormOption {
    id: string;
    name: string;
    status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
}

type AccountType = 'ecom' | 'leads' | 'infoproduto';

interface AccountSettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId?: string;
}

export function AccountSettingsModal({ open, onOpenChange, accountId }: AccountSettingsModalProps) {
    const { selectedAccountId } = useDashboard();
    const { toast } = useToast();
    const { refreshAccountDefaults } = useChat();
    const { t } = useTranslation();

    const effectiveAccountId = accountId || selectedAccountId;

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("general");

    // Options fetched from Meta API
    const [pages, setPages] = useState<PageOption[]>([]);
    const [pixels, setPixels] = useState<PixelOption[]>([]);
    const [instagrams, setInstagrams] = useState<InstagramOption[]>([]);
    const [forms, setForms] = useState<FormOption[]>([]);

    // Selected defaults
    const [accountType, setAccountType] = useState<AccountType>('ecom');
    const [defaultPageId, setDefaultPageId] = useState<string>('');
    const [defaultPixelId, setDefaultPixelId] = useState<string>('');
    const [defaultInstagramId, setDefaultInstagramId] = useState<string>('');
    const [defaultFormId, setDefaultFormId] = useState<string>('');
    const [defaultDomain, setDefaultDomain] = useState<string>('');

    useEffect(() => {
        if (open && effectiveAccountId) {
            fetchOptionsAndSettings();
        }
    }, [open, effectiveAccountId]);

    const fetchOptionsAndSettings = async () => {
        if (!effectiveAccountId) return;

        setIsLoading(true);
        try {
            // Get access token
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', effectiveAccountId)
                .single();

            if (!accountData?.access_token) {
                throw new Error(t('common.toasts.token_not_found', 'Access token not found.'));
            }

            const token = accountData.access_token;
            const apiAccountId = effectiveAccountId.startsWith('act_') ? effectiveAccountId : `act_${effectiveAccountId}`;

            // Fetch Pages with picture
            const pagesRes = await fetch(
                `https://graph.facebook.com/v24.0/${apiAccountId}/promote_pages?fields=id,name,picture{url}&access_token=${token}`
            );
            const pagesData = pagesRes.ok ? await pagesRes.json() : { data: [] };
            const fetchedPages = pagesData.data?.map((p: any) => ({
                id: p.id,
                name: p.name,
                picture: p.picture?.data?.url
            })) || [];
            setPages(fetchedPages);

            // Fetch Pixels with status
            const pixelsRes = await fetch(
                `https://graph.facebook.com/v24.0/${apiAccountId}/adspixels?fields=id,name,is_unavailable&access_token=${token}`
            );
            const pixelsData = pixelsRes.ok ? await pixelsRes.json() : { data: [] };
            setPixels(pixelsData.data?.map((p: any) => ({
                id: p.id,
                name: p.name,
                is_active: !p.is_unavailable
            })) || []);

            // Fetch Instagram accounts (from pages)
            let fetchedInstagrams: InstagramOption[] = [];
            for (const page of fetchedPages.slice(0, 3)) {
                try {
                    const igRes = await fetch(
                        `https://graph.facebook.com/v24.0/${page.id}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${token}`
                    );
                    const igData = igRes.ok ? await igRes.json() : null;
                    if (igData?.instagram_business_account) {
                        fetchedInstagrams.push({
                            id: igData.instagram_business_account.id,
                            name: igData.instagram_business_account.username || page.name,
                            picture: igData.instagram_business_account.profile_picture_url
                        });
                    }
                } catch (e) {
                    console.warn('Error fetching IG:', e);
                }
            }
            setInstagrams(fetchedInstagrams);

            // Fetch Lead Forms from ALL pages (not just first 3)
            let fetchedForms: FormOption[] = [];
            console.log(`[AccountSettings] Fetching lead forms from ${fetchedPages.length} pages...`);

            for (const page of fetchedPages) {
                try {
                    console.log(`[AccountSettings] Fetching forms from page: ${page.name} (${page.id})`);
                    const formsRes = await fetch(
                        `https://graph.facebook.com/v24.0/${page.id}/leadgen_forms?fields=id,name,status&access_token=${token}`
                    );

                    if (!formsRes.ok) {
                        const errorData = await formsRes.json();
                        console.warn(`[AccountSettings] Forms API error for page ${page.name}:`, errorData.error?.message || 'Unknown error');
                        continue;
                    }

                    const formsData = await formsRes.json();

                    if (formsData.error) {
                        console.warn(`[AccountSettings] Forms error for page ${page.name}:`, formsData.error.message);
                        continue;
                    }

                    if (formsData.data && formsData.data.length > 0) {
                        const pageForms = formsData.data
                            .filter((f: any) => f.status !== 'DELETED') // Exclude deleted forms
                            .map((f: any) => ({
                                id: f.id,
                                name: f.name,
                                status: f.status
                            }));
                        console.log(`[AccountSettings] Found ${pageForms.length} forms in page ${page.name}`);
                        fetchedForms = fetchedForms.concat(pageForms);
                    }
                } catch (e) {
                    console.warn(`[AccountSettings] Error fetching forms from page ${page.name}:`, e);
                }
            }

            console.log(`[AccountSettings] Total lead forms found: ${fetchedForms.length}`);
            setForms(fetchedForms);

            // Fetch existing settings from DB
            const { data: settings } = await (supabase as any)
                .from('account_settings')
                .select('account_type, default_page_id, default_pixel_id, default_instagram_id, default_form_id, default_domain')
                .eq('ad_account_id', effectiveAccountId)
                .maybeSingle();

            if (settings) {
                setAccountType((settings.account_type as AccountType) || 'ecom');
                setDefaultPageId(settings.default_page_id || '');
                setDefaultPixelId(settings.default_pixel_id || '');
                setDefaultInstagramId(settings.default_instagram_id || '');
                setDefaultFormId(settings.default_form_id || '');
                setDefaultDomain(settings.default_domain || '');
            }

        } catch (error: any) {
            console.error('Erro ao carregar opções:', error);
            toast({
                title: t('settings.errors.fetch_error', 'Error loading settings'),
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!effectiveAccountId) return;

        setIsSaving(true);
        try {
            const selectedPage = pages.find(p => p.id === defaultPageId);
            const selectedPixel = pixels.find(p => p.id === defaultPixelId);
            const selectedInstagram = instagrams.find(i => i.id === defaultInstagramId);
            const selectedForm = forms.find(f => f.id === defaultFormId);

            // First check if record exists to preserve existing KPI settings
            const { data: existing } = await (supabase as any)
                .from('account_settings')
                .select('target_value, risk_threshold, primary_kpi')
                .eq('ad_account_id', effectiveAccountId)
                .maybeSingle();

            const upsertData = {
                ad_account_id: effectiveAccountId,
                account_type: accountType,
                default_page_id: defaultPageId || null,
                default_page_name: selectedPage?.name || null,
                default_pixel_id: defaultPixelId || null,
                default_pixel_name: selectedPixel?.name || null,
                default_instagram_id: defaultInstagramId || null,
                default_instagram_name: selectedInstagram?.name || null,
                default_form_id: defaultFormId || null,
                default_form_name: selectedForm?.name || null,
                default_domain: defaultDomain || null,
                // REQUIRED: Always provide these (use existing or defaults)
                primary_kpi: existing?.primary_kpi || 'ROAS',
                target_value: existing?.target_value ?? 3.0,
                risk_threshold: existing?.risk_threshold ?? 0.2,
                updated_at: new Date().toISOString()
            };

            const { error } = await (supabase as any)
                .from('account_settings')
                .upsert(upsertData, { onConflict: 'ad_account_id' });

            if (error) throw error;

            toast({
                title: t('settings.toasts.save_success', 'Settings saved!'),
                description: t('settings.toasts.save_success_desc', 'Defaults will be used automatically in future campaigns.'),
            });

            await refreshAccountDefaults();
            onOpenChange(false);

        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            toast({
                title: t('settings.errors.save_error', 'Error saving'),
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-none">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Settings className="h-5 w-5 text-primary" />
                        {t('settings.account_settings', 'Account Settings')}
                    </DialogTitle>
                    <DialogDescription>
                        {effectiveAccountId && effectiveAccountId.startsWith('act_') ? `ID: ${effectiveAccountId.replace('act_', '')}` : t('settings.configure_defaults', 'Configure the defaults for this account.')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 rounded-none">
                        <TabsTrigger value="general" className="flex items-center gap-2 rounded-none">
                            <Sliders className="h-4 w-4" />
                            {t('common.general', 'General')}
                        </TabsTrigger>
                        <TabsTrigger value="governance" className="flex items-center gap-2 rounded-none">
                            <Shield className="h-4 w-4" />
                            {t('common.governance', 'Governance')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-5 py-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-2 text-muted-foreground">{t('common.loading_options', 'Loading options...')}</span>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Account Type */}
                                <div className="space-y-2">
                                    <Label>{t('settings.business_type', 'Business Type')}</Label>
                                    <div className="flex gap-2">
                                        {(['ecom', 'leads', 'infoproduto'] as AccountType[]).map(type => (
                                            <Button
                                                key={type}
                                                variant={accountType === type ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setAccountType(type)}
                                                className="gap-2 flex-1 rounded-none h-11"
                                            >
                                                {type === 'ecom' && <ShoppingCart className="h-4 w-4" />}
                                                {type === 'leads' && <FileText className="h-4 w-4" />}
                                                {type === 'infoproduto' && <BookOpen className="h-4 w-4" />}
                                                {type === 'ecom' ? 'E-commerce' : type === 'leads' ? 'Leads' : t('settings.type_infoproduct', 'Infoproduct')}
                                            </Button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('settings.business_type_desc', 'This adapts the interface and strategies to your model.')}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Default Page */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                                            <Globe className="h-3 w-3" />
                                            {t('common.page', 'Page')}
                                        </Label>
                                        <Select value={defaultPageId} onValueChange={setDefaultPageId}>
                                            <SelectTrigger className="rounded-none h-10">
                                                <SelectValue placeholder={t('common.select', 'Select...')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pages.map(page => (
                                                    <SelectItem key={page.id} value={page.id}>
                                                        <div className="flex items-center gap-2">
                                                            {page.picture ? (
                                                                <img src={page.picture} alt="" className="w-5 h-5 rounded-full" />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                                                    <Globe className="h-3 w-3 text-blue-500" />
                                                                </div>
                                                            )}
                                                            <span className="truncate max-w-[140px]">{page.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Default Instagram */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                                            <Instagram className="h-3 w-3" />
                                            {t('common.instagram', 'Instagram')}
                                        </Label>
                                        <Select value={defaultInstagramId} onValueChange={setDefaultInstagramId}>
                                            <SelectTrigger className="rounded-none h-10">
                                                <SelectValue placeholder={t('common.select', 'Select...')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {instagrams.map(ig => (
                                                    <SelectItem key={ig.id} value={ig.id}>
                                                        <div className="flex items-center gap-2">
                                                            {ig.picture ? (
                                                                <img src={ig.picture} alt="" className="w-5 h-5 rounded-full" />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 flex items-center justify-center">
                                                                    <Instagram className="h-3 w-3 text-white" />
                                                                </div>
                                                            )}
                                                            <span className="truncate max-w-[140px]">@{ig.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Default Pixel */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                                            <Activity className="h-3 w-3" />
                                            {t('common.pixel', 'Pixel')}
                                        </Label>
                                        <Select value={defaultPixelId} onValueChange={setDefaultPixelId}>
                                            <SelectTrigger className="rounded-none h-10">
                                                <SelectValue placeholder={t('common.select', 'Select...')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pixels.map(pixel => (
                                                    <SelectItem key={pixel.id} value={pixel.id}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${pixel.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                                                            <span className="truncate max-w-[140px]">{pixel.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Default Domain */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                                            <Link className="h-3 w-3" />
                                            {t('settings.main_domain', 'Main Domain')}
                                        </Label>
                                        <Input
                                            placeholder="https://meusite.com.br"
                                            value={defaultDomain}
                                            onChange={(e) => setDefaultDomain(e.target.value)}
                                            className="h-10 rounded-none border-border/50"
                                        />
                                    </div>
                                </div>

                                {/* Lead Form (only for leads accounts) */}
                                {accountType === 'leads' && (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-xs uppercase font-bold text-muted-foreground">
                                            <FileText className="h-3 w-3" />
                                            {t('settings.lead_form', 'Lead Form')}
                                        </Label>
                                        <Select value={defaultFormId} onValueChange={setDefaultFormId}>
                                            <SelectTrigger className="rounded-none h-10">
                                                <SelectValue placeholder={t('settings.select_form', 'Select form...')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {forms.length === 0 ? (
                                                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p>{t('settings.no_forms_found', 'No lead forms found.')}</p>
                                                        <p className="text-xs mt-1">{t('settings.create_form_hint', 'Create a form in Ads Manager first.')}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {forms.filter(f => f.status === 'ACTIVE').length > 0 && (
                                                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t('settings.active_forms', 'Active')}</div>
                                                        )}
                                                        {forms.filter(f => f.status === 'ACTIVE').map(form => (
                                                            <SelectItem key={form.id} value={form.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                                    <FileText className="h-4 w-4 text-orange-500" />
                                                                    <span>{form.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                        {forms.filter(f => f.status === 'ARCHIVED').length > 0 && (
                                                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">{t('settings.archived_forms', 'Archived')}</div>
                                                        )}
                                                        {forms.filter(f => f.status === 'ARCHIVED').map(form => (
                                                            <SelectItem key={form.id} value={form.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                                    <FileText className="h-4 w-4 text-gray-400" />
                                                                    <span className="text-muted-foreground">{form.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex justify-end pt-4 mt-4 border-t">
                            <Button onClick={handleSave} disabled={isLoading || isSaving} className="w-full sm:w-auto rounded-none h-11 px-8">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.saving', 'Saving...')}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        {t('settings.save_defaults', 'Save Defaults')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="governance">
                        <div className="py-2">
                            <AccountGovernanceForm />
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );

}
