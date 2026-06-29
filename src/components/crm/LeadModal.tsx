import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrmLead, KanbanColumn } from "@/pages/Comercial";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAgencyProducts } from "@/hooks/useAgencyProducts";
import { Loader2, User, Building, Phone, Mail, ShoppingCart, BarChart3, MessageSquare, Globe, ExternalLink, Activity, TrendingUp, ArrowLeft, ArrowRight, Archive, Wand2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const leadSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    store_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    lead_score: z.string().optional(),
    product_interest: z.string().optional(),
    observations: z.string().optional(),
    lead_status: z.string().default('contato'),
    column_id: z.string().optional(),
    site_url: z.string().url("URL inválida").optional().or(z.literal("")),
    revenue: z.string().optional(),
    offer_detail: z.string().optional(),
    project_type: z.string().optional(),
    project_timeline: z.string().optional(),
    budget_range: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface LeadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leadToEdit: CrmLead | null;
    columns: KanbanColumn[];
    onSaved: () => void;
    onArchive?: (id: string) => void;
}

const inputClasses = "h-12 bg-secondary/30 border-border/50 rounded-xl text-sm font-medium transition-all focus:border-primary/50 focus:ring-primary/20";
const labelClasses = "text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2";

export function LeadModal({ open, onOpenChange, leadToEdit, columns, onSaved, onArchive }: LeadModalProps) {
    const { workspaceId } = useDashboard();
    const { products, isLoading: isLoadingProducts } = useAgencyProducts();
    const [step, setStep] = useState<1 | 2>(1);

    // Saudação WhatsApp gerada pela skill Heloisa (rascunho editável antes do envio).
    const [whatsappMessage, setWhatsappMessage] = useState("");
    const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);
    const [isSendingWa, setIsSendingWa] = useState(false);

    const form = useForm<LeadFormValues>({
        resolver: zodResolver(leadSchema),
        defaultValues: {
            name: "",
            store_name: "",
            phone: "",
            email: "",
            lead_score: "",
            product_interest: "",
            observations: "",
            lead_status: 'contato',
            column_id: "",
            site_url: "",
            revenue: "",
            offer_detail: "",
            project_type: "",
            project_timeline: "",
            budget_range: "",
        },
    });

    const isLoading = form.formState.isSubmitting;

    useEffect(() => {
        if (open) {
            setStep(1);
            setWhatsappMessage("");
            form.reset({
                name: leadToEdit?.name || "",
                store_name: leadToEdit?.store_name || "",
                phone: leadToEdit?.phone || "",
                email: leadToEdit?.email || "",
                lead_score: leadToEdit?.lead_score || "",
                product_interest: leadToEdit?.product_interest || "",
                observations: leadToEdit?.observations || "",
                lead_status: leadToEdit?.lead_status || 'contato',
                column_id: leadToEdit?.column_id || "",
                site_url: leadToEdit?.site_url || "",
                revenue: leadToEdit?.revenue || "",
                offer_detail: leadToEdit?.offer_detail || "",
                project_type: leadToEdit?.project_type || "",
                project_timeline: leadToEdit?.project_timeline || "",
                budget_range: leadToEdit?.budget_range || "",
            });
        }
    }, [open, leadToEdit, form]);

    const onSubmit = async (values: LeadFormValues) => {
        // Guarda: se ainda estamos no Step 1 (Captura), nao salva ainda — apenas
        // avanca pra Qualificacao. Cobre submit implicito do navegador (Enter num
        // input quando o footer do Step 1 nao tem botao type=submit) e qualquer
        // outro caminho que dispare submit fora de hora.
        if (step === 1) {
            setStep(2);
            return;
        }

        if (!workspaceId) {
            toast.error("Erro: Workspace não identificado.");
            return;
        }

        try {
            // Find current column to sync lead_status text
            const selectedCol = columns.find(c => c.id === values.column_id);
            const payload = {
                ...values,
                workspace_id: workspaceId,
                lead_status: selectedCol ? selectedCol.title.toLowerCase().replace(/\s+/g, '_') : values.lead_status
            };

            let error;
            if (leadToEdit) {
                const { error: updateError } = await supabase
                    .from('crm_leads' as any)
                    .update(payload)
                    .eq('id', leadToEdit.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('crm_leads' as any)
                    .insert(payload);
                error = insertError;
            }

            if (error) throw error;

            toast.success(leadToEdit ? "Lead atualizado!" : "Lead criado!");
            onSaved();
        } catch (error: any) {
            console.error("Error saving lead:", error);
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    const handleWhatsApp = () => {
        const phone = form.getValues("phone");
        if (!phone) {
            toast.error("Telefone não informado.");
            return;
        }
        const cleanPhone = phone.replace(/\D/g, "");
        window.open(`https://wa.me/${cleanPhone}`, "_blank");
    };

    const handleOpenSite = () => {
        const url = form.getValues("site_url");
        if (!url) {
            toast.error("Site não informado.");
            return;
        }
        window.open(url.startsWith("http") ? url : `https://${url}`, "_blank");
    };

    // Gera saudação WhatsApp via edge function dedicada `crm-generate-greeting`.
    // Padrão JEB Deep Module: interface estreita — front só manda { leadId },
    // toda a complexidade (busca lead, prompt Heloisa, IA com fallback
    // Gemini→Claude, logs) fica na edge function. Antes o front montava prompt
    // e chamava `claude-ai` genérica, que voltava 500 sem detalhe.
    const handleGenerateMessage = async () => {
        if (!leadToEdit?.id) {
            toast.error("Salve o lead antes de gerar a saudação.");
            return;
        }
        if (!form.getValues("name")) {
            toast.error("Lead sem nome — preencha antes de gerar.");
            return;
        }
        setIsGeneratingMsg(true);
        try {
            const { data, error } = await supabase.functions.invoke('crm-generate-greeting', {
                body: { leadId: leadToEdit.id },
            });

            // supabase.functions.invoke retorna { error: FunctionsHttpError } em status
            // não-2xx. O body de erro fica em error.context (Response object).
            if (error) {
                let detail = (error as any)?.message || 'erro desconhecido';
                const ctx = (error as any)?.context;
                if (ctx && typeof ctx.json === 'function') {
                    try {
                        const body = await ctx.json();
                        if (body?.error) detail = body.error;
                    } catch { /* sem body parseavel */ }
                }
                throw new Error(detail);
            }

            const text: string = (data?.message || '').toString().trim();
            if (!text) throw new Error('Resposta vazia da IA.');

            setWhatsappMessage(text);
            toast.success(`Mensagem gerada via ${data?.model || 'IA'}. Revise antes de disparar.`);
        } catch (err: any) {
            console.error('[LeadModal] Erro ao gerar mensagem:', err);
            toast.error(`Erro ao gerar mensagem: ${err?.message || 'desconhecido'}`);
        } finally {
            setIsGeneratingMsg(false);
        }
    };

    // Dispara a mensagem do textarea via Evolution API (não abre WhatsApp Web).
    // Resolve instance_name do workspace owner em whatsapp_connections, formata
    // o phone respeitando o DDI já presente, envia via edge function send-whatsapp.
    const handleSendWhatsApp = async () => {
        const msg = whatsappMessage.trim();
        const rawPhone = form.getValues("phone");
        if (!msg) {
            toast.error("Gere ou escreva uma mensagem antes de disparar.");
            return;
        }
        if (!rawPhone) {
            toast.error("Lead sem telefone — preencha o campo antes.");
            return;
        }
        if (!workspaceId) {
            toast.error("Workspace não identificado.");
            return;
        }

        // Formatação de phone com respeito ao DDI:
        //  - Se já vem com + no original (ex +19085762850 = US), MANTÉM o DDI que
        //    o usuário digitou — só limpa não-dígitos.
        //  - Se vem sem + (ex 11965720881), assume Brasil e prependa 55.
        //  - Bug de 2026-05-28: forcava 55 sempre, então +1 (US) virava 5519...
        //    invalido pro Evolution API → 400.
        const hadCountryPrefix = rawPhone.trim().startsWith('+');
        let phone = rawPhone.replace(/\D/g, '');
        if (!hadCountryPrefix && !phone.startsWith('55')) {
            phone = '55' + phone;
        }
        // Phone valido em E.164 sem o + tem entre 10 e 15 digitos
        if (phone.length < 10 || phone.length > 15) {
            toast.error(`Número inválido (${phone.length} dígitos). Verifique o campo Telefone.`);
            return;
        }

        setIsSendingWa(true);
        try {
            // Resolve instance do workspace owner
            const { data: ws } = await (supabase as any)
                .from('workspaces')
                .select('owner_id')
                .eq('id', workspaceId)
                .single();
            if (!ws?.owner_id) throw new Error("Workspace sem dono.");

            const { data: conn } = await (supabase as any)
                .from('whatsapp_connections')
                .select('instance_name')
                .eq('user_id', ws.owner_id)
                .eq('status', 'connected')
                .maybeSingle();
            if (!conn?.instance_name) throw new Error("Nenhuma instância WhatsApp conectada no workspace.");

            const { data, error } = await supabase.functions.invoke('send-whatsapp', {
                body: { instanceName: conn.instance_name, groupId: phone, text: msg },
            });

            // supabase.functions.invoke devolve error com Response em context — extrai
            // o body real pra mostrar o motivo (Evolution não-2xx, Zod payload inválido, etc).
            if (error) {
                let detail = (error as any)?.message || 'erro desconhecido';
                const ctx = (error as any)?.context;
                if (ctx && typeof ctx.json === 'function') {
                    try {
                        const body = await ctx.json();
                        if (body?.details) {
                            detail = typeof body.details === 'string' ? body.details : JSON.stringify(body.details);
                        } else if (body?.error) {
                            detail = body.error;
                        }
                    } catch { /* nao parseavel */ }
                }
                throw new Error(detail);
            }
            if (data?.error) throw new Error(data.error);
            toast.success(`WhatsApp enviado pra ${form.getValues("name")}.`);
        } catch (err: any) {
            console.error('[LeadModal] Erro ao enviar WhatsApp:', err);
            toast.error("Erro ao enviar: " + (err.message || 'desconhecido'));
        } finally {
            setIsSendingWa(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] w-[95vw] max-h-[95vh] overflow-y-auto bg-card border-primary/20 shadow-2xl backdrop-blur-md p-0">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-5 sm:p-8 pb-4 sm:pb-6 border-b border-border/10 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                        <DialogHeader className="space-y-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="p-3 sm:p-4 bg-secondary/50 rounded-2xl flex items-center justify-center border border-border/50 shrink-0">
                                    <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-foreground/80" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                                        {leadToEdit ? "Editar Lead" : "Novo Lead"}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground font-medium text-xs sm:text-sm hidden sm:block">
                                        Gerencie as informações comerciais do seu prospecto com máxima clareza.
                                    </DialogDescription>
                                </div>
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className={cn(
                                        "flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left",
                                        step === 1
                                            ? "bg-blue-500/10 border-blue-500/40 text-blue-500"
                                            : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50"
                                    )}
                                >
                                    <span className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0",
                                        step === 1 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
                                    )}>1</span>
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Captura</span>
                                </button>
                                <div className="h-px w-3 sm:w-6 bg-border/40 shrink-0" />
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className={cn(
                                        "flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left",
                                        step === 2
                                            ? "bg-primary/10 border-primary/40 text-primary"
                                            : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50"
                                    )}
                                >
                                    <span className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0",
                                        step === 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                    )}>2</span>
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Qualificação</span>
                                </button>
                            </div>
                        </DialogHeader>
                    </div>

                    {/* Sem onSubmit no form: submit so via click explicito no botao "Salvar".
                        Tambem prevent Enter key de salvar o lead acidentalmente. */}
                    <form onSubmit={(e) => e.preventDefault()} className="p-5 sm:p-8 pt-5 sm:pt-6 space-y-6 sm:space-y-8">

                        {/* ===================================================== */}
                        {/* SEÇÃO 1 — DADOS DA CAPTURA (vieram do formulário)      */}
                        {/* ===================================================== */}
                        {step === 1 && (
                        <section className="space-y-5">
                            <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <User className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Dados da Captura</h3>
                                    <p className="text-[11px] text-muted-foreground font-medium">Informações enviadas pelo lead através do formulário</p>
                                </div>
                            </div>

                            {/* Row: Nome + Loja (2 cols) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className={labelClasses}>
                                        <User className="h-3 w-3" /> Nome do Cliente
                                    </Label>
                                    <Input id="name" {...form.register("name")} placeholder="Ex: João Silva" className={inputClasses} />
                                    {form.formState.errors.name && <p className="text-destructive text-[10px] font-bold uppercase tracking-tight pl-1">{form.formState.errors.name.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="store_name" className={labelClasses}>
                                        <Building className="h-3 w-3" /> Nome da Loja / Empresa
                                    </Label>
                                    <Input id="store_name" {...form.register("store_name")} placeholder="Ex: Boutique X" className={inputClasses} />
                                </div>
                            </div>

                            {/* Row: Telefone + Email (2 cols) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className={labelClasses}>
                                        <Phone className="h-3 w-3" /> Telefone / WhatsApp
                                    </Label>
                                    <div className="relative">
                                        <Input id="phone" {...form.register("phone")} placeholder="(00) 00000-0000" className={cn(inputClasses, "pr-10")} />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleWhatsApp}
                                            className="absolute right-1 top-1 h-10 w-10 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                        >
                                            <Phone className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className={labelClasses}>
                                        <Mail className="h-3 w-3" /> Email
                                    </Label>
                                    <Input id="email" {...form.register("email")} placeholder="cliente@email.com" className={inputClasses} />
                                    {form.formState.errors.email && <p className="text-destructive text-[10px] font-bold uppercase tracking-tight pl-1">{form.formState.errors.email.message}</p>}
                                </div>
                            </div>

                            {/* Row: Site + Faturamento (2 cols) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="site_url" className={labelClasses}>
                                        <Globe className="h-3 w-3" /> Site / Link do Cliente
                                    </Label>
                                    <div className="relative">
                                        <Input id="site_url" {...form.register("site_url")} placeholder="https://exemplo.com.br" className={cn(inputClasses, "pr-10")} />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleOpenSite}
                                            className="absolute right-1 top-1 h-10 w-10 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {form.formState.errors.site_url && <p className="text-destructive text-[10px] font-bold uppercase tracking-tight pl-1">{form.formState.errors.site_url.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="revenue" className={labelClasses}>
                                        <TrendingUp className="h-3 w-3" /> Faturamento
                                    </Label>
                                    <Select
                                        value={form.watch("revenue") || ""}
                                        onValueChange={(val) => form.setValue("revenue", val)}
                                    >
                                        <SelectTrigger className={cn(inputClasses, "capitalize")}>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Ate 50k" className="capitalize">Até 50k</SelectItem>
                                            <SelectItem value="50k-200k" className="capitalize">50k - 200k</SelectItem>
                                            <SelectItem value="200k-500k" className="capitalize">200k - 500k</SelectItem>
                                            <SelectItem value="500k-1M" className="capitalize">500k - 1M</SelectItem>
                                            <SelectItem value="Acima 1M" className="capitalize">Acima de 1M</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Produto (vertente — vem do form) */}
                            <div className="space-y-2">
                                <Label htmlFor="product_interest" className={labelClasses}>
                                    <ShoppingCart className="h-3 w-3" /> Produto <span className="opacity-50 normal-case ml-1">(vertente — vem do formulário)</span>
                                </Label>
                                <Input id="product_interest" {...form.register("product_interest")} placeholder="Ex: Assessoria, Site, Sistema..." className={inputClasses} />
                            </div>

                            {/* Row: Tipo + Prazo + Orçamento (3 cols) — só pra leads tech */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="project_type" className={labelClasses}>Tipo</Label>
                                    <Input id="project_type" {...form.register("project_type")} placeholder="Ex: loja-nova" className={inputClasses} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="project_timeline" className={labelClasses}>Prazo</Label>
                                    <Select
                                        value={form.watch("project_timeline") || ""}
                                        onValueChange={(val) => form.setValue("project_timeline", val)}
                                    >
                                        <SelectTrigger className={cn(inputClasses, "capitalize")}>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="<1mes">Menos de 1 mês</SelectItem>
                                            <SelectItem value="1-3meses">1 a 3 meses</SelectItem>
                                            <SelectItem value="3-6meses">3 a 6 meses</SelectItem>
                                            <SelectItem value="6+meses">6+ meses</SelectItem>
                                            <SelectItem value="sem-prazo">Sem prazo definido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="budget_range" className={labelClasses}>Orçamento</Label>
                                    <Select
                                        value={form.watch("budget_range") || ""}
                                        onValueChange={(val) => form.setValue("budget_range", val)}
                                    >
                                        <SelectTrigger className={cn(inputClasses, "capitalize")}>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ate-10k">Até R$ 10k</SelectItem>
                                            <SelectItem value="10k-30k">R$ 10k - 30k</SelectItem>
                                            <SelectItem value="30k-80k">R$ 30k - 80k</SelectItem>
                                            <SelectItem value="80k-200k">R$ 80k - 200k</SelectItem>
                                            <SelectItem value="200k+">Acima de R$ 200k</SelectItem>
                                            <SelectItem value="a-definir">A definir</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>

                        )}

                        {/* ===================================================== */}
                        {/* SEÇÃO 2 — QUALIFICAÇÃO COMERCIAL (preenche manualmente) */}
                        {/* ===================================================== */}
                        {step === 2 && (
                        <section className="space-y-5">
                            <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Activity className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Qualificação Comercial</h3>
                                    <p className="text-[11px] text-muted-foreground font-medium">Preenchido pelo time durante o atendimento</p>
                                </div>
                            </div>

                            {/* Row: Temperatura + Etapa do Funil (2 cols) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="lead_score" className={labelClasses}>
                                        <BarChart3 className="h-3 w-3" /> Temperatura
                                    </Label>
                                    <Select
                                        value={form.watch("lead_score") || ""}
                                        onValueChange={(val) => form.setValue("lead_score", val)}
                                    >
                                        <SelectTrigger className={cn(inputClasses, "capitalize")}>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Frio" className="capitalize">Frio</SelectItem>
                                            <SelectItem value="Morno" className="capitalize">Morno</SelectItem>
                                            <SelectItem value="Quente" className="capitalize">Quente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="column_id" className={labelClasses}>
                                        <Activity className="h-3 w-3" /> Etapa do Funil
                                    </Label>
                                    <Select
                                        value={form.watch("column_id") || ""}
                                        onValueChange={(val) => form.setValue("column_id", val)}
                                    >
                                        <SelectTrigger className={cn(inputClasses, "capitalize")}>
                                            <SelectValue placeholder="Selecione a etapa..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {columns?.map(col => (
                                                <SelectItem key={col.id} value={col.id} className="capitalize">
                                                    {col.title.toLowerCase()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Oferta Detalhada (full-width) */}
                            <div className="space-y-2">
                                <Label htmlFor="offer_detail" className={labelClasses}>
                                    <ShoppingCart className="h-3 w-3" /> Oferta Detalhada <span className="opacity-50 normal-case ml-1">(definida após qualificação)</span>
                                </Label>
                                <Select
                                    value={form.watch("offer_detail") || ""}
                                    onValueChange={(val) => form.setValue("offer_detail", val)}
                                    disabled={isLoadingProducts}
                                >
                                    <SelectTrigger className={cn(inputClasses, "capitalize")}>
                                        <SelectValue placeholder={isLoadingProducts ? "Carregando..." : "Selecione a oferta específica..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products?.map(product => (
                                            <SelectItem key={product.id} value={product.name} className="capitalize">
                                                {product.name.toLowerCase()}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Histórico & Observações (full-width) */}
                            <div className="space-y-2">
                                <Label htmlFor="observations" className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2 border-l-2 border-primary/20 pl-3">
                                    <MessageSquare className="h-4 w-4" /> Histórico & Observações
                                </Label>
                                <Textarea
                                    id="observations"
                                    {...form.register("observations")}
                                    placeholder="Descreva o andamento da negociação, pontos chave e próximos passos com detalhes..."
                                    className="bg-secondary/20 border-border/50 min-h-[200px] max-h-[400px] rounded-2xl p-5 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-primary/10 transition-all border-dashed"
                                />
                            </div>

                            {/* Saudação WhatsApp (Heloisa) — gera + revisa + dispara */}
                            <div className="space-y-3 pt-2 border-t border-border/20 mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2 border-l-2 border-emerald-500/40 pl-3">
                                        <Phone className="h-4 w-4 text-emerald-500" /> Saudação WhatsApp
                                        <span className="normal-case opacity-50 text-[10px] ml-1">(Heloisa gera, você revisa e dispara)</span>
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateMessage}
                                        disabled={isGeneratingMsg || isSendingWa || !leadToEdit?.id}
                                        title={!leadToEdit?.id ? "Salve o lead primeiro pra gerar saudação" : undefined}
                                        className="h-9 gap-2 font-bold uppercase tracking-widest text-[10px] border-violet-500/40 text-violet-500 hover:bg-violet-500/10 hover:text-violet-500"
                                    >
                                        {isGeneratingMsg ? (
                                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
                                        ) : (
                                            <><Wand2 className="h-3.5 w-3.5" /> {whatsappMessage ? 'Gerar de novo' : 'Gerar mensagem'}</>
                                        )}
                                    </Button>
                                </div>
                                <Textarea
                                    value={whatsappMessage}
                                    onChange={(e) => setWhatsappMessage(e.target.value)}
                                    placeholder={isGeneratingMsg ? "Heloisa rascunhando..." : "Clique em \"Gerar mensagem\" pra Heloisa rascunhar uma saudação baseada no contexto desse lead. Você pode editar antes de disparar."}
                                    className="bg-secondary/20 border-border/50 min-h-[120px] max-h-[300px] rounded-2xl p-5 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    disabled={isGeneratingMsg}
                                />
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={handleSendWhatsApp}
                                        disabled={!whatsappMessage.trim() || isSendingWa || isGeneratingMsg}
                                        className="h-10 gap-2 font-bold uppercase tracking-widest text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl"
                                    >
                                        {isSendingWa ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                                        ) : (
                                            <><Send className="h-4 w-4" /> Disparar no WhatsApp</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </section>
                        )}

                        {/* Step-aware footer (sticky no mobile via padding generoso) */}
                        <DialogFooter className="flex-row gap-2 sm:gap-3 pt-6 border-t border-border/10 sm:justify-between">
                            {/* Botão Arquivar (apenas editando) — some pra Configurações > Leads Arquivados */}
                            {leadToEdit && onArchive ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { onArchive(leadToEdit.id); }}
                                    className="h-12 sm:px-5 font-bold uppercase tracking-widest text-[10px] sm:text-[11px] gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                                >
                                    <Archive className="h-4 w-4" /> Arquivar
                                </Button>
                            ) : <div />}
                            <div className="flex gap-2 sm:gap-3">
                            {step === 1 ? (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-12 flex-1 sm:flex-initial sm:px-8 font-bold uppercase tracking-widest text-[10px] sm:text-[11px]">
                                        Fechar
                                    </Button>
                                    <Button type="button" onClick={() => setStep(2)} className="h-12 flex-1 sm:flex-initial sm:min-w-[200px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px] sm:text-[11px] sm:px-10 rounded-xl active:scale-95 transition-all shadow-none gap-2">
                                        Próximo <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="h-12 flex-1 sm:flex-initial sm:px-6 font-bold uppercase tracking-widest text-[10px] sm:text-[11px] gap-2">
                                        <ArrowLeft className="h-4 w-4" /> Voltar
                                    </Button>
                                    {/* type=button + submit manual via handleSubmit: evita o bug de o
                                        botao "Proximo" do step 1 ser trocado pelo "Salvar" type=submit
                                        no mesmo XY e o click original disparar submit indesejado. */}
                                    <Button
                                        type="button"
                                        disabled={isLoading}
                                        onClick={form.handleSubmit(onSubmit)}
                                        className="h-12 flex-1 sm:flex-initial sm:min-w-[200px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px] sm:text-[11px] sm:px-10 rounded-xl active:scale-95 transition-all shadow-none"
                                    >
                                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (leadToEdit ? "Salvar Alterações" : "Cadastrar Lead")}
                                    </Button>
                                </>
                            )}
                            </div>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
