import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDashboard } from "@/contexts/DashboardContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, AlertTriangle, Settings2, ChevronDown, ChevronRight, Target, TrendingDown, TrendingUp, DollarSign, MousePointer, User, Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AccountSettings {
    ad_account_id: string;
    primary_kpi: 'ROAS' | 'CPA' | 'CPL';
    target_value: number;
    risk_threshold: number;
    max_frequency: number;
    // Multiple KPIs support
    primary_kpis?: KpiEntry[];
    // Extended metrics
    target_ctr?: number;
    risk_ctr?: number;
    target_cpc?: number;
    risk_cpc?: number;
    target_cpm?: number;
    risk_cpm?: number;
    // Automation settings
    auto_pause_enabled?: boolean;
    auto_scale_enabled?: boolean;
    alert_sensitivity?: 'low' | 'medium' | 'high';
}

// New interface for multiple KPIs
interface KpiEntry {
    metric: 'ROAS' | 'CPA' | 'CPL';
    target: number;
    risk: number;
}

const MARKET_DEFAULTS = {
    ROAS: { target: 6.0, risk: 3.0, frequency: 3.0 },
    CPA: { target: 25.00, risk: 50.00, frequency: 3.0 },
    CPL: { target: 8.00, risk: 20.00, frequency: 4.0 }
};

interface AccountGovernanceFormProps {
    compact?: boolean; // For use in modals/drawers
}

export const AccountGovernanceForm = ({ compact = false }: AccountGovernanceFormProps) => {
    const { t } = useTranslation();
    const { selectedAccountId } = useDashboard();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Multiple KPIs state (new)
    const [primaryKpis, setPrimaryKpis] = useState<KpiEntry[]>([
        { metric: 'ROAS', target: 6.0, risk: 3.0 }
    ]);

    // Legacy single KPI (for backwards compat)
    const [primaryKpi, setPrimaryKpi] = useState<'ROAS' | 'CPA' | 'CPL'>('ROAS');
    const [targetValue, setTargetValue] = useState<string>("");
    const [riskThreshold, setRiskThreshold] = useState<string>("");
    const [maxFrequency, setMaxFrequency] = useState<string>("3.0");

    // Extended metrics
    const [targetCtr, setTargetCtr] = useState<string>("1.5");
    const [riskCtr, setRiskCtr] = useState<string>("0.5");
    const [targetCpc, setTargetCpc] = useState<string>("1.00");
    const [riskCpc, setRiskCpc] = useState<string>("3.00");
    const [targetCpm, setTargetCpm] = useState<string>("15.00");
    const [riskCpm, setRiskCpm] = useState<string>("40.00");

    // Support Info (Local Storage)
    const [supportEmail, setSupportEmail] = useState("");
    const [supportWhatsapp, setSupportWhatsapp] = useState("");

    // Automation
    const [autoPauseEnabled, setAutoPauseEnabled] = useState(false);
    const [autoScaleEnabled, setAutoScaleEnabled] = useState(false);
    const [alertSensitivity, setAlertSensitivity] = useState<'low' | 'medium' | 'high'>('medium');

    // UI state
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Fetch existing settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['account-settings', selectedAccountId],
        queryFn: async () => {
            if (!selectedAccountId) return null;
            const { data, error } = await (supabase as any)
                .from('account_settings')
                .select('*')
                .eq('ad_account_id', selectedAccountId)
                .maybeSingle();

            if (error) throw error;
            return data as AccountSettings | null;
        },
        enabled: !!selectedAccountId
    });

    // Populate form on load
    useEffect(() => {
        if (settings) {
            // Load multiple KPIs if available, otherwise fallback to single
            if (settings.primary_kpis && settings.primary_kpis.length > 0) {
                setPrimaryKpis(settings.primary_kpis);
            } else if (settings.primary_kpi && settings.target_value) {
                // Migrate from legacy single KPI
                setPrimaryKpis([{
                    metric: settings.primary_kpi,
                    target: settings.target_value,
                    risk: settings.risk_threshold
                }]);
            }

            // Legacy fields
            setPrimaryKpi(settings.primary_kpi);
            setTargetValue(settings.target_value.toString());
            setRiskThreshold(settings.risk_threshold.toString());
            setMaxFrequency(settings.max_frequency.toString());
            setTargetCtr(settings.target_ctr?.toString() || "1.5");
            setRiskCtr(settings.risk_ctr?.toString() || "0.5");
            setTargetCpc(settings.target_cpc?.toString() || "1.00");
            setRiskCpc(settings.risk_cpc?.toString() || "3.00");
            setTargetCpm(settings.target_cpm?.toString() || "15.00");
            setRiskCpm(settings.risk_cpm?.toString() || "40.00");
            setAutoPauseEnabled(settings.auto_pause_enabled || false);
            setAutoScaleEnabled(settings.auto_scale_enabled || false);
            setAlertSensitivity(settings.alert_sensitivity || 'medium');
        } else {
            // Defaults
            setPrimaryKpis([{ metric: 'ROAS', target: 6.0, risk: 3.0 }]);
            setPrimaryKpi('ROAS');
            setTargetValue("");
            setRiskThreshold("");
            setMaxFrequency("3.0");
        }


        // Load support info from local storage
        const savedEmail = localStorage.getItem('lads_support_email');
        const savedWhatsapp = localStorage.getItem('lads_support_whatsapp');
        if (savedEmail) setSupportEmail(savedEmail);
        if (savedWhatsapp) setSupportWhatsapp(savedWhatsapp);
    }, [settings]);

    // Helper functions for multiple KPIs
    const addKpi = () => {
        if (primaryKpis.length >= 4) return; // Max 4 KPIs
        const usedMetrics = primaryKpis.map(k => k.metric);
        const availableMetric = (['ROAS', 'CPA', 'CPL'] as const).find(m => !usedMetrics.includes(m)) || 'ROAS';
        const defaults = MARKET_DEFAULTS[availableMetric];
        setPrimaryKpis([...primaryKpis, { metric: availableMetric, target: defaults.target, risk: defaults.risk }]);
    };

    const removeKpi = (index: number) => {
        if (primaryKpis.length <= 1) return; // Keep at least 1
        setPrimaryKpis(primaryKpis.filter((_, i) => i !== index));
    };

    const updateKpi = (index: number, field: keyof KpiEntry, value: any) => {
        const updated = [...primaryKpis];
        if (field === 'metric') {
            const defaults = MARKET_DEFAULTS[value as 'ROAS' | 'CPA' | 'CPL'];
            updated[index] = { metric: value, target: defaults.target, risk: defaults.risk };
        } else {
            updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
        }
        setPrimaryKpis(updated);
    };

    const handleKpiChange = (newKpi: 'ROAS' | 'CPA' | 'CPL') => {
        setPrimaryKpi(newKpi);
        const defaults = MARKET_DEFAULTS[newKpi];
        setTargetValue(defaults.target.toString());
        setRiskThreshold(defaults.risk.toString());
        setMaxFrequency(defaults.frequency.toString());
        toast({
            title: t('governance.toasts.defaults_applied', 'Default Values Applied'),
            description: t('governance.toasts.defaults_applied_desc', { kpi: newKpi }),
        });
    };

    const mutation = useMutation({
        mutationFn: async () => {
            if (!selectedAccountId) throw new Error("No account selected");

            const payload = {
                ad_account_id: selectedAccountId,
                primary_kpi: primaryKpis[0]?.metric || primaryKpi,
                target_value: primaryKpis[0]?.target || parseFloat(targetValue),
                risk_threshold: primaryKpis[0]?.risk || parseFloat(riskThreshold),
                primary_kpis: primaryKpis,
                max_frequency: parseFloat(maxFrequency),
                target_ctr: parseFloat(targetCtr),
                risk_ctr: parseFloat(riskCtr),
                target_cpc: parseFloat(targetCpc),
                risk_cpc: parseFloat(riskCpc),
                target_cpm: parseFloat(targetCpm),
                risk_cpm: parseFloat(riskCpm),
                auto_pause_enabled: autoPauseEnabled,
                auto_scale_enabled: autoScaleEnabled,
                alert_sensitivity: alertSensitivity
            };

            // Save settings
            const { error } = await (supabase as any)
                .from('account_settings')
                .upsert(payload);

            if (error) throw error;

            // Get workspace for rule creation
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: workspace } = await supabase
                .from("workspaces")
                .select("id")
                .eq("owner_id", user.id)
                .single();

            let workspaceId = workspace?.id;
            if (!workspaceId) {
                const { data: membership } = await supabase
                    .from("team_members")
                    .select("workspace_id")
                    .eq("user_id", user.id)
                    .eq("status", "active")
                    .single();
                workspaceId = membership?.workspace_id;
            }

            if (!workspaceId) throw new Error("Workspace not found");

            // Create or update automation rules based on settings
            const kpiField = primaryKpi === 'ROAS' ? 'results_roas' :
                primaryKpi === 'CPA' ? 'cost_per_result' : 'cost_per_result';

            // Check existing auto-generated rules
            const { data: existingRules } = await (supabase as any)
                .from("automation_rules")
                .select("id, name")
                .eq("ad_account_id", selectedAccountId)
                .eq("workspace_id", workspaceId)
                .like("name", "%[Auto]%");

            const existingPauseRule = existingRules?.find(r => r.name.includes('[Auto] Pausar'));
            const existingScaleRule = existingRules?.find(r => r.name.includes('[Auto] Escalar'));

            // AUTO-PAUSE RULE
            if (autoPauseEnabled) {
                const pauseRuleName = `[Auto] Pausar ${primaryKpi} < ${riskThreshold}`;
                const pauseEvaluationSpec = {
                    evaluation_type: "SCHEDULE",
                    filters: [
                        {
                            field: kpiField,
                            value: parseFloat(riskThreshold),
                            operator: primaryKpi === 'ROAS' ? 'LESS_THAN' : 'GREATER_THAN'
                        }
                    ],
                    entity_type: "CAMPAIGN"
                };
                const pauseExecutionSpec = {
                    execution_type: "PAUSE"
                };

                if (existingPauseRule) {
                    // Update existing rule
                    await (supabase as any)
                        .from("automation_rules")
                        .update({
                            name: pauseRuleName,
                            evaluation_spec: pauseEvaluationSpec,
                            execution_spec: pauseExecutionSpec,
                            status: 'ACTIVE'
                        })
                        .eq("id", existingPauseRule.id);
                } else {
                    // Create new rule
                    await (supabase as any)
                        .from("automation_rules")
                        .insert({
                            workspace_id: workspaceId,
                            ad_account_id: selectedAccountId,
                            name: pauseRuleName,
                            description: `Regra gerada automaticamente: Pausar campanhas quando ${primaryKpi} cair abaixo de ${riskThreshold}`,
                            rule_type: 'LOCAL',
                            trigger_type: 'SCHEDULE',
                            evaluation_spec: pauseEvaluationSpec,
                            execution_spec: pauseExecutionSpec,
                            status: 'ACTIVE'
                        });
                }
            } else if (existingPauseRule) {
                // Disable existing pause rule
                await (supabase as any)
                    .from("automation_rules")
                    .update({ status: 'PAUSED' })
                    .eq("id", existingPauseRule.id);
            }

            // AUTO-SCALE RULE
            if (autoScaleEnabled) {
                const scaleRuleName = `[Auto] Escalar ${primaryKpi} > ${targetValue}`;
                const scaleEvaluationSpec = {
                    evaluation_type: "SCHEDULE",
                    filters: [
                        {
                            field: kpiField,
                            value: parseFloat(targetValue),
                            operator: primaryKpi === 'ROAS' ? 'GREATER_THAN' : 'LESS_THAN'
                        }
                    ],
                    entity_type: "CAMPAIGN"
                };
                const scaleExecutionSpec = {
                    execution_type: "CHANGE_BUDGET",
                    execution_options: [
                        {
                            field: "change_spec",
                            value: { amount: 20, unit: "PERCENTAGE" },
                            operator: "EQUAL"
                        }
                    ]
                };

                if (existingScaleRule) {
                    // Update existing rule
                    await (supabase as any)
                        .from("automation_rules")
                        .update({
                            name: scaleRuleName,
                            evaluation_spec: scaleEvaluationSpec,
                            execution_spec: scaleExecutionSpec,
                            status: 'ACTIVE'
                        })
                        .eq("id", existingScaleRule.id);
                } else {
                    // Create new rule
                    await (supabase as any)
                        .from("automation_rules")
                        .insert({
                            workspace_id: workspaceId,
                            ad_account_id: selectedAccountId,
                            name: scaleRuleName,
                            description: `Regra gerada automaticamente: Aumentar orçamento em 20% quando ${primaryKpi} superar ${targetValue}`,
                            rule_type: 'LOCAL',
                            trigger_type: 'SCHEDULE',
                            evaluation_spec: scaleEvaluationSpec,
                            execution_spec: scaleExecutionSpec,
                            status: 'ACTIVE'
                        });
                }
            } else if (existingScaleRule) {
                // Disable existing scale rule
                await (supabase as any)
                    .from("automation_rules")
                    .update({ status: 'PAUSED' })
                    .eq("id", existingScaleRule.id);
            }
        },
        onSuccess: () => {
            // Save support info to local storage
            localStorage.setItem('lads_support_email', supportEmail);
            localStorage.setItem('lads_support_whatsapp', supportWhatsapp);

            queryClient.invalidateQueries({ queryKey: ['account-settings'] });
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            const rulesCreated = [];
            if (autoPauseEnabled) rulesCreated.push("Pausar Automaticamente");
            if (autoScaleEnabled) rulesCreated.push("Escalar Automaticamente");

            toast({
                title: t('governance.toasts.save_success', 'Settings saved'),
                description: rulesCreated.length > 0
                    ? t('governance.toasts.rules_created', { rules: rulesCreated.join(", ") })
                    : t('governance.toasts.save_success_desc', 'AI will now use these guidelines.')
            });
        },
        onError: (error: any) => {
            toast({ title: t('governance.toasts.save_error', 'Error saving'), description: error.message, variant: "destructive" });
        }
    });

    if (!selectedAccountId) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                    {t('governance.select_account_prompt', 'Select an ad account to configure rules.')}
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="h-64 w-full bg-muted animate-pulse rounded-none" />;
    }

    return (
        <Card className={compact ? 'border-0 shadow-none bg-transparent' : ''}>
            {!compact && (
                <CardHeader className="border-b mb-6">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Settings2 className="h-5 w-5 text-primary" />
                        {t('governance.title', 'Optimization Settings')}
                    </CardTitle>
                    <CardDescription>
                        {t('governance.description', 'Set goals and risk limits. AI will use these values for analyses and automatic alerts.')}
                    </CardDescription>
                </CardHeader>
            )}
            <CardContent className={`space-y-6 ${compact ? 'p-0' : ''}`}>
                {/* Multiple KPIs Section */}
                <div className="bg-muted/30 p-5 rounded-none border border-border/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                        <h3 className="font-semibold flex items-center gap-2 text-base">
                            <Target className="w-4 h-4 text-primary" />
                            {t('governance.kpis.title', 'Primary KPIs')}
                        </h3>
                        {primaryKpis.length < 3 && (
                            <Button variant="outline" size="sm" onClick={addKpi} className="h-9 gap-2 rounded-none border-primary/30 hover:bg-primary/5 text-xs font-bold w-full sm:w-auto">
                                <Plus className="h-4 w-4" /> {t('governance.kpis.add', 'Add KPI')}
                            </Button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {/* Header Labels - Desktop Only */}
                        <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                            <div className="col-span-4">{t('governance.kpis.metric', 'Metric')}</div>
                            <div className="col-span-4 text-emerald-500 font-bold">{t('governance.kpis.target', 'Expectation (Target)')}</div>
                            <div className="col-span-3 text-rose-500 font-bold">{t('governance.kpis.risk', 'Risk Limit')}</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* KPI Rows */}
                        {primaryKpis.map((kpi, index) => (
                            <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-4 items-start md:items-center bg-background p-4 md:p-2 rounded-none border border-border/50">
                                {/* Metric Selector */}
                                <div className="w-full md:col-span-4">
                                    <Label className="md:hidden text-[10px] font-bold uppercase text-muted-foreground mb-1.5">{t('governance.kpis.metric', 'Metric')}</Label>
                                    <Select
                                        value={kpi.metric}
                                        onValueChange={(v: any) => updateKpi(index, 'metric', v)}
                                    >
                                        <SelectTrigger className="h-10 md:h-9 rounded-none bg-background/50 border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ROAS">ROAS</SelectItem>
                                            <SelectItem value="CPA">CPA</SelectItem>
                                            <SelectItem value="CPL">CPL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4 w-full md:contents">
                                    {/* Target Input */}
                                    <div className="md:col-span-4">
                                        <Label className="md:hidden text-[10px] font-bold uppercase text-emerald-500 mb-1.5">{t('governance.kpis.target_short', 'Target')}</Label>
                                        <div className="relative">
                                            {kpi.metric !== 'ROAS' && (
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                            )}
                                            <Input
                                                type="number"
                                                step="1"
                                                value={kpi.target}
                                                onChange={(e) => updateKpi(index, 'target', e.target.value)}
                                                className={`h-10 md:h-9 rounded-none border-emerald-500/30 focus-visible:ring-emerald-500/20 font-bold ${kpi.metric !== 'ROAS' ? 'pl-8' : 'pr-6'}`}
                                            />
                                            {kpi.metric === 'ROAS' && (
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">x</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Risk Input */}
                                    <div className="md:col-span-3">
                                        <Label className="md:hidden text-[10px] font-bold uppercase text-rose-500 mb-1.5">{t('governance.kpis.risk_short', 'Risk')}</Label>
                                        <div className="relative">
                                            {kpi.metric !== 'ROAS' && (
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                            )}
                                            <Input
                                                type="number"
                                                step="1"
                                                value={kpi.risk}
                                                onChange={(e) => updateKpi(index, 'risk', e.target.value)}
                                                className={`h-10 md:h-9 rounded-none border-rose-500/30 focus-visible:ring-rose-500/20 font-bold ${kpi.metric !== 'ROAS' ? 'pl-8' : 'pr-6'}`}
                                            />
                                            {kpi.metric === 'ROAS' && (
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">x</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Remove Button container - only show border on mobile if there's a button */}
                                {primaryKpis.length > 1 ? (
                                    <div className="w-full md:col-span-1 flex justify-end md:justify-center border-t md:border-none pt-2 md:pt-0 mt-1 md:mt-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-full md:w-9 text-muted-foreground hover:text-destructive gap-2 md:gap-0"
                                            onClick={() => removeKpi(index)}
                                        >
                                            <X className="h-4 w-4" />
                                            <span className="md:hidden text-xs font-bold">{t('governance.actions.remove', 'Remove')}</span>
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="hidden md:flex md:col-span-1 h-9 md:w-9" />
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                        {t('governance.kpis.description', 'Configure multiple KPIs to monitor simultaneously. AI will check all and alert when any exceeds the risk limit.')}
                    </p>
                </div>

                {/* Extended Metrics - Table Layout */}
                <div>
                    <button
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {t('governance.advanced.title', 'Additional Metrics')}
                    </button>

                    {showAdvanced && (
                        <div className="border rounded-none overflow-x-auto animate-in slide-in-from-top-2 duration-200">
                            <table className="min-w-[450px] w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left px-4 py-2 font-medium">{t('governance.kpis.metric', 'Metric')}</th>
                                        <th className="text-left px-4 py-2 font-medium text-emerald-500">{t('governance.kpis.target_short', 'Target')}</th>
                                        <th className="text-left px-4 py-2 font-medium text-rose-500">{t('governance.kpis.risk_short', 'Risk')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    <tr>
                                        <td className="px-4 py-3 font-medium">CTR</td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[100px]">
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={targetCtr}
                                                    onChange={(e) => setTargetCtr(e.target.value)}
                                                    className="h-8 text-sm pr-6 rounded-none border-border/50"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[100px]">
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={riskCtr}
                                                    onChange={(e) => setRiskCtr(e.target.value)}
                                                    className="h-8 text-sm pr-6 rounded-none border-rose-500/30"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">CPC</td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[100px]">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={targetCpc}
                                                    onChange={(e) => setTargetCpc(e.target.value)}
                                                    className="h-8 text-sm pl-7 rounded-none border-border/50"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[100px]">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={riskCpc}
                                                    onChange={(e) => setRiskCpc(e.target.value)}
                                                    className="h-8 text-sm pl-7 rounded-none border-rose-500/30"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">CPM</td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[100px]">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    step="1"
                                                    value={targetCpm}
                                                    onChange={(e) => setTargetCpm(e.target.value)}
                                                    className="h-8 text-sm pl-7 rounded-none border-border/50"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="relative max-w-[100px]">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    step="1"
                                                    value={riskCpm}
                                                    onChange={(e) => setRiskCpm(e.target.value)}
                                                    className="h-8 text-sm pl-7 rounded-none border-rose-500/30"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">{t('governance.advanced.max_frequency', 'Max Frequency')}</td>
                                        <td className="px-4 py-2" colSpan={2}>
                                            <div className="max-w-[100px]">
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={maxFrequency}
                                                    onChange={(e) => setMaxFrequency(e.target.value)}
                                                    className="h-8 text-sm rounded-none border-border/50"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Support Info UI */}
                <div className="border-t pt-6 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        {t('governance.support.title', 'Support Information (AI)')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('governance.support.email', 'Support Email')}</Label>
                            <Input
                                placeholder="suporte@loja.com"
                                value={supportEmail}
                                onChange={(e) => setSupportEmail(e.target.value)}
                                className="rounded-none border-border/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('governance.support.whatsapp', 'Support WhatsApp')}</Label>
                            <Input
                                placeholder="(11) 99999-9999"
                                value={supportWhatsapp}
                                onChange={(e) => setSupportWhatsapp(e.target.value)}
                                className="rounded-none border-border/50"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('governance.support.description', 'This information will be used by AI to suggest contact channels in responses to negative comments.')}
                    </p>
                </div>

                {/* Automation Settings */}
                <div className="border-t pt-6 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        {t('governance.automations.title', 'Automations')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-none border border-border/50">
                            <div>
                                <Label>{t('governance.automations.auto_pause', 'Auto-Pause')}</Label>
                                <p className="text-xs text-muted-foreground">{t('governance.automations.auto_pause_desc', 'Pause ads above risk limit')}</p>
                            </div>
                            <Switch
                                checked={autoPauseEnabled}
                                onCheckedChange={setAutoPauseEnabled}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-none border border-border/50">
                            <div>
                                <Label>{t('governance.automations.auto_scale', 'Auto-Scale')}</Label>
                                <p className="text-xs text-muted-foreground">{t('governance.automations.auto_scale_desc', 'Increase budget for good performers')}</p>
                            </div>
                            <Switch
                                checked={autoScaleEnabled}
                                onCheckedChange={setAutoScaleEnabled}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('governance.automations.sensitivity', 'Alert Sensitivity')}</Label>
                        <div className="flex gap-2">
                            {(['low', 'medium', 'high'] as const).map((level) => (
                                <Button
                                    key={level}
                                    variant={alertSensitivity === level ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setAlertSensitivity(level)}
                                    className="flex-1 rounded-none h-10 border-border/50"
                                >
                                    {level === 'low' ? t('governance.automations.low', 'Low') :
                                        level === 'medium' ? t('governance.automations.medium', 'Medium') :
                                            t('governance.automations.high', 'High')}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {alertSensitivity === 'low' ? t('governance.automations.low_desc', 'Only critical alerts') :
                                alertSensitivity === 'medium' ? t('governance.automations.medium_desc', 'Important and critical alerts') :
                                    t('governance.automations.high_desc', 'All alerts, including minor ones')}
                        </p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className={`${compact ? 'p-0 pt-4' : ''} flex justify-end`}>
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full md:w-auto rounded-none h-11 px-8 bg-primary hover:bg-primary/90">
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    {t('governance.actions.save', 'Save Settings')}
                </Button>
            </CardFooter>
        </Card>
    );
};
