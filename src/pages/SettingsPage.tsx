import { useState, useEffect } from "react";
import { useDashboard } from "@/contexts/DashboardContext";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Bell, Shield, Settings, Check, Globe, Clock, Minus, LogOut, User, Building2, Users, Archive, ArchiveRestore, Loader2, Trash2, Link, ClipboardCheck, Flag, Target, Phone, Mail, Store } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UsageProgressBar from "@/components/UsageProgressBar";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { NotificationSettingsForm } from "@/components/NotificationSettingsForm";
import { useTranslation } from "react-i18next";

import Profile from "./Profile";
import TeamConnections from "./TeamConnections";
import Connections from "./Connections";
import { CleanupUtility } from "@/components/admin/CleanupUtility";
import { useTasks } from "@/contexts/TasksContext";
import { TaskDetailModal } from "@/components/lever-os/TaskDetailModal";
import type { Task } from "@/types/lever-os";

const SettingsPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: planUsage, isLoading: isLoadingUsage } = usePlanUsage();
  const { t, i18n } = useTranslation();
  const { refreshClients, workspaceId } = useDashboard();
  const { openTaskDetail, selectedTask, closeTaskDetail } = useTasks();
  const queryClient = useQueryClient();
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  // Fetch archived clients
  const { data: archivedClients = [], isLoading: isLoadingArchived } = useQuery({
    queryKey: ['archived_clients'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('agency_clients')
        .select('id, name, fee_fixed, commission_rate, created_at, logo_url')
        .eq('is_archived', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Demandas Concluídas: traz qualquer task com status canônico 'concluido'
  // OU já arquivada (archived_at preenchido). Antes filtrava só archived,
  // por isso só apareciam 5 de muitas concluídas — agora aparece o histórico
  // completo. Carrega os campos necessários pra abrir o TaskDetailModal.
  const { data: archivedTasks = [], isLoading: isLoadingArchivedTasks } = useQuery({
    queryKey: ['archived_tasks', workspaceId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('client_tasks')
        .select('id, title, description, client_id, priority, area, archived_at, completed_at, created_at, due_date, status, assignee_id, images, drive_links, cover_image_url, project_type, attachments, step_id, category, order_position, workspace_id, clients:client_id(name)')
        .or('status.eq.concluido,archived_at.not.is.null')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(500);
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch leads arquivados (lead.archived_at != null)
  const { data: archivedLeads = [], isLoading: isLoadingArchivedLeads } = useQuery({
    queryKey: ['archived_leads', workspaceId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('crm_leads')
        .select('id, name, store_name, phone, email, site_url, revenue, lead_score, product_interest, observations, archived_at, created_at')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .limit(500);
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const handleUnarchiveLead = async (leadId: string, leadName: string) => {
    try {
      const { error } = await (supabase as any)
        .from('crm_leads')
        .update({ archived_at: null })
        .eq('id', leadId);
      if (error) throw error;
      toast({
        title: "Lead restaurado!",
        description: `"${leadName}" voltou pro funil do CRM.`,
      });
      queryClient.invalidateQueries({ queryKey: ['archived_leads'] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: err.message || "Não foi possível restaurar o lead.",
      });
    }
  };

  // Converte registro do banco em Task pra abrir no TaskDetailModal
  const openArchivedTaskDetail = (t: any) => {
    const task: Task = {
      id: t.id,
      clientId: t.client_id,
      clientName: t.clients?.name,
      title: t.title || 'Sem título',
      description: t.description || '',
      status: t.status || 'concluido',
      assigneeId: t.assignee_id,
      priority: t.priority || 'medium',
      createdAt: t.created_at,
      dueDate: t.due_date || undefined,
      area: t.area || undefined,
      projectType: t.project_type ?? null,
      stepId: t.step_id,
      category: t.category,
      coverImageUrl: t.cover_image_url,
      images: t.images || [],
      drive_links: t.drive_links || [],
      attachments: t.attachments || [],
      completedAt: t.completed_at,
      archivedAt: t.archived_at || undefined,
      order_position: t.order_position,
      workspace_id: t.workspace_id,
      checklist: [],
    } as Task;
    openTaskDetail(task);
  };

  const handleUnarchive = async (client: any) => {
    setUnarchivingId(client.id);
    try {
      const { error } = await (supabase as any)
        .from('agency_clients')
        .update({ is_archived: false })
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: "Cliente desarquivado!",
        description: `${client.name} voltou para a lista de clientes ativos.`,
      });

      // Update archived list locally
      queryClient.invalidateQueries({ queryKey: ['archived_clients'] });

      // Update global context list
      await refreshClients();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: err.message || "Não foi possível desarquivar.",
      });
    } finally {
      setUnarchivingId(null);
    }
  };

  // State for AI Language
  const [aiLanguage, setAiLanguage] = useState<string>(
    localStorage.getItem('lads_ai_language') || 'pt-BR'
  );
  const [agencyName, setAgencyName] = useState(localStorage.getItem('lads_agency_name') || '');
  const [agencyLogoUrl, setAgencyLogoUrl] = useState(localStorage.getItem('lads_agency_logo_url') || '');

  const currentTab = searchParams.get("tab") || "general";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('i18nextLng', value);
  };

  const handleAiLanguageChange = (value: string) => {
    setAiLanguage(value);
    localStorage.setItem('lads_ai_language', value);
  };

  const handleSaveGeneral = () => {
    toast({
      title: t('settings.saved_success'),
      description: t('settings.saved_desc'),
    });
  };

  const handleSaveAgency = () => {
    localStorage.setItem('lads_agency_name', agencyName);
    localStorage.setItem('lads_agency_logo_url', agencyLogoUrl);
    toast({
      title: t('reports.config.whitelabel.save_success', "Configurações da Agência Salvas"),
      description: t('reports.config.whitelabel.save_desc', "As informações da sua marca foram atualizadas."),
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const PricingCard = ({
    title,
    price,
    description,
    features,
    excludedFeatures = [],
    isCurrent,
    limit
  }: {
    title: string,
    price: string,
    description: string,
    features: string[],
    excludedFeatures?: string[],
    isCurrent: boolean,
    limit: string
  }) => (
    <Card className={`relative flex flex-col transition-all duration-300 ${isCurrent ? 'ring-2 ring-primary bg-slate-50 dark:bg-slate-900 scale-[1.02]' : 'hover:-translate-y-1'}`}>
      {isCurrent && (
        <div className="absolute -top-3 right-4 bg-meta-gradient text-white text-xs font-bold px-3 py-1 rounded-full">
          {isCurrent ? t('plans.current_plan') : ''}
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold tracking-tight">{price}</span>
          <span className="text-muted-foreground">{t('plans.per_month')}</span>
        </div>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className={`mb-6 p-3 rounded-lg border ${isCurrent ? 'bg-primary/10 border-primary/20 dark:bg-primary/20 dark:border-primary/30' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-700'}`}>
          <p className={`text-sm font-medium flex items-center gap-2 ${isCurrent ? 'text-primary dark:text-primary-foreground' : 'text-slate-700 dark:text-slate-300'}`}>
            <Check className={`h-4 w-4 ${isCurrent ? 'text-primary' : 'text-slate-500'}`} />
            {t('plans.limit_label', { limit })}
          </p>
        </div>
        <ul className="space-y-3 text-sm">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${isCurrent ? 'bg-primary/20 dark:bg-primary/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <Check className={`h-3 w-3 ${isCurrent ? 'text-primary dark:text-primary-foreground' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <span className="text-foreground/80">{feature}</span>
            </li>
          ))}
          {excludedFeatures.map((feature, i) => (
            <li key={i} className="flex items-center gap-3 text-muted-foreground/50">
              <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Minus className="h-3 w-3 text-gray-400" />
              </div>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className={`w-full font-semibold ${isCurrent ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30' : 'bg-meta-gradient text-white'}`}
          variant={isCurrent ? "outline" : "default"}
          disabled={isCurrent}
        >
          {isCurrent ? t('plans.your_plan') : t('plans.upgrade')}
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="pt-8 pb-10 px-2 md:px-4 space-y-8">
      <Tabs defaultValue={currentTab} value={currentTab} onValueChange={handleTabChange} className="space-y-6 flex-1 flex flex-col">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
            <p className="text-muted-foreground">{t('settings.description')}</p>
          </div>

          <div className="hidden lg:flex items-center overflow-x-auto no-scrollbar">
            <TabsList className="h-10">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.tabs.general')}</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.tabs.team')}</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.tabs.notifications')}</span>
              </TabsTrigger>
              <TabsTrigger value="connections" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">{t('sidebar.connections')}</span>
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">Arquivados</span>
                {archivedClients.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{archivedClients.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="archived-leads" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Leads Arquivados</span>
                {archivedLeads.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{archivedLeads.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed-tasks" className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Demandas Concluídas</span>
                {archivedTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{archivedTasks.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Mobile Tabs List underneath header */}
        <div className="flex lg:hidden overflow-x-auto pb-2 no-scrollbar">
          <TabsList className="h-10 w-max shrink-0">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>{t('settings.tabs.general')}</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{t('settings.tabs.team')}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span>{t('settings.tabs.notifications')}</span>
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              <span>{t('sidebar.connections')}</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              <span>Arquivados</span>
              {archivedClients.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{archivedClients.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived-leads" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>Leads Arquivados</span>
              {archivedLeads.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{archivedLeads.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed-tasks" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span>Demandas Concluídas</span>
              {archivedTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{archivedTasks.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>



        {/* ABA GERAL */}
        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{t('settings.system_pref')}</CardTitle>
              <CardDescription>{t('settings.system_pref_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* UI LANGUAGE */}
                <div className="space-y-2">
                  <Label>{t('settings.language')}</Label>
                  <Select value={i18n.language.split('-')[0]} onValueChange={handleLanguageChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">
                        <div className="flex items-center gap-2">
                          {t('common.pt_br')}
                        </div>
                      </SelectItem>
                      <SelectItem value="en">
                        <div className="flex items-center gap-2">
                          {t('common.en_us')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* AI LANGUAGE */}
                <div className="space-y-2">
                  <Label>{t('settings.ai_language')}</Label>
                  <Select value={aiLanguage} onValueChange={handleAiLanguageChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">
                        <div className="flex items-center gap-2">
                          {t('common.pt_br')}
                        </div>
                      </SelectItem>
                      <SelectItem value="en-US">
                        <div className="flex items-center gap-2">
                          {t('common.en_us')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.ai_language_desc')}
                  </p>
                </div>

                {/* TIMEZONE */}
                <div className="space-y-2">
                  <Label>{t('settings.timezone')}</Label>
                  <Select defaultValue="gmt-3">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmt-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" /> {t('settings.timezone_br')}
                        </div>
                      </SelectItem>
                      <SelectItem value="utc">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" /> UTC
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.timezone_desc')}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={handleSaveGeneral}
                variant="destructive"
                className="rounded-lg h-10 px-8"
              >
                {t('settings.save')}
              </Button>
            </CardFooter>
          </Card>




        </TabsContent>

        {/* ABA EQUIPE */}
        <TabsContent value="team" className="space-y-6">
          <TeamConnections embedded={true} />
        </TabsContent>

        {/* ABA NOTIFICAÇÕES */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettingsForm />
        </TabsContent>

        {/* ABA CONEXÕES */}
        <TabsContent value="connections" className="space-y-6">
          <Connections embedded={true} />
        </TabsContent>

        {/* ABA CLIENTES ARQUIVADOS */}
        <TabsContent value="archived" className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-orange-500" />
                Clientes Arquivados
              </CardTitle>
              <CardDescription>
                Clientes que foram arquivados não aparecem na listagem principal. Você pode desarquivá-los a qualquer momento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingArchived ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : archivedClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum cliente arquivado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedClients.map((client: any) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        {client.logo_url ? (
                          <img src={client.logo_url} alt={client.name} className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Arquivado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unarchivingId === client.id}
                          onClick={() => handleUnarchive(client)}
                        >
                          {unarchivingId === client.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <ArchiveRestore className="w-4 h-4 mr-2" />
                              Desarquivar
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (!confirm(`Tem certeza que deseja excluir permanentemente o cliente ${client.name}?`)) return;

                            try {
                              const { error } = await (supabase as any)
                                .from('agency_clients')
                                .delete()
                                .eq('id', client.id);

                              if (error) throw error;

                              toast({
                                title: "Cliente excluído!",
                                description: `${client.name} foi removido permanentemente.`,
                              });
                              queryClient.invalidateQueries({ queryKey: ['archived_clients'] });
                            } catch (err: any) {
                              toast({
                                variant: "destructive",
                                title: "Erro",
                                description: err.message || "Não foi possível excluir o cliente.",
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA LEADS ARQUIVADOS */}
        <TabsContent value="archived-leads">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                Leads Arquivados
              </CardTitle>
              <CardDescription>
                Histórico de leads que foram arquivados do CRM. Restaure pra trazer de volta pro funil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingArchivedLeads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : archivedLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum lead arquivado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedLeads.map((lead: any) => {
                    const scoreColors: Record<string, string> = {
                      Quente: 'bg-red-500/15 text-red-500',
                      Morno: 'bg-amber-500/15 text-amber-500',
                      Frio: 'bg-blue-500/15 text-blue-500',
                    };
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-border/70 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate capitalize">{lead.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {lead.store_name && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Store className="h-3 w-3" />
                                  {lead.store_name}
                                </span>
                              )}
                              {lead.phone && (
                                <>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone}
                                  </span>
                                </>
                              )}
                              {lead.email && (
                                <>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                    <Mail className="h-3 w-3" />
                                    {lead.email}
                                  </span>
                                </>
                              )}
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                Arquivado em {new Date(lead.archived_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {lead.lead_score && (
                            <Badge variant="secondary" className={scoreColors[lead.lead_score] || ''}>
                              {lead.lead_score}
                            </Badge>
                          )}
                          {lead.product_interest && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                              {lead.product_interest}
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnarchiveLead(lead.id, lead.name)}
                          >
                            <ArchiveRestore className="w-4 h-4 mr-1" />
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA DEMANDAS CONCLUÍDAS */}
        <TabsContent value="completed-tasks">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-green-500" />
                Demandas Concluídas
              </CardTitle>
              <CardDescription>
                Histórico de todas as demandas concluídas. Clique em uma para ver detalhes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingArchivedTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : archivedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma demanda concluída</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedTasks.map((task: any) => {
                    const priorityColors: Record<string, string> = {
                      low: 'bg-green-500/15 text-green-500',
                      medium: 'bg-orange-500/15 text-orange-500',
                      high: 'bg-red-500/15 text-red-500',
                      critical: 'bg-red-600/15 text-red-600 font-bold',
                    };
                    const priorityLabels: Record<string, string> = {
                      low: 'Baixa',
                      medium: 'Média',
                      high: 'Alta',
                      critical: 'Crítica',
                    };
                    const refDate = task.completed_at || task.archived_at || task.created_at;
                    const dateLabel = task.archived_at ? 'Arquivado em' : 'Concluído em';
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-border/70 transition-all cursor-pointer"
                        onClick={() => openArchivedTaskDetail(task)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {task.clients?.name || 'Cliente desconhecido'}
                              </span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {dateLabel} {refDate ? new Date(refDate).toLocaleDateString('pt-BR') : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className={priorityColors[task.priority] || ''}>
                            <Flag className="w-3 h-3 mr-1" />
                            {priorityLabels[task.priority] || task.priority}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { error } = await (supabase as any)
                                  .from('client_tasks')
                                  .update({
                                    archived_at: null,
                                    status: 'em_progresso',
                                    completed_at: null,
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', task.id);
                                if (error) throw error;
                                toast({
                                  title: "Demanda restaurada!",
                                  description: `"${task.title}" voltou para o quadro de demandas.`,
                                });
                                queryClient.invalidateQueries({ queryKey: ['archived_tasks'] });
                              } catch (err: any) {
                                toast({
                                  variant: "destructive",
                                  title: "Erro",
                                  description: err.message || "Não foi possível restaurar.",
                                });
                              }
                            }}
                          >
                            <ArchiveRestore className="w-4 h-4 mr-1" />
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>




      </Tabs>

      {/* Modal de detalhes acionado ao clicar numa demanda da aba Concluídas */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={closeTaskDetail}
        />
      )}
    </div>
  );
};

export default SettingsPage;
