import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useTasks } from "@/contexts/TasksContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyProducts, AgencyProduct, getPricingColor, getPricingLabel } from "@/hooks/useAgencyProducts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Star, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp, Package, Plus, Percent, DollarSign, Loader2, Check, Sparkles } from "lucide-react";
import { AutomationService } from "@/services/automations/AutomationService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTemplateForType } from "@/constants/onboarding-templates";
import type { OnboardingType } from "@/types/onboarding";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp
};

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    client_type: z.enum(["avulso", "fixo"]),
    fixed_value: z.string().refine((val) => !isNaN(parseFloat(val.replace(/\./g, '').replace(',', '.'))), "Valor inválido"),
    commission_rate: z.string().refine((val) => !isNaN(parseFloat(val)), "Porcentagem inválida"),
    commission_base: z.enum(["revenue", "spend"], {
        required_error: "Selecione uma base de cálculo",
    }),
    responsible_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});

export function NewClientModal({ trigger }: { trigger?: React.ReactNode }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { workspaceId, refreshClients } = useDashboard();
    const { loadClientTasks } = useTasks();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [shopifyDomain, setShopifyDomain] = useState("");
    const [shopifyCollaboratorCode, setShopifyCollaboratorCode] = useState("");
    const [onboardingType, setOnboardingType] = useState<OnboardingType | "">("");
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { products: dynamicProducts, isLoading: isLoadingProducts, refetch: refetchProducts } = useAgencyProducts();

    // Refetch products when modal opens to ensure we have the latest subtasks
    useEffect(() => {
        if (open) {
            refetchProducts();
        }
    }, [open, refetchProducts]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            client_type: "avulso",
            fixed_value: "0,00",
            commission_rate: "10",
            commission_base: "revenue",
            responsible_email: "",
        },
    });

    const toggleProduct = (productId: string) => {
        setSelectedProducts(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const isFixo = values.client_type === "fixo";
            const fixedValueFloat = isFixo ? parseFloat(values.fixed_value.replace(/\./g, '').replace(',', '.')) : 0;
            const commissionRateFloat = isFixo ? parseFloat(values.commission_rate) : 0;

            if (!user) {
                toast({
                    variant: "destructive",
                    title: "Erro de autenticação",
                    description: "Você precisa estar logado para criar um cliente.",
                });
                return;
            }

            if (selectedProducts.length === 0) {
                toast({
                    variant: "destructive",
                    title: "Produto Obrigatório",
                    description: "Selecione pelo menos um produto para criar o cliente.",
                });
                return;
            }

            // 1. Create client
            const insertData: any = {
                name: values.name,
                client_type: values.client_type,
                fee_fixed: fixedValueFloat,
                commission_rate: commissionRateFloat,
                user_id: user.id,
                workspace_id: workspaceId,
                assigned_products: selectedProducts
            };

            // Add onboarding type if selected
            if (onboardingType) {
                insertData.onboarding_type = onboardingType;
            }

            // Add Shopify data if provided
            if (shopifyDomain.trim()) {
                const domain = shopifyDomain.trim().includes('.myshopify.com')
                    ? shopifyDomain.trim()
                    : `${shopifyDomain.trim()}.myshopify.com`;
                insertData.shopify_domain = domain;
                insertData.shopify_status = 'pending';
            }

            const { data: newClient, error } = await (supabase as any)
                .from('agency_clients')
                .insert(insertData)
                .select()
                .single();

            if (error) throw error;

            console.log("Cliente criado:", newClient);

            // Auto-create onboarding if type selected
            if (onboardingType && newClient) {
                try {
                    const template = getTemplateForType(onboardingType);
                    if (template) {
                        const startedAt = new Date().toISOString();
                        const { data: onbRow, error: onbErr } = await (supabase as any)
                            .from('onboarding')
                            .insert({
                                client_id: newClient.id,
                                type: onboardingType,
                                status: 'pendente',
                                current_phase: template.phases[0]?.phase_key || null,
                                started_at: startedAt,
                            })
                            .select()
                            .single();

                        if (!onbErr && onbRow) {
                            const phasesToInsert = template.phases.map((ph) => ({
                                onboarding_id: onbRow.id,
                                phase_key: ph.phase_key,
                                phase_name: ph.phase_name,
                                phase_order: ph.phase_order,
                                parallel_group: ph.parallel_group || null,
                                status: 'pendente',
                                due_date: ph.due_days_offset > 0
                                    ? new Date(Date.now() + ph.due_days_offset * 86400000).toISOString()
                                    : null,
                            }));

                            const { data: insertedPhases } = await (supabase as any)
                                .from('onboarding_phases')
                                .insert(phasesToInsert)
                                .select();

                            if (insertedPhases) {
                                const tasksToInsert: any[] = [];
                                for (const phase of template.phases) {
                                    const dbPhase = insertedPhases.find((p: any) => p.phase_key === phase.phase_key);
                                    if (!dbPhase) continue;
                                    for (const task of phase.tasks) {
                                        tasksToInsert.push({
                                            phase_id: dbPhase.id,
                                            task_key: task.task_key,
                                            task_name: task.task_name,
                                            task_description: task.task_description || null,
                                            is_required: task.is_required,
                                            status: 'pendente',
                                            task_order: task.task_order,
                                        });
                                    }
                                }
                                if (tasksToInsert.length > 0) {
                                    await (supabase as any).from('onboarding_tasks').insert(tasksToInsert);
                                }
                            }
                            console.log('[NewClientModal] Onboarding criado automaticamente:', onboardingType);
                        }
                    }
                } catch (onbErr: any) {
                    console.error('[NewClientModal] Erro ao criar onboarding:', onbErr);
                    toast({
                        title: "Aviso",
                        description: "Cliente criado, mas erro ao gerar onboarding: " + (onbErr?.message || ''),
                        variant: "destructive",
                    });
                }
            }

            toast({
                title: "Cliente criado com sucesso!",
                description: `${values.name} foi adicionado com ${selectedProducts.length} produtos sincronizados.`,
            });

            // 3. Create linked user/invitation if email provided
            if (values.responsible_email && newClient) {
                console.log("Creating invitation for:", values.responsible_email);

                const { data: { session } } = await supabase.auth.getSession();

                const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invite-team-member', {
                    body: {
                        email: values.responsible_email.toLowerCase(),
                        workspace_id: workspaceId,
                        role: 'client',
                        linked_client_id: newClient.id,
                        user_type: 'client',
                        site_url: window.location.origin
                    },
                    headers: session?.access_token ? {
                        Authorization: `Bearer ${session.access_token}`
                    } : undefined
                });

                if (inviteError || inviteData?.error) {
                    console.error("Erro ao convidar responsável:", inviteError || inviteData?.error);
                    toast({
                        title: "Aviso",
                        description: `Cliente criado, mas ocorreu um erro no convite: ${inviteData?.error || inviteError?.message || 'Erro desconhecido'}`,
                        variant: "destructive"
                    });
                } else {
                    toast({
                        title: "Convite Enviado!",
                        description: `Um convite foi enviado para ${values.responsible_email}.`,
                    });
                }
            }

            // Invalidate queries to refresh lists
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            queryClient.invalidateQueries({ queryKey: ['agency_clients'] });

            // Ensure the context refreshes before we navigate
            await refreshClients();
            if (loadClientTasks) {
                await loadClientTasks();
            }

            // Wait a little bit for queries to invalidate or refresh
            setOpen(false);
            form.reset();
            setSelectedProducts([]);
            setShopifyDomain("");
            setShopifyCollaboratorCode("");
            setOnboardingType("");

            // Navigate to the new client's page
            navigate(`/clients/${newClient.id}`);

        } catch (error: any) {
            console.error("Erro ao criar cliente:", error);
            toast({
                title: "Erro",
                description: error.message || "Não foi possível criar o cliente.",
                variant: "destructive"
            });
        }
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
        const value = e.target.value.replace(/\D/g, "");
        const result = (Number(value) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        onChange(result);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="w-full h-full" variant="ghost">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Novo Cliente</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">

                        {/* Dados Básicos */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <span className="bg-primary/10 p-1 rounded">1</span>
                                Dados do Contrato
                            </h3>

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome da Loja / Empresa</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: Minha Loja Shopify" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="responsible_email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-mail do Responsável (Portal do Cliente)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="cliente@email.com" type="email" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            O cliente receberá um convite para acessar o próprio portal.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="client_type"
                                render={({ field }) => (
                                    <FormItem className="space-y-3 pt-2 border-t border-border mt-4">
                                        <FormLabel>Tipo de Cliente</FormLabel>
                                        <FormControl>
                                            <div className="flex bg-muted p-1 rounded-xl w-fit">
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange('avulso')}
                                                    className={cn(
                                                        "px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                                                        field.value === 'avulso'
                                                            ? "bg-red-600 text-white shadow-md scale-105"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                                                    )}
                                                >
                                                    Avulso
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange('fixo')}
                                                    className={cn(
                                                        "px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                                                        field.value === 'fixo'
                                                            ? "bg-red-600 text-white shadow-md scale-105"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                                                    )}
                                                >
                                                    Fixo (MRR)
                                                </button>
                                            </div>
                                        </FormControl>
                                        <FormDescription>
                                            {field.value === 'avulso'
                                                ? "Projetos pontuais. Sem valor fixo mensal atrelado."
                                                : "Contrato recorrente. Permite configurar MRR e comissionamento."}
                                        </FormDescription>
                                    </FormItem>
                                )}
                            />

                            {/* Subtipo de Onboarding */}
                            <div className="space-y-2 pt-3">
                                <label className="text-sm font-medium">Tipo de Onboarding</label>
                                <Select
                                    value={onboardingType}
                                    onValueChange={(v) => setOnboardingType(v as OnboardingType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o fluxo de onboarding..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {form.watch('client_type') === 'fixo' ? (
                                            <>
                                                <SelectItem value="mrr_start">MRR Start</SelectItem>
                                                <SelectItem value="mrr_growth">MRR Growth</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="avulso_tema">Tema Beacon (Licença)</SelectItem>
                                                <SelectItem value="avulso_reformulacao">Reformulação de Site</SelectItem>
                                                <SelectItem value="avulso_arte">Arte / Design</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">
                                    Define o checklist de fases e tarefas gerado automaticamente.
                                </p>
                            </div>

                            {form.watch('client_type') === 'fixo' && (
                                <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-4 duration-300">
                                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        Regras Financeiras
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="fixed_value"
                                            render={({ field: { onChange, ...field } }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-2">
                                                        <DollarSign className="w-4 h-4 text-emerald-500" />
                                                        Valor Fixo Mensal
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                                                            <Input
                                                                className="pl-9 text-left font-semibold"
                                                                {...field}
                                                                onChange={(e) => handleCurrencyChange(e, onChange)}
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="commission_rate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-2">
                                                        <Percent className="w-4 h-4 text-primary" />
                                                        Comissão Variável
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                step="0.1"
                                                                className="pr-8 font-semibold"
                                                                {...field}
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="commission_base"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel>Base de Cálculo</FormLabel>
                                                <FormControl>
                                                    <RadioGroup
                                                        onValueChange={field.onChange}
                                                        defaultValue={field.value}
                                                        className="grid grid-cols-2 gap-4"
                                                    >
                                                        <FormItem>
                                                            <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                                                                <FormControl>
                                                                    <RadioGroupItem value="revenue" className="sr-only" />
                                                                </FormControl>
                                                                <div className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-muted transition-all hover:border-primary/50 text-center">
                                                                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                                                                    <span className="font-semibold text-sm">Faturamento</span>
                                                                </div>
                                                            </FormLabel>
                                                        </FormItem>
                                                        <FormItem>
                                                            <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                                                                <FormControl>
                                                                    <RadioGroupItem value="spend" className="sr-only" />
                                                                </FormControl>
                                                                <div className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-muted transition-all hover:border-primary/50 text-center">
                                                                    <DollarSign className="w-6 h-6 text-emerald-500" />
                                                                    <span className="font-semibold text-sm">Investimento</span>
                                                                </div>
                                                            </FormLabel>
                                                        </FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                    </form>
                </Form>

                {/* Produtos - FORA do form para evitar conflito de submit */}
                <div className="space-y-4 pt-4 border-t border-border">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <span className="bg-primary/10 p-1 rounded">2</span>
                        Atribuir Produtos Iniciais
                    </h3>

                    <ScrollArea className="h-[200px] pr-4 border rounded-md p-2 bg-muted/10">
                        {isLoadingProducts ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : (() => {
                            const clientType = form.watch('client_type');
                            const filteredProducts = dynamicProducts.filter((p: AgencyProduct) =>
                                clientType === 'avulso' ? p.category === 'avulso' : (p.category === 'fixed' || p.category === 'flagship')
                            );

                            if (filteredProducts.length === 0) {
                                return (
                                    <div className="text-center py-8 text-muted-foreground text-xs">
                                        Nenhum produto cadastrado para este tipo.
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-2">
                                    {filteredProducts.map((product: AgencyProduct) => {
                                        const isSelected = selectedProducts.includes(product.id);
                                        const Icon = ICON_MAP[product.icon_name] || Package;

                                        return (
                                            <div
                                                key={product.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => toggleProduct(product.id)}
                                                onKeyDown={(e) => e.key === 'Enter' && toggleProduct(product.id)}
                                                className={cn(
                                                    "relative p-3 rounded-lg border-2 transition-all cursor-pointer select-none",
                                                    isSelected
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50 bg-card"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border-2 flex items-center justify-center",
                                                        isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                                    )}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>

                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                        style={{ backgroundColor: `${product.color}20` }}
                                                    >
                                                        <div style={{ color: product.color }}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-sm">{product.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground text-center">
                        {selectedProducts.length} produtos selecionados
                    </p>
                </div>

                {/* Dados Shopify */}
                <div className="space-y-4 pt-4 border-t border-border">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <span className="bg-primary/10 p-1 rounded">3</span>
                        Dados da Loja Shopify
                        <Badge variant="outline" className="text-[10px] ml-1">Opcional</Badge>
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Domínio Shopify</label>
                            <Input
                                placeholder="minha-loja.myshopify.com"
                                value={shopifyDomain}
                                onChange={(e) => setShopifyDomain(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                O domínio .myshopify.com do cliente
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Código de Colaborador</label>
                            <Input
                                placeholder="Código do Shopify Partners"
                                value={shopifyCollaboratorCode}
                                onChange={(e) => setShopifyCollaboratorCode(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Para solicitar acesso via Shopify Partners
                            </p>
                        </div>
                    </div>
                </div>

                {/* Botões no final */}
                <DialogFooter className="pt-4 border-t border-border">
                    <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button
                        type="button"
                        disabled={form.formState.isSubmitting}
                        onClick={form.handleSubmit(onSubmit)}
                    >
                        {form.formState.isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            <>
                                Criar Cliente
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
