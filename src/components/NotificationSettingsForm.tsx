import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Bell, Smartphone, Mail } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { useTranslation } from "react-i18next";

interface NotificationSettings {
    user_id: string;
    whatsapp_number: string;
    whatsapp_enabled: boolean;
    alert_daily_summary: boolean;
    alert_weekly_report: boolean;
    alert_critical_roas: boolean;
    alert_budget_cap: boolean;
    alert_account_status: boolean;
}

export const NotificationSettingsForm = () => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { profile } = useProfile();

    // New UI States (Persisted in LocalStorage for now)
    const [appEnabled, setAppEnabled] = useState(false);
    const [emailEnabled, setEmailEnabled] = useState(false);

    // Alert Types (Persisted in DB)
    const [alertDailySummary, setAlertDailySummary] = useState(false);
    const [alertWeeklyReport, setAlertWeeklyReport] = useState(false);
    const [alertCriticalRoas, setAlertCriticalRoas] = useState(false);
    const [alertBudgetCap, setAlertBudgetCap] = useState(false);
    const [alertAccountStatus, setAlertAccountStatus] = useState(false);

    // Fetch existing settings (localStorage-only — notification_settings table not yet created)
    const { data: settings, isLoading } = useQuery({
        queryKey: ['notification-settings', profile?.id],
        queryFn: async () => {
            if (!profile?.id) return null;
            const stored = localStorage.getItem(`lads_notify_prefs_${profile.id}`);
            return stored ? JSON.parse(stored) as NotificationSettings : null;
        },
        enabled: !!profile?.id,
    });

    // Populate form
    useEffect(() => {
        // Load Local Preferences
        const storedApp = localStorage.getItem('lads_notify_app');
        const storedEmail = localStorage.getItem('lads_notify_email');
        if (storedApp) setAppEnabled(storedApp === 'true');
        if (storedEmail) setEmailEnabled(storedEmail === 'true');

        // Load DB Preferences
        if (settings) {
            setAlertDailySummary(settings.alert_daily_summary);
            setAlertWeeklyReport(settings.alert_weekly_report);
            setAlertCriticalRoas(settings.alert_critical_roas);
            setAlertBudgetCap(settings.alert_budget_cap);
            setAlertAccountStatus(settings.alert_account_status);
        }
    }, [settings]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!profile?.id) throw new Error("No user profile");

            // Persist Local Preferences
            localStorage.setItem('lads_notify_app', String(appEnabled));
            localStorage.setItem('lads_notify_email', String(emailEnabled));

            // Persist preferences in localStorage (until notification_settings table is created)
            const payload = {
                user_id: profile.id,
                whatsapp_enabled: false,
                alert_daily_summary: alertDailySummary,
                alert_weekly_report: alertWeeklyReport,
                alert_critical_roas: alertCriticalRoas,
                alert_budget_cap: alertBudgetCap,
                alert_account_status: alertAccountStatus
            };

            localStorage.setItem(`lads_notify_prefs_${profile.id}`, JSON.stringify(payload));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
            toast({ title: t('settings.notifications.save_success', "Preferências salvas"), description: t('settings.notifications.save_success_desc', "Seus alertas foram atualizados.") });
        },
        onError: (error: any) => {
            toast({ title: t('settings.notifications.save_error', "Erro ao salvar"), description: error.message, variant: "destructive" });
        }
    });

    if (isLoading) {
        return <div className="h-64 w-full bg-muted animate-pulse rounded-none" />;
    }

    return (
        <div className="space-y-6">
            <Card className="rounded-lg shadow-sm">
                <CardHeader className="border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bell className="h-5 w-5 text-primary" />
                        {t('settings.notifications.channels_title', 'Canais de Notificação')}
                    </CardTitle>
                    <CardDescription>
                        {t('settings.notifications.channels_desc', 'Escolha onde você deseja receber seus alertas.')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Smartphone className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">{t('settings.notifications.app_title', 'Notificações no App')}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {t('settings.notifications.app_desc', 'Receba notificações push no seu dispositivo.')}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={appEnabled}
                            onCheckedChange={setAppEnabled}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Mail className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">{t('settings.notifications.email_title', 'Notificações por E-mail')}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {t('settings.notifications.email_desc', 'Receba resumos e alertas no seu e-mail cadastrado.')}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={emailEnabled}
                            onCheckedChange={setEmailEnabled}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-lg shadow-sm">
                <CardHeader className="border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        {t('settings.notifications.preferences_title', 'O Que Você Quer Receber?')}
                    </CardTitle>
                    <CardDescription>
                        {t('settings.notifications.preferences_desc', 'Selecione os tipos de alerta que são importantes para você.')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">{t('settings.notifications.morning_brief_title', '☀️ Morning Brief')}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t('settings.notifications.morning_brief_desc', 'Resumo de performance de ontem (enviado às 08:00).')}
                            </p>
                        </div>
                        <Switch
                            checked={alertDailySummary}
                            onCheckedChange={setAlertDailySummary}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">{t('settings.notifications.roas_guardian_title', '📉 Guardião de ROAS/CPA')}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t('settings.notifications.roas_guardian_desc', 'Alerta imediato se as métricas cruzarem o limite de risco.')}
                            </p>
                        </div>
                        <Switch
                            checked={alertCriticalRoas}
                            onCheckedChange={setAlertCriticalRoas}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">{t('settings.notifications.account_status_title', '🚫 Status da Conta')}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t('settings.notifications.account_status_desc', 'Avise se alguma conta for bloqueada ou rejeitada.')}
                            </p>
                        </div>
                        <Switch
                            checked={alertAccountStatus}
                            onCheckedChange={setAlertAccountStatus}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">{t('settings.notifications.weekly_report_title', '📅 Relatório Semanal')}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t('settings.notifications.weekly_report_desc', 'PDF automático com insights toda segunda-feira.')}
                            </p>
                        </div>
                        <Switch
                            checked={alertWeeklyReport}
                            onCheckedChange={setAlertWeeklyReport}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">{t('settings.notifications.budget_alert_title', '💰 Alerta de Budget')}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t('settings.notifications.budget_alert_desc', 'Quando atingir 90% do orçamento diário/mensal.')}
                            </p>
                        </div>
                        <Switch
                            checked={alertBudgetCap}
                            onCheckedChange={setAlertBudgetCap}
                        />
                    </div>
                </CardContent>
                <CardFooter className="pt-4 border-t">
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full sm:w-auto h-11 px-8">
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        {t('settings.notifications.save_prefs', 'Salvar Preferências')}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
