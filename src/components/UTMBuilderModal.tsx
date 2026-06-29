import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Wand2, Check, Info, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { useTranslation, Trans } from 'react-i18next';

interface UTMBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    adId: string;
    adName: string;
    campaignName?: string;
    adsetName?: string;
    onApply?: () => void;
}

// Variáveis dinâmicas disponíveis no Meta Ads
const dynamicVariables = [
    { key: '{{campaign.id}}', label: 'ID da Campanha', description: 'ID único da campanha' },
    { key: '{{campaign.name}}', label: 'Nome da Campanha', description: 'Nome da campanha' },
    { key: '{{adset.id}}', label: 'ID do Conjunto', description: 'ID único do conjunto de anúncios' },
    { key: '{{adset.name}}', label: 'Nome do Conjunto', description: 'Nome do conjunto de anúncios' },
    { key: '{{ad.id}}', label: 'ID do Anúncio', description: 'ID único do anúncio' },
    { key: '{{ad.name}}', label: 'Nome do Anúncio', description: 'Nome do anúncio' },
    { key: '{{placement}}', label: 'Posicionamento', description: 'Feed, Stories, Reels, etc.' },
    { key: '{{site_source_name}}', label: 'Origem', description: 'fb, ig, an, msg' },
];

// UTM padrão recomendado
const DEFAULT_UTM = `utm_source=facebook&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{placement}}`;

export function UTMBuilderModal({
    isOpen,
    onClose,
    adId,
    adName,
    campaignName,
    adsetName,
    onApply
}: UTMBuilderModalProps) {
    const { selectedAccountId } = useDashboard();
    const { toast } = useToast();
    const { t } = useTranslation();
    const [utmValue, setUtmValue] = useState(DEFAULT_UTM);
    const [isApplying, setIsApplying] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerateDefault = useCallback(() => {
        setUtmValue(DEFAULT_UTM);
    }, []);

    const handleInsertVariable = useCallback((variable: string) => {
        setUtmValue(prev => prev + variable);
    }, []);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(utmValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: t('common.toasts.copied', 'Copied!'), description: t('common.toasts.copied_desc', 'UTM copied to clipboard.') });
    }, [utmValue, toast, t]);

    const handleApply = useCallback(async () => {
        if (!utmValue.trim()) {
            toast({ title: t('common.error', 'Error'), description: t('insights.utm.error_empty', 'Please enter UTM parameters.'), variant: 'destructive' });
            return;
        }

        setIsApplying(true);
        try {
            const { error } = await supabase.functions.invoke('manage-meta-campaign', {
                body: {
                    action: 'update_url_tags',
                    entityType: 'ad',
                    entityId: adId,
                    value: utmValue,
                    accountId: selectedAccountId
                }
            });

            if (error) throw error;

            toast({
                title: t('insights.utm.success_title', 'UTM Applied!'),
                description: t('insights.utm.success_desc', { name: adName })
            });

            onApply?.();
            onClose();
        } catch (err: any) {
            console.error('[UTMBuilderModal] Error applying UTM:', err);
            toast({
                title: t('insights.utm.error_apply', 'Error applying UTM'),
                description: err.message || t('insights.utm.error_apply_desc', 'Could not update the ad.'),
                variant: 'destructive'
            });
        } finally {
            setIsApplying(false);
        }
    }, [utmValue, adId, adName, selectedAccountId, toast, onApply, onClose]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-primary" />
                        {t('insights.utm.title', 'Configure UTM Tracking')}
                    </DialogTitle>
                    <DialogDescription>
                        <Trans i18nKey="insights.utm.desc" values={{ name: adName }}>
                            Add UTM parameters to track conversions for ad <strong>"{adName}"</strong>.
                        </Trans>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Info Banner */}
                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-blue-700 dark:text-blue-300">
                                {t('insights.utm.banner', 'Use dynamic variables to automatically insert campaign information.')}
                            </p>
                        </div>
                    </div>

                    {/* Campaign Context */}
                    {(campaignName || adsetName) && (
                        <div className="flex flex-wrap gap-2 text-xs">
                            {campaignName && (
                                <Badge variant="secondary" className="font-normal">
                                    {t('insights.utm.campaign_label', { name: campaignName })}
                                </Badge>
                            )}
                            {adsetName && (
                                <Badge variant="secondary" className="font-normal">
                                    {t('insights.utm.adset_label', { name: adsetName })}
                                </Badge>
                            )}
                        </div>
                    )}

                    {/* UTM Input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">{t('insights.utm.url_params', 'URL Parameters')}</label>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-7 px-2 text-xs"
                                >
                                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                    {copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateDefault}
                                    className="h-7 px-2 text-xs"
                                >
                                    <Wand2 className="w-3 h-3 mr-1" />
                                    {t('insights.utm.generate_default', 'Generate Default')}
                                </Button>
                            </div>
                        </div>
                        <Textarea
                            value={utmValue}
                            onChange={(e) => setUtmValue(e.target.value)}
                            placeholder="utm_source=facebook&utm_medium=..."
                            className="font-mono text-xs min-h-[100px] resize-none"
                        />
                    </div>

                    {/* Dynamic Variables */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('insights.utm.dynamic_vars', 'Available Dynamic Variables')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {dynamicVariables.map((variable) => (
                                <Button
                                    key={variable.key}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleInsertVariable(variable.key)}
                                    className="h-7 px-2 text-xs font-mono hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                                    title={variable.description}
                                >
                                    {variable.key}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('insights.utm.click_to_insert', 'Click a variable to insert it into the field above.')}
                        </p>
                    </div>

                    {/* Preview */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('insights.utm.url_preview', 'URL Preview')}</label>
                        <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono break-all text-muted-foreground">
                            https://seusite.com/pagina?<span className="text-foreground">{utmValue || '...'}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isApplying}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleApply} disabled={isApplying || !utmValue.trim()}>
                        {isApplying ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('insights.utm.applying', 'Applying...')}
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                {t('insights.utm.apply', 'Apply UTM')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
