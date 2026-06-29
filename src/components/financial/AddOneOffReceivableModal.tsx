import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, User, Briefcase, DollarSign, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { OneOffReceivable } from "@/hooks/useOneOffReceivables";

interface AddOneOffReceivableModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (receivable: Omit<OneOffReceivable, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>) => Promise<any>;
    onUpdate?: (id: string, updates: Partial<OneOffReceivable>) => Promise<any>;
    initialData?: OneOffReceivable | null;
}

export function AddOneOffReceivableModal({ isOpen, onOpenChange, onAdd, onUpdate, initialData }: AddOneOffReceivableModalProps) {
    const [clientName, setClientName] = useState("");
    const [service, setService] = useState("");
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [dueDate, setDueDate] = useState<Date>(new Date());
    const [status, setStatus] = useState<'pending' | 'parcial' | 'pago'>('pending');
    const [entryAmount, setEntryAmount] = useState("");
    const [balanceDueDate, setBalanceDueDate] = useState<Date | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setClientName(initialData.client_name);
            setService(initialData.service);
            setAmount(initialData.amount.toString().replace(".", ","));
            setPaymentMethod(initialData.payment_method || "pix");
            setDueDate(parseISO(initialData.due_date));
            setStatus(initialData.status === 'paid' ? 'pago' : initialData.status);
            setEntryAmount(initialData.entry_amount?.toString().replace(".", ",") || "");
            setBalanceDueDate(initialData.balance_due_date ? parseISO(initialData.balance_due_date) : null);
        } else {
            setClientName("");
            setService("");
            setAmount("");
            setPaymentMethod("pix");
            setDueDate(new Date());
            setStatus("pending");
            setEntryAmount("");
            setBalanceDueDate(null);
        }
    }, [initialData, isOpen]);

    const handleSubmit = async () => {
        if (!clientName || !service || !amount) return;

        setIsSubmitting(true);
        try {
            const data = {
                client_name: clientName,
                service: service,
                amount: parseFloat(amount.replace(",", ".")),
                payment_method: paymentMethod,
                due_date: format(dueDate, "yyyy-MM-dd"),
                status: status === 'pago' ? 'paid' : status,
                entry_amount: status === 'parcial' ? parseFloat(entryAmount.replace(",", ".")) || 0 : 0,
                balance_due_date: (status === 'parcial' && balanceDueDate) ? format(balanceDueDate, "yyyy-MM-dd") : null,
            };

            if (initialData && onUpdate) {
                await onUpdate(initialData.id, data as any);
            } else {
                await onAdd(data as any);
            }
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-primary/20" />

                <DialogHeader className="pt-2">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            {initialData ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                        </div>
                        {initialData ? "Editar Recebível Avulso" : "Novo Recebível Avulso"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-5 py-6">
                    {/* Client Name */}
                    <div className="grid gap-2">
                        <Label htmlFor="oneoff-client" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome do Cliente</Label>
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                id="oneoff-client"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                disabled={(initialData as any)?._is_sale_record}
                                className="pl-10 h-11 bg-secondary/30 border-white/5 focus-visible:ring-primary/30 transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                                placeholder="Nome do cliente ou empresa"
                            />
                        </div>
                    </div>

                    {/* Service */}
                    <div className="grid gap-2">
                        <Label htmlFor="oneoff-service" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serviço Prestado</Label>
                        <div className="relative group">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                id="oneoff-service"
                                value={service}
                                onChange={(e) => setService(e.target.value)}
                                disabled={(initialData as any)?._is_sale_record}
                                className="pl-10 h-11 bg-secondary/30 border-white/5 focus-visible:ring-primary/30 transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                                placeholder="Ex: Criação de Logo, Landing Page..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Amount */}
                        <div className="grid gap-2">
                            <Label htmlFor="oneoff-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                            <div className="relative group">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    id="oneoff-amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    disabled={(initialData as any)?._is_sale_record}
                                    className="pl-10 h-11 bg-secondary/30 border-white/5 focus-visible:ring-emerald-500/30 transition-all font-bold text-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Due Date */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data de Vencimento</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full h-11 justify-start text-left font-medium bg-secondary/30 border-white/5 hover:bg-secondary/40",
                                            !dueDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                        {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecionar"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-white/10" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={dueDate}
                                        onSelect={(date) => date && setDueDate(date)}
                                        locale={ptBR}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Status */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                            <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                                <SelectTrigger className="h-11 bg-secondary/30 border-white/5 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-white/10">
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="parcial">Parcial</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Payment Method */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Método</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="h-11 bg-secondary/30 border-white/5 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-white/10">
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="cartao">Cartão</SelectItem>
                                    <SelectItem value="boleto">Boleto</SelectItem>
                                    <SelectItem value="transferencia">Transferência</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {status === 'parcial' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid gap-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor Entrada (R$)</Label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary transition-colors" />
                                    <Input
                                        value={entryAmount}
                                        onChange={(e) => setEntryAmount(e.target.value)}
                                        className="pl-10 h-11 bg-secondary/30 border-white/5 font-bold"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saldo para</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full h-11 justify-start text-left font-medium bg-secondary/30 border-white/5"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                            {balanceDueDate ? format(balanceDueDate, "dd/MM/yyyy") : "Data saldo"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 border-white/10" align="end">
                                        <Calendar
                                            mode="single"
                                            selected={balanceDueDate as any}
                                            onSelect={(date) => setBalanceDueDate(date || null)}
                                            locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between items-center bg-secondary/10 -mx-6 -mb-6 px-6 py-4 mt-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !clientName || !service || !amount}
                        className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 shadow-lg shadow-primary/20"
                    >
                        {isSubmitting ? "Salvando..." : (initialData ? "Salvar Alterações" : "Registrar Recebível")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
