import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Pencil, Loader2, DollarSign, Percent, Palette, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/contexts/DashboardContext";

const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    fixed_value: z.string().refine((val) => !isNaN(parseFloat(val.replace(/\./g, '').replace(',', '.'))), "Valor inválido"),
    commission_rate: z.string().refine((val) => !isNaN(parseFloat(val)), "Porcentagem inválida"),
    avatar_color: z.string().optional(),
});

// Cores disponíveis para seleção
const AVAILABLE_COLORS = [
    '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
    '#EC4899', '#8B5CF6', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FFEAA7', '#DDA0DD', '#20B2AA'
];

interface EditClientModalProps {
    client: {
        id: string;
        name: string;
        fee_fixed?: number | null;
        commission_rate?: number | null;
        primaryColor?: string;
    };
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function EditClientModal({ client, trigger, onSuccess }: EditClientModalProps) {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedColor, setSelectedColor] = useState(client.primaryColor || '#7C3AED');
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { refreshClients } = useDashboard();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: client.name || "",
            fixed_value: client.fee_fixed ? client.fee_fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00",
            commission_rate: client.commission_rate?.toString() || "10",
            avatar_color: client.primaryColor || '#7C3AED',
        },
    });

    // Update form when client data changes
    useEffect(() => {
        form.reset({
            name: client.name || "",
            fixed_value: client.fee_fixed ? client.fee_fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00",
            commission_rate: client.commission_rate?.toString() || "10",
            avatar_color: client.primaryColor || '#7C3AED',
        });
        setSelectedColor(client.primaryColor || '#7C3AED');
    }, [client, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const fixedValueFloat = parseFloat(values.fixed_value.replace(/\./g, '').replace(',', '.'));
            const commissionRateFloat = parseFloat(values.commission_rate);


            // Atualizar cliente na tabela agency_clients
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({
                    name: values.name,
                    fee_fixed: fixedValueFloat,
                    commission_rate: commissionRateFloat,
                })
                .eq('id', client.id);

            if (error) throw error;

            toast({
                title: "Cliente atualizado!",
                description: `As alterações em ${values.name} foram salvas.`,
            });

            // Sync with global context
            await refreshClients();

            setOpen(false);
            onSuccess?.();
        } catch (error: any) {
            console.error("Erro ao atualizar cliente:", error);
            toast({
                variant: "destructive",
                title: "Erro ao atualizar",
                description: error.message || "Ocorreu um erro inesperado.",
            });
        }
    }

    async function handleDelete() {
        try {
            setIsDeleting(true);

            // Remover cliente da tabela agency_clients
            const { error } = await (supabase as any)
                .from('agency_clients')
                .delete()
                .eq('id', client.id);

            if (error) throw error;

            toast({
                title: "Cliente excluído",
                description: `${client.name} foi removido com sucesso.`,
            });

            // Sync with global context
            await refreshClients();

            setOpen(false);

            // Navega de volta para a lista de clientes
            window.location.href = '/clients';
        } catch (error: any) {
            console.error("Erro ao excluir cliente:", error);
            toast({
                variant: "destructive",
                title: "Erro ao excluir",
                description: error.message || "Ocorreu um erro inesperado.",
            });
        } finally {
            setIsDeleting(false);
        }
    }

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
        let value = e.target.value.replace(/\D/g, "");
        const result = (Number(value) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        onChange(result);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="w-4 h-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: selectedColor }}
                        >
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        Editar Cliente
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Cliente</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Minha Empresa Ltda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Seletor de Cor */}
                        <div className="space-y-2">
                            <FormLabel className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-violet-500" />
                                Cor do Avatar
                            </FormLabel>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setSelectedColor(color)}
                                        className={`w-8 h-8 rounded-full transition-all ${selectedColor === color
                                            ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                            : 'hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="fixed_value"
                                render={({ field: { onChange, ...field } }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-emerald-500" />
                                            Fee Fixo Mensal
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                                                <Input
                                                    className="pl-10 font-semibold"
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
                                            Comissão
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

                        <DialogFooter className="flex justify-between sm:justify-between">
                            {/* Botão de Excluir */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Excluir
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. O cliente <strong>{client.name}</strong> será
                                            permanentemente removido do sistema.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            disabled={isDeleting}
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Excluindo...
                                                </>
                                            ) : (
                                                "Sim, excluir"
                                            )}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Botões de Ação */}
                            <div className="flex gap-2">
                                <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Salvando
                                        </>
                                    ) : (
                                        "Salvar Alterações"
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>

                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
