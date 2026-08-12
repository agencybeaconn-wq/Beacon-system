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
});

export function NewClientModal({ trigger }: { trigger?: React.ReactNode }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { workspaceId, refreshClients } = useDashboard();
    const { loadClientTasks } = useTasks();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
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

            // Onboarding e dados Shopify sairam do fluxo de criacao (2026-08):
            // a conexao Shopify agora vive na pagina do cliente.
            const { data: newClient, error } = await (supabase as any)
                .from('agency_clients')
                .insert(insertData)
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Cliente criado com sucesso!",
                description: `${values.name} foi adicionado com ${selectedProducts.length} produtos sincronizados.`,
            });

            // Convite do responsável saiu do fluxo de criação — o acesso ao
            // portal é dado depois, na página do cliente (Acesso ao Portal).

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
                                                            ? "bg-primary text-primary-foreground shadow-md scale-105"
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
                                                            ? "bg-primary text-primary-foreground shadow-md scale-105"
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

                {/* Dados Shopify removidos: a conexão vive na página do cliente */}

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
