import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import i18next from "i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Folder } from 'lucide-react';
import {
    Plus,
    Zap,
    Pause,
    Play,
    Trash2,
    History,
    Settings2,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Target,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    AlertCircle,
    Eye,
    Pencil
} from "lucide-react";
import leverLogo from "@/assets/lever-logo.png";

const MetaLogo = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor" // Allows coloring via text-blue-600 etc
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M12 2C6.48 2 2 6.48 2 12c0 5.0 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.53-3.89 3.77-3.89 1.08 0 2.2.08 2.2.08v2.48h-1.24c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7C18.34 21.15 22 17 22 12c0-5.52-4.48-10-10-10z" fill="#1877F2" />
        <path d="M16.924 5.924c-1.956 0-3.696.864-4.924 2.268a7.155 7.155 0 0 0-4.92-2.268C3.12 5.924 0 9.276 0 13.596 0 16.596 1.836 18.076 4.152 18.076c2.052 0 3.792-1.068 4.968-2.676 1.152 1.62 2.988 2.676 4.908 2.676 4.08 0 7.02-3.372 7.02-7.68 0-3.096-1.896-4.476-4.124-4.476zm-9.84 9.108c-1.116 0-1.788-.708-1.788-2.076 0-1.824 1.272-3.612 3.036-3.612.984 0 1.824.588 2.22 1.548-1.02 2.628-2.316 4.14-3.468 4.14zm9.924 0c-1.212 0-2.436-1.632-3.456-4.152.408-.948 1.236-1.536 2.208-1.536 1.704 0 2.916 1.632 2.916 3.528 0 1.428-.672 2.16-1.668 2.16z" fill="#0668E1" />
    </svg>
);

interface AutomationRule {
    id: string;
    name: string;
    description?: string;
    status: "ACTIVE" | "PAUSED" | "DELETED";
    rule_type: "META_NATIVE" | "LOCAL";
    trigger_type: "SCHEDULE" | "TRIGGER";
    evaluation_spec: any;
    execution_spec: any;
    meta_rule_id?: string;
    last_executed_at?: string;
    execution_count: number;
    created_at: string;
}

interface RuleLog {
    id: string;
    executed_at: string;
    action_taken: string;
    result: "SUCCESS" | "FAILED" | "PARTIAL";
    entities_affected: number;
    details?: any;
}

// FIELD_LABELS is used for default values map, keeping it as fallback if needed but getConditionSummary uses t()
const FIELD_LABELS: Record<string, string> = {
    spent: "Gasto",
    cpa: "CPA",
    cpc: "CPC",
    ctr: "CTR",
    website_purchase_roas: "ROAS",
    results: "Resultados",
    impressions: "Impressões",
};

const getOperatorLabels = (t: any): Record<string, string> => ({
    GREATER_THAN: ">",
    LESS_THAN: "<",
    EQUAL: "=",
    IN_RANGE: t('automations_tab.operators.IN_RANGE', 'entre'),
});

const formatConditionValue = (field: string, value: any): string => {
    const currencyFields = ["spent", "cpa", "cpc"];
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && currencyFields.includes(field)) {
        return `R$ ${(numValue / 100).toFixed(2).replace(".", ",")}`;
    }
    if (!isNaN(numValue) && field === "ctr") {
        return `${numValue}%`;
    }
    return String(value);
};

const getConditionSummary = (rule: AutomationRule, t: any): string => {
    const fieldKey = rule.evaluation_spec?.trigger?.field ||
        rule.evaluation_spec?.filters?.find((f: any) => f.field !== "entity_type" && f.field !== "time_preset" && f.field !== "effective_status")?.field ||
        "";
    const field = t(`automations_tab.fields.${fieldKey}`, t('automations_tab.fields.metric', 'Métrica'));

    const operatorKey = rule.evaluation_spec?.trigger?.operator ||
        rule.evaluation_spec?.filters?.find((f: any) => f.field !== "entity_type" && f.field !== "time_preset" && f.field !== "effective_status")?.operator ||
        "";
    const operator = getOperatorLabels(t)[operatorKey] || "";

    const rawValue = rule.evaluation_spec?.trigger?.value ||
        rule.evaluation_spec?.filters?.find((f: any) => f.field !== "entity_type" && f.field !== "time_preset" && f.field !== "effective_status")?.value;

    const value = formatConditionValue(fieldKey, rawValue);
    return `${field} ${operator} ${value}`;
};

const getActionSummary = (rule: AutomationRule, t: any): string => {
    const actionType = rule.execution_spec?.execution_type;
    const label = t(`automations_tab.actions.${actionType}`, t('automations_tab.action_label', 'Ação'));
    const options = rule.execution_spec?.execution_options;
    if ((actionType === "CHANGE_BUDGET" || actionType === "CHANGE_CAMPAIGN_BUDGET") && options?.length > 0) {
        const changeSpec = options.find((o: any) => o.field === "change_spec");
        if (changeSpec?.value?.amount) {
            const sign = changeSpec.value.amount > 0 ? "+" : "";
            return `${label} ${sign}${changeSpec.value.amount}%`;
        }
    }
    return label;
};

class AutomationsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[Automations] Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-red-500 mb-2">{i18next.t('automations_tab.error_boundary.title', 'Erro na página de Automações')}</h2>
                    <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
                    <pre className="text-xs text-left bg-red-950/20 p-4 rounded overflow-auto max-h-40">
                        {this.state.error?.stack}
                    </pre>
                    <Button className="mt-4" onClick={() => window.location.reload()}>
                        {i18next.t('automations_tab.error_boundary.reload', 'Recarregar Página')}
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}

const AutomationsInner = () => {
    const { t, i18n } = useTranslation();
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
    const [logs, setLogs] = useState<RuleLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState("rules");
    const { selectedAccountId } = useDashboard();
    const { toast } = useToast();

    const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
        PAUSE: { label: t('automations_tab.actions.PAUSE', 'Pausar'), icon: <Pause className="w-4 h-4" />, color: "text-orange-500" },
        UNPAUSE: { label: t('automations_tab.actions.UNPAUSE', 'Ativar'), icon: <Play className="w-4 h-4" />, color: "text-green-500" },
        NOTIFICATION: { label: t('automations_tab.actions.NOTIFICATION', 'Notificar'), icon: <AlertCircle className="w-4 h-4" />, color: "text-purple-500" },
        CHANGE_BUDGET: { label: t('automations_tab.actions.CHANGE_BUDGET', 'Alterar Orçamento'), icon: <DollarSign className="w-4 h-4" />, color: "text-blue-500" },
        CHANGE_CAMPAIGN_BUDGET: { label: t('automations_tab.actions.CHANGE_CAMPAIGN_BUDGET', 'Alterar Orçamento Campanha'), icon: <DollarSign className="w-4 h-4" />, color: "text-blue-500" },
        INCREASE_DAILY_BUDGET_BY: { label: t('automations_tab.actions.INCREASE_DAILY_BUDGET_BY', 'Aumentar Orçamento Diário'), icon: <TrendingUp className="w-4 h-4" />, color: "text-green-500" },
        DECREASE_DAILY_BUDGET_BY: { label: t('automations_tab.actions.DECREASE_DAILY_BUDGET_BY', 'Reduzir Orçamento Diário'), icon: <TrendingDown className="w-4 h-4" />, color: "text-red-500" },
        INCREASE_LIFETIME_BUDGET_BY: { label: t('automations_tab.actions.INCREASE_LIFETIME_BUDGET_BY', 'Aumentar Orçamento Total'), icon: <TrendingUp className="w-4 h-4" />, color: "text-green-500" },
        DECREASE_LIFETIME_BUDGET_BY: { label: t('automations_tab.actions.DECREASE_LIFETIME_BUDGET_BY', 'Reduzir Orçamento Total'), icon: <TrendingDown className="w-4 h-4" />, color: "text-red-500" },
        INCREASE_BID_BY: { label: t('automations_tab.actions.INCREASE_BID_BY', 'Aumentar Lance'), icon: <TrendingUp className="w-4 h-4" />, color: "text-green-500" },
        DECREASE_BID_BY: { label: t('automations_tab.actions.DECREASE_BID_BY', 'Reduzir Lance'), icon: <TrendingDown className="w-4 h-4" />, color: "text-red-500" },
        MOVE_CREATIVE: { label: t('automations_tab.actions.MOVE_CREATIVE', 'Mover Criativo'), icon: <Target className="w-4 h-4" />, color: "text-pink-500" },
        MOVE_TO_FOLDER: { label: t('automations_tab.actions.MOVE_TO_FOLDER', 'Mover para Pasta'), icon: <Folder className="w-4 h-4" />, color: "text-blue-500" },
    };

    const LOCAL_ACTIONS = [
        { value: "MOVE_TO_FOLDER", label: t('automations_tab.actions.FOLDER_SELECT', 'Mover para Pasta'), hasInput: true, inputType: "FOLDER_SELECT" },
        { value: "NOTIFICATION", label: t('automations_tab.actions.NOTIFY_ONLY', 'Somente Notificar') }
    ];

    const ACTIONS_BY_ENTITY: Record<string, { value: string; label: string; hasInput?: boolean; inputPlaceholder?: string }[]> = {
        AD: [
            { value: "PAUSE", label: t('automations_tab.actions.PAUSE_ADS', 'Desativar anúncios') },
            { value: "UNPAUSE", label: t('automations_tab.actions.UNPAUSE_ADS', 'Ativar anúncios') },
            { value: "NOTIFICATION", label: t('automations_tab.actions.NOTIFY_ONLY', 'Somente enviar notificação') },
        ],
        CAMPAIGN: [
            { value: "PAUSE", label: t('automations_tab.actions.PAUSE_CAMPAIGNS', 'Desativar campanhas') },
            { value: "UNPAUSE", label: t('automations_tab.actions.UNPAUSE_CAMPAIGNS', 'Ativar campanhas') },
            { value: "NOTIFICATION", label: t('automations_tab.actions.NOTIFY_ONLY', 'Somente enviar notificação') },
            { value: "INCREASE_DAILY_BUDGET_BY", label: t('automations_tab.actions.INCREASE_DAILY', 'Aumentar orçamento diário em'), hasInput: true, inputPlaceholder: "% de aumento" },
            { value: "DECREASE_DAILY_BUDGET_BY", label: t('automations_tab.actions.DECREASE_DAILY', 'Reduzir orçamento diário em'), hasInput: true, inputPlaceholder: "% de redução" },
            { value: "INCREASE_LIFETIME_BUDGET_BY", label: t('automations_tab.actions.INCREASE_LIFETIME', 'Aumentar orçamento total em'), hasInput: true, inputPlaceholder: "% de aumento" },
            { value: "DECREASE_LIFETIME_BUDGET_BY", label: t('automations_tab.actions.DECREASE_LIFETIME', 'Reduzir orçamento total em'), hasInput: true, inputPlaceholder: "% de redução" },
        ],
        ADSET: [
            { value: "PAUSE", label: t('automations_tab.actions.PAUSE_ADSETS', 'Desativar conjuntos de anúncios') },
            { value: "UNPAUSE", label: t('automations_tab.actions.UNPAUSE_ADSETS', 'Ativar conjuntos de anúncios') },
            { value: "NOTIFICATION", label: t('automations_tab.actions.NOTIFY_ONLY', 'Somente enviar notificação') },
            { value: "INCREASE_DAILY_BUDGET_BY", label: t('automations_tab.actions.INCREASE_DAILY', 'Aumentar orçamento diário em'), hasInput: true, inputPlaceholder: "% de aumento" },
            { value: "DECREASE_DAILY_BUDGET_BY", label: t('automations_tab.actions.DECREASE_DAILY', 'Reduzir orçamento diário em'), hasInput: true, inputPlaceholder: "% de redução" },
            { value: "INCREASE_LIFETIME_BUDGET_BY", label: t('automations_tab.actions.INCREASE_LIFETIME', 'Aumentar orçamento total em'), hasInput: true, inputPlaceholder: "% de aumento" },
            { value: "DECREASE_LIFETIME_BUDGET_BY", label: t('automations_tab.actions.DECREASE_LIFETIME', 'Reduzir orçamento total em'), hasInput: true, inputPlaceholder: "% de redução" },
            { value: "INCREASE_BID_BY", label: t('automations_tab.actions.INCREASE_BID', 'Aumentar lance em'), hasInput: true, inputPlaceholder: "% de aumento" },
            { value: "DECREASE_BID_BY", label: t('automations_tab.actions.DECREASE_BID', 'Reduzir lance em'), hasInput: true, inputPlaceholder: "% de redução" },
        ],
    };

    const TIME_PRESETS = [
        {
            group: t('automations_tab.time_presets.basic', 'Básico'), options: [
                { value: "MAXIMUM", label: t('automations_tab.time_presets.MAXIMUM', '37 meses (máximo)') },
                { value: "TODAY", label: t('automations_tab.time_presets.TODAY', 'Hoje') },
                { value: "YESTERDAY", label: t('automations_tab.time_presets.YESTERDAY', 'Ontem') },
                { value: "LAST_2D", label: t('automations_tab.time_presets.LAST_2D', 'Últimos 2 dias') },
                { value: "LAST_3D", label: t('automations_tab.time_presets.LAST_3D', 'Últimos 3 dias') },
                { value: "LAST_7D", label: t('automations_tab.time_presets.LAST_7D', 'Últimos 7 dias') },
                { value: "LAST_14D", label: t('automations_tab.time_presets.LAST_14D', 'Últimos 14 dias') },
                { value: "LAST_28D", label: t('automations_tab.time_presets.LAST_28D', 'Últimos 28 dias') },
                { value: "LAST_30D", label: t('automations_tab.time_presets.LAST_30D', 'Últimos 30 dias') },
            ]
        },
        {
            group: t('automations_tab.time_presets.including_today', 'Incluindo hoje'), options: [
                { value: "LAST_2D_INCLUDING_TODAY", label: t('automations_tab.time_presets.LAST_2D_INCLUDING_TODAY', 'Últimos 2 dias, incluindo hoje') },
                { value: "LAST_3D_INCLUDING_TODAY", label: t('automations_tab.time_presets.LAST_3D_INCLUDING_TODAY', 'Últimos 3 dias, incluindo hoje') },
                { value: "LAST_7D_INCLUDING_TODAY", label: t('automations_tab.time_presets.LAST_7D_INCLUDING_TODAY', 'Últimos 7 dias, incluindo hoje') },
                { value: "LAST_14D_INCLUDING_TODAY", label: t('automations_tab.time_presets.LAST_14D_INCLUDING_TODAY', 'Últimos 14 dias, incluindo hoje') },
                { value: "LAST_28D_INCLUDING_TODAY", label: t('automations_tab.time_presets.LAST_28D_INCLUDING_TODAY', 'Últimos 28 dias, incluindo hoje') },
                { value: "LAST_30D_INCLUDING_TODAY", label: t('automations_tab.time_presets.LAST_30D_INCLUDING_TODAY', 'Últimos 30 dias, incluindo hoje') },
            ]
        },
        {
            group: t('automations_tab.time_presets.comp_7d', 'Comparativo (Últimos 7 dias)'), options: [
                { value: "LAST_14D_BEFORE_LAST_7D", label: t('automations_tab.time_presets.LAST_14D_BEFORE_LAST_7D', 'Últimos 14 dias até os últimos 7 dias') },
                { value: "LAST_30D_BEFORE_LAST_7D", label: t('automations_tab.time_presets.LAST_30D_BEFORE_LAST_7D', 'Últimos 30 dias até os últimos 7 dias') },
                { value: "LAST_60D_BEFORE_LAST_7D", label: t('automations_tab.time_presets.LAST_60D_BEFORE_LAST_7D', 'Últimos 60 dias até os últimos 7 dias') },
                { value: "LAST_120D_BEFORE_LAST_7D", label: t('automations_tab.time_presets.LAST_120D_BEFORE_LAST_7D', 'Últimos 120 dias até os últimos 7 dias') },
                { value: "LAST_180D_BEFORE_LAST_7D", label: t('automations_tab.time_presets.LAST_180D_BEFORE_LAST_7D', 'Últimos 180 dias até os últimos 7 dias') },
            ]
        },
        {
            group: t('automations_tab.time_presets.comp_28d', 'Comparativo (Últimos 28 dias)'), options: [
                { value: "LAST_60D_BEFORE_LAST_28D", label: t('automations_tab.time_presets.LAST_60D_BEFORE_LAST_28D', 'Últimos 60 dias até os últimos 28 dias') },
                { value: "LAST_120D_BEFORE_LAST_28D", label: t('automations_tab.time_presets.LAST_120D_BEFORE_LAST_28D', 'Últimos 120 dias até os últimos 28 dias') },
                { value: "LAST_180D_BEFORE_LAST_28D", label: t('automations_tab.time_presets.LAST_180D_BEFORE_LAST_28D', 'Últimos 180 dias até os últimos 28 dias') },
            ]
        },
    ];

    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);

    useEffect(() => {
        const fetchTokenAndWorkspace = async () => {
            if (!selectedAccountId) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: account } = await (supabase as any)
                    .from("ad_accounts")
                    .select("access_token")
                    .eq("id", selectedAccountId)
                    .single();

                if (account?.access_token) setAccessToken(account.access_token);

                let foundWorkspaceId = null;
                const { data: ownWorkspace } = await (supabase as any)
                    .from('workspaces')
                    .select('id')
                    .eq('owner_id', user.id)
                    .maybeSingle();

                if (ownWorkspace) {
                    foundWorkspaceId = ownWorkspace.id;
                } else {
                    const { data: membership } = await (supabase as any)
                        .from('team_members')
                        .select('workspace_id')
                        .eq('user_id', user.id)
                        .eq('status', 'active')
                        .maybeSingle();
                    if (membership) foundWorkspaceId = membership.workspace_id;
                }
                if (foundWorkspaceId) setWorkspaceId(foundWorkspaceId);
            } catch (error) {
                console.error("Error fetching token/workspace:", error);
            }
        };
        fetchTokenAndWorkspace();
    }, [selectedAccountId, toast]);

    const [newRule, setNewRule] = useState({
        name: "",
        description: "",
        rule_type: "META_NATIVE" as "META_NATIVE" | "LOCAL",
        trigger_type: "SCHEDULE" as "SCHEDULE" | "TRIGGER",
        entity_type: "CAMPAIGN",
        time_preset: "LAST_7D",
        condition_field: "spent",
        condition_operator: "GREATER_THAN",
        condition_value: "",
        action_type: "PAUSE",
        action_value: "",
    });

    useEffect(() => {
        if (selectedAccountId && accessToken) {
            syncFromMeta().then(() => loadRules());
        } else if (selectedAccountId) {
            loadRules();
        }
    }, [selectedAccountId, accessToken]);

    const syncFromMeta = async () => {
        setIsSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke("manage-ad-rules", {
                body: {
                    action: "SYNC_FROM_META",
                    accountId: selectedAccountId,
                    accessToken
                },
            });
            if (error) {
                toast({ title: t('automations_tab.toasts.sync_error', 'Erro ao sincronizar'), description: error.message, variant: "destructive" });
            } else if (data.sync?.deletedCount > 0 || data.sync?.updatedCount > 0) {
                toast({
                    title: t('automations_tab.toasts.synced_title', 'Sincronizado!'),
                    description: t('automations_tab.toasts.synced_desc', '{{deleted}} removidas, {{updated}} atualizadas', { deleted: data.sync.deletedCount, updated: data.sync.updatedCount })
                });
            }
        } catch (error: any) {
            console.error("[Automations] Sync failed:", error);
        } finally {
            setIsSyncing(false);
        }
    };

    const loadRules = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("manage-ad-rules", {
                body: { action: "READ_ALL", accountId: selectedAccountId },
            });
            if (error) throw error;
            setRules(data.rules || []);
        } catch (error: any) {
            toast({ title: t('automations_tab.toasts.create_error', 'Erro'), description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const loadRuleHistory = async (ruleId: string) => {
        try {
            const { data, error } = await supabase.functions.invoke("manage-ad-rules", {
                body: { action: "GET_HISTORY", ruleId },
            });
            if (error) throw error;
            setLogs(data.logs || []);
        } catch (error: any) {
            console.error("Error loading history:", error);
        }
    };

    const { data: folders = [] } = useQuery({
        queryKey: ['asset-folders', selectedAccountId],
        queryFn: async () => {
            if (!selectedAccountId) return [];
            const { data, error } = await (supabase as any)
                .from('asset_folders')
                .select('*')
                .eq('account_id', selectedAccountId);
            if (error) throw error;
            return data as { id: string; name: string }[];
        },
        enabled: !!selectedAccountId
    });

    const handleToggleRule = async (ruleId: string) => {
        try {
            const { data, error } = await supabase.functions.invoke("manage-ad-rules", {
                body: { action: "TOGGLE", ruleId, accessToken },
            });
            if (error) throw error;
            setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, status: data.rule.status } : r)));
            toast({ title: t('automations_tab.toasts.rule_updated', 'Regra atualizada!') });
        } catch (error: any) {
            toast({ title: t('automations_tab.toasts.create_error', 'Erro'), description: error.message, variant: "destructive" });
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm(t('automations_tab.delete_confirm', 'Tem certeza que deseja excluir esta regra?'))) return;
        try {
            const { error } = await supabase.functions.invoke("manage-ad-rules", {
                body: { action: "DELETE", ruleId, accessToken },
            });
            if (error) throw error;
            setRules((prev) => prev.filter((r) => r.id !== ruleId));
            toast({ title: t('automations_tab.toasts.rule_deleted', 'Regra excluída!') });
        } catch (error: any) {
            toast({ title: t('automations_tab.toasts.create_error', 'Erro'), description: error.message, variant: "destructive" });
        }
    };

    const handlePreviewRule = async (ruleId: string) => {
        try {
            const { data, error } = await supabase.functions.invoke("manage-ad-rules", {
                body: { action: "PREVIEW", ruleId, accessToken },
            });
            if (error) throw error;
            toast({
                title: t('automations_tab.toasts.preview_title', 'Preview da Regra'),
                description: t('automations_tab.toasts.preview_desc', '{{count}} entidades correspondem aos critérios.', { count: data.preview?.data?.length || 0 }),
            });
        } catch (error: any) {
            toast({ title: t('automations_tab.toasts.preview_error', 'Erro no Preview'), description: error.message, variant: "destructive" });
        }
    };

    const handleCreateRule = async () => {
        if (!newRule.name || !newRule.condition_value) {
            toast({ title: t('automations_tab.toasts.missing_fields', 'Preencha os campos obrigatórios'), variant: "destructive" });
            return;
        }
        if (!selectedAccountId || !workspaceId) {
            toast({ title: t('automations_tab.toasts.config_error', 'Erro de configuração'), variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const conditionValue = (value: string, field: string) => {
                const numValue = parseFloat(value);
                if (isNaN(numValue)) return value;
                return ["spent", "cpa", "cpc"].includes(field) ? Math.round(numValue * 100) : numValue;
            };

            const ruleData = {
                name: newRule.name,
                description: newRule.description,
                rule_type: newRule.rule_type,
                trigger_type: newRule.trigger_type,
                evaluation_spec: {
                    evaluation_type: newRule.trigger_type,
                    filters: [
                        { field: "entity_type", value: newRule.entity_type, operator: "EQUAL" },
                        { field: "time_preset", value: newRule.time_preset, operator: "EQUAL" },
                        { field: "effective_status", value: ["ACTIVE"], operator: "IN" },
                    ],
                } as any,
                execution_spec: { execution_type: newRule.action_type } as any,
                schedule_spec: newRule.trigger_type === "SCHEDULE" ? { schedule_type: "DAILY" } : undefined,
            };

            const val = conditionValue(newRule.condition_value, newRule.condition_field);
            if (newRule.trigger_type === "TRIGGER") {
                ruleData.evaluation_spec.trigger = { type: "STATS_CHANGE", field: newRule.condition_field, value: val, operator: newRule.condition_operator };
            } else {
                ruleData.evaluation_spec.filters.push({ field: newRule.condition_field, value: val, operator: newRule.condition_operator });
            }

            if (["INCREASE_DAILY_BUDGET_BY", "DECREASE_DAILY_BUDGET_BY", "INCREASE_LIFETIME_BUDGET_BY", "DECREASE_LIFETIME_BUDGET_BY"].includes(newRule.action_type)) {
                let amount = parseFloat(newRule.action_value);
                if (newRule.action_type.includes("DECREASE")) amount = -Math.abs(amount);
                ruleData.execution_spec.execution_options = [{ field: "change_spec", value: { amount, unit: "PERCENTAGE" }, operator: "EQUAL" }];
            }

            const { data, error } = await supabase.functions.invoke("manage-ad-rules", {
                body: { action: "CREATE", ruleData, accountId: selectedAccountId, accessToken, workspaceId },
            });
            if (error) throw error;
            setRules((prev) => [data.rule, ...prev]);
            setIsDialogOpen(false);
            setNewRule({ ...newRule, name: "", description: "", condition_value: "", action_value: "" });
            toast({ title: t('automations_tab.toasts.create_success', 'Regra criada com sucesso!') });
        } catch (error: any) {
            toast({ title: t('automations_tab.toasts.create_error', 'Erro ao criar regra'), description: error.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectRule = (rule: AutomationRule) => setSelectedRule(selectedRule?.id === rule.id ? null : rule);

    const handleOpenRuleDetails = (rule: AutomationRule) => {
        setSelectedRule(rule);
        loadRuleHistory(rule.id);
        setActiveTab("history");
    };

    if (!selectedAccountId) {
        return (
            <div className="p-6">
                <div className="text-center py-12">
                    <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t('automations_tab.select_account_title', 'Selecione uma Conta')}</h2>
                    <p className="text-muted-foreground">{t('automations_tab.select_account_desc', 'Escolha uma conta de anúncios para gerenciar suas automações.')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">{t('automations_tab.title', 'Automações')}</h1>
                    <p className="text-muted-foreground">{t('automations_tab.description', 'Crie regras automatizadas para otimizar suas campanhas.')}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                    <div className="hidden md:flex flex-1 justify-end">
                        <TabsList className="h-10 inline-flex mr-2">
                            <TabsTrigger value="rules" className="font-semibold">
                                <Zap className="w-4 h-4 mr-2" />
                                {t('automations_tab.rules_tab', 'Regras ({{count}})', { count: rules.length })}
                            </TabsTrigger>
                            <TabsTrigger value="history" disabled={!selectedRule} className="font-semibold">
                                <History className="w-4 h-4 mr-2" />
                                {t('automations_tab.history_tab', 'Histórico')}
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto order-1 sm:order-2">
                                <Plus className="w-4 h-4 mr-2" />
                                {t('automations_tab.new_rule_btn', 'Nova Regra')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t('automations_tab.modal.title', 'Criar Nova Regra de Automação')}</DialogTitle>
                                <DialogDescription>{t('automations_tab.modal.desc', 'Configure condições e ações automáticas para suas campanhas.')}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">{t('automations_tab.modal.name_label', 'Nome da Regra *')}</Label>
                                    <Input id="name" placeholder={t('automations_tab.modal.name_placeholder', 'Ex: Pausar se CPA > R$100')} value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">{t('automations_tab.modal.desc_label', 'Descrição')}</Label>
                                    <Textarea id="description" placeholder={t('automations_tab.modal.desc_placeholder', 'Descrição opcional...')} value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t('automations_tab.modal.type_label', 'Tipo de Regra')}</Label>
                                        <Select value={newRule.rule_type} onValueChange={(v: any) => setNewRule({ ...newRule, rule_type: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="META_NATIVE">{t('automations_tab.modal.type_meta', 'Meta (Sincronizada)')}</SelectItem>
                                                <SelectItem value="LOCAL">{t('automations_tab.modal.type_local', 'Local (Beacon)')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('automations_tab.modal.trigger_label', 'Gatilho')}</Label>
                                        <Select value={newRule.trigger_type} onValueChange={(v: any) => setNewRule({ ...newRule, trigger_type: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SCHEDULE">{t('automations_tab.modal.trigger_schedule', 'Agendado (Diário)')}</SelectItem>
                                                <SelectItem value="TRIGGER">{t('automations_tab.modal.trigger_realtime', 'Tempo Real')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('automations_tab.modal.entity_label', 'Aplicar em')}</Label>
                                    <Select value={newRule.entity_type} onValueChange={(v) => setNewRule({ ...newRule, entity_type: v, action_type: "PAUSE", action_value: "" })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CAMPAIGN">{t('automations_tab.modal.entities.campaigns', 'Campanhas')}</SelectItem>
                                            <SelectItem value="ADSET">{t('automations_tab.modal.entities.adsets', 'Conjuntos de Anúncios')}</SelectItem>
                                            <SelectItem value="AD">{t('automations_tab.modal.entities.ads', 'Anúncios')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('automations_tab.modal.time_label', 'Intervalo de tempo')}</Label>
                                    <Select value={newRule.time_preset} onValueChange={(v) => setNewRule({ ...newRule, time_preset: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {TIME_PRESETS.map((g) => (
                                                <SelectGroup key={g.group}>
                                                    <SelectLabel className="text-xs font-semibold text-muted-foreground">{g.group}</SelectLabel>
                                                    {g.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                </SelectGroup>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('automations_tab.modal.condition_label', 'Condição')}</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Select value={newRule.condition_field} onValueChange={(v) => setNewRule({ ...newRule, condition_field: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="spent">{t('automations_tab.fields.spent', 'Gasto (R$)')}</SelectItem>
                                                <SelectItem value="cpa">{t('automations_tab.fields.cpa', 'CPA (R$)')}</SelectItem>
                                                <SelectItem value="cpc">{t('automations_tab.fields.cpc', 'CPC (R$)')}</SelectItem>
                                                <SelectItem value="ctr">{t('automations_tab.fields.ctr', 'CTR (%)')}</SelectItem>
                                                <SelectItem value="results">{t('automations_tab.fields.results', 'Resultados')}</SelectItem>
                                                <SelectItem value="impressions">{t('automations_tab.fields.impressions', 'Impressões')}</SelectItem>
                                                {newRule.trigger_type === "SCHEDULE" && <SelectItem value="website_purchase_roas">{t('automations_tab.fields.website_purchase_roas', 'ROAS')}</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                        <Select value={newRule.condition_operator} onValueChange={(v) => setNewRule({ ...newRule, condition_operator: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GREATER_THAN">{t('automations_tab.operators.GREATER_THAN', 'Maior que')}</SelectItem>
                                                <SelectItem value="LESS_THAN">{t('automations_tab.operators.LESS_THAN', 'Menor que')}</SelectItem>
                                                <SelectItem value="EQUAL">{t('automations_tab.operators.EQUAL', 'Igual a')}</SelectItem>
                                                <SelectItem value="IN_RANGE">{t('automations_tab.operators.IN_RANGE', 'Entre')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input placeholder={t('automations_tab.modal.value_placeholder', 'Valor')} value={newRule.condition_value} onChange={(e) => setNewRule({ ...newRule, condition_value: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('automations_tab.modal.action_label', 'Ação')}</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Select value={newRule.action_type} onValueChange={(v) => setNewRule({ ...newRule, action_type: v, action_value: "" })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {newRule.rule_type === "LOCAL" ? LOCAL_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>) : (ACTIONS_BY_ENTITY[newRule.entity_type] || []).map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {newRule.rule_type === "LOCAL" ? (
                                            LOCAL_ACTIONS.find(a => a.value === newRule.action_type)?.inputType === "FOLDER_SELECT" ? (
                                                <Select value={newRule.action_value} onValueChange={(v) => setNewRule({ ...newRule, action_value: v })}>
                                                    <SelectTrigger><SelectValue placeholder={t('automations_tab.modal.folder_placeholder', 'Selecione a pasta')} /></SelectTrigger>
                                                    <SelectContent>
                                                        {folders.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                                        {folders.length === 0 && <div className="p-2 text-sm text-center">{t('automations_tab.modal.no_folders', 'Nenhuma pasta')}</div>}
                                                    </SelectContent>
                                                </Select>
                                            ) : LOCAL_ACTIONS.find(a => a.value === newRule.action_type)?.hasInput && (
                                                <Input placeholder={t('automations_tab.modal.value_placeholder', 'Valor')} value={newRule.action_value} onChange={(e) => setNewRule({ ...newRule, action_value: e.target.value })} />
                                            )
                                        ) : ACTIONS_BY_ENTITY[newRule.entity_type]?.find(a => a.value === newRule.action_type)?.hasInput && (
                                            <Input placeholder="Valor (%)" value={newRule.action_value} onChange={(e) => setNewRule({ ...newRule, action_value: e.target.value })} />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('automations_tab.modal.cancel_btn', 'Cancelar')}</Button>
                                <Button onClick={handleCreateRule} disabled={isCreating}>{isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('automations_tab.modal.create_btn', 'Criar Regra')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="icon" className="w-full sm:w-10 order-2 sm:order-1 h-10 px-0" onClick={() => syncFromMeta().then(() => loadRules())} disabled={isSyncing || !accessToken} title={t('automations_tab.sync_tooltip', 'Sincronizar com Meta')}>
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {/* Mobile Tabs List underneath header */}
                <div className="flex md:hidden overflow-x-auto pb-4 no-scrollbar">
                    <TabsList className="h-10 w-full grid grid-cols-2">
                        <TabsTrigger value="rules" className="font-semibold">
                            <Zap className="w-4 h-4 mr-2" />
                            {t('automations_tab.rules_tab', 'Regras ({{count}})', { count: rules.length })}
                        </TabsTrigger>
                        <TabsTrigger value="history" disabled={!selectedRule} className="font-semibold">
                            <History className="w-4 h-4 mr-2" />
                            {t('automations_tab.history_tab', 'Histórico')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="rules" className="mt-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : rules.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">{t('automations_tab.empty_rules_title', 'Nenhuma regra criada')}</h3>
                                <p className="text-muted-foreground mb-4">{t('automations_tab.empty_rules_desc', 'Crie sua primeira regra de automação para otimizar campanhas automaticamente.')}</p>
                                <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />{t('automations_tab.create_first_rule_btn', 'Criar Primeira Regra')}</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {rules.map((rule) => (
                                <Card key={rule.id} className={`cursor-pointer transition-all ${selectedRule?.id === rule.id ? "ring-2 ring-primary" : ""}`} onClick={() => handleSelectRule(rule)} onDoubleClick={() => handleOpenRuleDetails(rule)}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg flex items-center justify-center ${rule.status === "ACTIVE" ? "bg-green-100 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                                                    <Zap className={`w-5 h-5 ${rule.status === "ACTIVE" ? "text-green-600" : "text-gray-400"}`} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className="text-base">{rule.name}</CardTitle>
                                                        {(rule.rule_type === "META_NATIVE" || rule.meta_rule_id) ? <MetaLogo className={`w-4 h-4 ${rule.status !== "ACTIVE" ? "grayscale opacity-50" : ""}`} /> : <img src={leverLogo} alt="Beacon" className={`w-4 h-4 object-contain ${rule.status !== "ACTIVE" ? "grayscale opacity-50" : ""}`} />}
                                                    </div>
                                                    {rule.description && <CardDescription className="text-sm mt-1">{rule.description}</CardDescription>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground mr-2">{rule.created_at ? new Date(rule.created_at).toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}</span>
                                                    <Switch checked={rule.status === "ACTIVE"} onCheckedChange={() => handleToggleRule(rule.id)} onClick={(e) => e.stopPropagation()} />
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="bg-muted/50 rounded-lg p-3 mb-3">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div><span className="text-muted-foreground text-xs uppercase tracking-wide">{t('automations_tab.condition_label', 'Condição')}</span><p className="font-medium mt-0.5">{getConditionSummary(rule, t)}</p></div>
                                                <div><span className="text-muted-foreground text-xs uppercase tracking-wide">{t('automations_tab.action_label', 'Ação')}</span><p className="font-medium mt-0.5">{getActionSummary(rule, t)}</p></div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            <Badge variant="outline" className="rounded-sm">{rule.rule_type === "META_NATIVE" ? "Meta" : "Local"}</Badge>
                                            <Badge variant="secondary" className="rounded-sm"><Clock className="w-3 h-3 mr-1" />{rule.trigger_type === "SCHEDULE" ? t('automations_tab.modal.trigger_schedule', 'Agendado') : t('automations_tab.modal.trigger_realtime', 'Tempo Real')}</Badge>
                                            <Badge variant="secondary" className={`${ACTION_LABELS[rule.execution_spec?.execution_type]?.color} rounded-sm`}>{ACTION_LABELS[rule.execution_spec?.execution_type]?.icon}<span className="ml-1">{ACTION_LABELS[rule.execution_spec?.execution_type]?.label || t('automations_tab.action_label', 'Ação')}</span></Badge>
                                            {rule.execution_count > 0 && <span className="text-muted-foreground ml-auto">{t('automations_tab.execution_count', 'Executada {{count}}x', { count: rule.execution_count })}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePreviewRule(rule.id); }}><Eye className="w-4 h-4 mr-1" />{t('automations_tab.preview_btn', 'Preview')}</Button>
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toast({ title: t('automations_tab.soon', 'Em breve'), description: t('automations_tab.edit_soon_desc', 'Edição de regras será implementada em breve.') }); }}><Pencil className="w-4 h-4 mr-1" />{t('automations_tab.edit_btn', 'Editar')}</Button>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}><Trash2 className="w-4 h-4 mr-1" />{t('automations_tab.delete_btn', 'Excluir')}</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    {selectedRule && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{t('automations_tab.history.title', 'Histórico de Execuções')}</CardTitle>
                                <CardDescription>{t('automations_tab.history.subtitle', 'Regra: {{name}}', { name: selectedRule.name })}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {logs.length === 0 ? <p className="text-muted-foreground text-center py-8">{t('automations_tab.history.empty', 'Nenhuma execução registrada ainda.')}</p> : (
                                    <div className="space-y-3">
                                        {logs.map((log) => (
                                            <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                                                <div className="flex items-center gap-3">
                                                    {log.result === "SUCCESS" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                                                    <div>
                                                        <p className="font-medium">{log.action_taken}</p>
                                                        <p className="text-sm text-muted-foreground">{new Date(log.executed_at).toLocaleString(i18n.language === 'pt' ? 'pt-BR' : 'en-US')}</p>
                                                    </div>
                                                </div>
                                                <Badge variant={log.result === "SUCCESS" ? "default" : "destructive"}>{t('automations_tab.history.entities_count', '{{count}} entidade(s)', { count: log.entities_affected })}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

const Automations = () => (
    <AutomationsErrorBoundary>
        <AutomationsInner />
    </AutomationsErrorBoundary>
);

export default Automations;
