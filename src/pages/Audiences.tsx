import { useSavedAudiences } from "@/hooks/useSavedAudiences";
import { useMetaAudiences } from "@/hooks/useMetaAudiences";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Trash2, Users, Database, Globe, RefreshCw, Loader2, Filter } from "lucide-react";
import metaIcon from "@/assets/meta.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

export default function Audiences() {
    const { t, i18n } = useTranslation();
    const { savedAudiences, deleteAudience } = useSavedAudiences();
    const { metaAudiences, isLoading: isMetaLoading, error: metaError, deleteMetaAudience } = useMetaAudiences();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("all");

    const handleLocalDelete = (id: string) => {
        deleteAudience(id);
        toast({
            title: t('audiences.delete.local_success_title', 'Audience deleted'),
            description: t('audiences.delete.local_success_desc', 'The locally saved audience was removed.'),
        });
    };

    const handleMetaDelete = async (id: string, name: string) => {
        const confirmMsg = t('audiences.delete.confirm', { name, defaultValue: `Are you sure you want to delete audience "${name}" from Meta Ads? This action cannot be undone.` });
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            await deleteMetaAudience(id);
            toast({
                title: t('audiences.delete.success', 'Audience deleted'),
                description: t('audiences.delete.success_desc', { name, defaultValue: `Audience "${name}" was successfully removed from Meta Ads.` }),
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: t('common.error', 'Error'),
                description: error.message || t('audiences.delete.error_desc', "Could not delete audience from Meta Ads."),
            });
        }
    };

    // ... existing helpers ...
    const getBadgeVariant = (type: string) => {
        const normalizedType = type?.toUpperCase() || 'UNKNOWN';
        switch (normalizedType) {
            case 'LOOKALIKE': return 'default'; // dark/primary
            case 'CUSTOM': return 'secondary';
            case 'SAVED': return 'outline';
            default: return 'outline';
        }
    };

    const getSourceIcon = (origin: string) => {
        if (origin === 'META') return <img src={metaIcon} className="w-4 h-4" alt="Meta" />;
        return <Database className="w-3 h-3" />;
    };

    const getSourceLabel = (origin: string) => {
        if (origin === 'META') return 'Meta';
        return t('audiences.tabs.local', 'Local (App)');
    };

    const formatAudienceDescription = (audience: any) => {
        if (audience.origin === 'LOCAL') {
            return JSON.stringify(audience.targeting).slice(0, 100);
        }

        // Meta Audience Parsing
        try {
            // 1. Lookalike
            if (audience.subtype === 'LOOKALIKE' || (audience.lookalike_spec)) {
                const spec = typeof audience.lookalike_spec === 'string' ? JSON.parse(audience.lookalike_spec) : audience.lookalike_spec;
                if (spec) {
                    const ratio = spec.ratio ? Math.round(spec.ratio * 100) + '%' : '';
                    const country = spec.country || '';
                    const originName = spec.origin && spec.origin[0] ? `- ${t('audiences.base', 'Base')}: ${spec.origin[0].name}` : '';
                    return `${t('audiences.lookalike', 'Lookalike')} ${ratio} (${country}) ${originName}`;
                }
                return t('audiences.lookalike', 'Lookalike');
            }

            // 2. Saved Audience (Targeting)
            if (audience.subtype === 'SAVED' || audience.targeting) {
                const t_data = audience.targeting;
                if (t_data) {
                    const age = `${t_data.age_min || 18}-${t_data.age_max || 65}`;
                    const gender = t_data.genders ? (t_data.genders[0] === 1 ? t('audiences.gender.men', 'Men') : t('audiences.gender.women', 'Women')) : t('audiences.gender.all', 'All');

                    let interests = '';
                    if (t_data.flexible_spec && t_data.flexible_spec[0] && t_data.flexible_spec[0].interests) {
                        interests = ' • ' + t_data.flexible_spec[0].interests.map((i: any) => i.name).slice(0, 3).join(', ');
                    }

                    const location = t_data.geo_locations ? (t_data.geo_locations.countries ? t_data.geo_locations.countries.join(', ') : t('audiences.custom_location', 'Custom Location')) : '';

                    return `${age} ${t('common.years', 'years')} • ${gender} • ${location}${interests}`;
                }
            }

            // 3. Website/Event Custom Audience (Rule)
            if (audience.rule) {
                const ruleStr = typeof audience.rule === 'string' ? audience.rule : JSON.stringify(audience.rule);

                const retention = audience.retention_days ? ` (${audience.retention_days} ${t('common.days', 'days')})` : '';

                if (ruleStr.includes('InitiateCheckout')) return `${t('audiences.rules.checkout', 'Initiate Checkout / Payment')}${retention}`;
                if (ruleStr.includes('AddPaymentInfo')) return `${t('audiences.rules.payment_info', 'Add Payment Info')}${retention}`;
                if (ruleStr.includes('Purchase')) return `${t('audiences.rules.purchase', 'Purchase')}${retention}`;
                if (ruleStr.includes('Lead')) return `${t('audiences.rules.lead', 'Lead')}${retention}`;
                if (ruleStr.includes('PageView')) return `${t('audiences.rules.pageview', 'Page View')}${retention}`;
                if (ruleStr.includes('ViewContent')) return `${t('audiences.rules.viewcontent', 'View Content')}${retention}`;
                if (ruleStr.includes('AddToCart')) return `${t('audiences.rules.addtocart', 'Add to Cart')}${retention}`;

                // Fallback for generic website visitors (check URL param)
                if (ruleStr.includes('"url"')) return `${t('audiences.rules.visitors', 'Website Visitors')}${retention}`;
            }

        } catch (e) {
            console.error('Error parsing audience details:', e, audience);
        }

        return audience.description || '-';
    };

    // Filter logic
    const filteredAudiences = () => {
        const localFormatted = savedAudiences.map(a => ({
            ...a,
            type: t('audiences.types.draft', 'DRAFT'),
            origin: 'LOCAL',
            approximate_count: undefined,
            description: JSON.stringify(a.targeting).slice(0, 100)
        }));

        const metaFormatted = metaAudiences.map(a => ({
            ...a,
            origin: 'META',
            // Meta returns 'subtype' for lookalike/website, but sometimes just 'CUSTOM' in type.
            // Saved audiences have type/subtype 'SAVED'.
            displayType: a.subtype || a.type
        }));

        const all = [...localFormatted, ...metaFormatted];

        if (activeTab === 'all') return all;
        if (activeTab === 'meta') return metaFormatted;
        if (activeTab === 'local') return localFormatted;
        return all;
    };

    const audiences = filteredAudiences();

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="pt-8 px-2 sm:px-4 pb-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('audiences.title', 'Audiences')}</h1>
                        <p className="text-muted-foreground mt-2">
                            {t('audiences.subtitle', 'View and manage all your Meta Ads audiences and local drafts.')}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <TabsList className="h-10 inline-flex">
                            <TabsTrigger value="all" className="font-semibold">{t('audiences.tabs.all', 'All Audiences')}</TabsTrigger>
                            <TabsTrigger value="meta" className="flex items-center gap-2 font-semibold">
                                <img src={metaIcon} className="w-4 h-4" alt="Meta" /> Meta
                            </TabsTrigger>
                            <TabsTrigger value="local" className="flex items-center gap-2 font-semibold">
                                <Database className="w-3 h-3" /> {t('audiences.tabs.local', 'Locally Saved')}
                            </TabsTrigger>
                        </TabsList>

                        {isMetaLoading && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> {t('common.syncing', 'Syncing from Meta...')}
                            </div>
                        )}
                    </div>
                </div>

                <TabsContent value={activeTab} className="mt-0">
                    <Card className="rounded-lg border-x-0 sm:border-x">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {t('audiences.list_title', 'Audience List')} ({audiences.length})
                            </CardTitle>
                            <CardDescription>
                                {activeTab === 'all' && t('audiences.descriptions.all', "Displaying audiences from your ad account and local drafts.")}
                                {activeTab === 'meta' && t('audiences.descriptions.meta', "Displaying only audiences synced with Meta Ads.")}
                                {activeTab === 'local' && t('audiences.descriptions.local', "Displaying only audience drafts saved on this computer.")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {audiences.length === 0 ? (
                                <div className="text-center py-12 border rounded-none border-dashed">
                                    <div className="flex justify-center mb-4">
                                        <div className="bg-muted p-4 rounded-none">
                                            <Filter className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-medium">{t('audiences.empty', 'No audiences found')}</h3>
                                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                                        {isMetaLoading ? t('common.loading', "Fetching information...") : t('common.no_data', "We couldn't find any audiences with this filter.")}
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-none border overflow-x-auto">
                                    <Table className="min-w-[700px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="border-r border-border/20 last:border-r-0">{t('common.name', 'Name')}</TableHead>
                                                <TableHead className="border-r border-border/20 last:border-r-0">{t('common.type', 'Type')}</TableHead>
                                                <TableHead className="border-r border-border/20 last:border-r-0">{t('common.source', 'Source')}</TableHead>
                                                <TableHead className="hidden md:table-cell border-r border-border/20 last:border-r-0">{t('common.details', 'Details')}</TableHead>
                                                <TableHead className="border-r border-border/20 last:border-r-0">{t('common.size', 'Size')}</TableHead>
                                                <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {audiences.map((audience: any) => (
                                                <TableRow key={`${audience.origin}-${audience.id}`}>
                                                    <TableCell className="font-medium border-r border-border/20">
                                                        <div className="flex flex-col">
                                                            <span className={audience.origin === 'META' ? "text-foreground font-semibold" : "text-foreground/90 font-medium"}>
                                                                {audience.name}
                                                            </span>
                                                            {audience.time_created && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {/** 
                                                                     * Meta returns `time_created` in seconds (unix timestamp). 
                                                                     * Javascript Date expects milliseconds, so we multiply by 1000 if it's a number/timestamp string 
                                                                     */}
                                                                    {format(new Date(typeof audience.time_created === 'number' || !String(audience.time_created).includes('-') ? Number(audience.time_created) * 1000 : audience.time_created), i18n.language.startsWith('pt') ? "dd/MM/yyyy" : "MM/dd/yyyy", { locale: i18n.language.startsWith('pt') ? ptBR : enUS })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="border-r border-border/20">
                                                        <span className="text-xs font-medium text-muted-foreground uppercase">
                                                            {audience.displayType || audience.type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="border-r border-border/20">
                                                        <div className={`flex items-center gap-1 text-xs font-medium ${audience.origin === 'META' ? "text-muted-foreground" : "text-muted-foreground"}`}>
                                                            {getSourceIcon(audience.origin)} {getSourceLabel(audience.origin)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell max-w-[300px] lg:max-w-[400px] truncate text-xs text-muted-foreground border-r border-border/20" title={formatAudienceDescription(audience)}>
                                                        {formatAudienceDescription(audience)}
                                                    </TableCell>
                                                    <TableCell className="text-xs border-r border-border/20">
                                                        {audience.approximate_count ? audience.approximate_count.toLocaleString() : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {audience.origin === 'LOCAL' ? (
                                                            <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => handleLocalDelete(audience.id)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="hover:text-destructive"
                                                                onClick={() => handleMetaDelete(audience.id, audience.name)}
                                                                title={t('audiences.delete.button_title', "Delete audience from Meta Ads")}
                                                            >
                                                                < Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* Helper content for other tabs reused via logic above */}
            </div>
        </Tabs>
    );
}
