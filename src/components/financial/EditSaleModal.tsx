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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SaleRecord } from "@/hooks/useSales";
import { useDashboard } from "@/contexts/DashboardContext";

interface EditSaleModalProps {
    sale: SaleRecord | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdateSale: (id: string, updates: Partial<SaleRecord>) => Promise<any>;
}

export function EditSaleModal({ sale, isOpen, onOpenChange, onUpdateSale }: EditSaleModalProps) {
    const { clients } = useDashboard();
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [clientComboOpen, setClientComboOpen] = useState(false);
    const [service, setService] = useState("");
    const [saleDate, setSaleDate] = useState<Date>(new Date());
    const [totalAmount, setTotalAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<string>("pix");
    const [entryType, setEntryType] = useState<string>("fixed");
    const [entryAmount, setEntryAmount] = useState("");
    const [balanceDueDate, setBalanceDueDate] = useState<Date | undefined>(undefined);
    const [notes, setNotes] = useState("");
    const [recurrence, setRecurrence] = useState<"one_off" | "recurring">("one_off");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedClient = clients.find(c => c.id === selectedClientId);

    useEffect(() => {
        if (sale) {
            // Try to match the existing client_name to a client in the system
            const matchedClient = clients.find(
                c => c.name.toLowerCase() === (sale.client_name || "").toLowerCase()
            );
            setSelectedClientId(matchedClient?.id || "");

            setService(sale.service || "");
            setSaleDate(sale.sale_date ? parseISO(sale.sale_date) : new Date());
            setTotalAmount(sale.total_amount?.toString() || "");
            setPaymentMethod(sale.payment_method || "pix");
            setEntryType(sale.entry_type || "fixed");
            setEntryAmount(sale.entry_amount?.toString() || "");
            setEntryType("fixed");
            setBalanceDueDate(sale.balance_due_date ? parseISO(sale.balance_due_date) : undefined);
            setNotes(sale.notes || "");
            setRecurrence(sale.recurrence || "one_off");
        }
    }, [sale, clients]);

    const handleSubmit = async () => {
        if (!sale || !selectedClientId || !totalAmount) return;

        setIsSubmitting(true);
        try {
            const total = parseFloat(totalAmount.toString().replace(",", ".")) || 0;
            let entry = parseFloat(entryAmount.toString().replace(",", ".")) || 0;

            if (entryType === "percentage") {
                entry = (total * entry) / 100;
            }

            const status = entry >= total ? "pago" : entry > 0 ? "parcial" : "pendente";

            await onUpdateSale(sale.id, {
                client_name: selectedClient?.name || "",
                service: service || null,
                sale_date: format(saleDate, "yyyy-MM-dd"),
                total_amount: total,
                payment_method: paymentMethod as any,
                entry_type: entryType as any,
                entry_amount: entry,
                balance_due_date: balanceDueDate ? format(balanceDueDate, "yyyy-MM-dd") : null,
                status: status as any,
                notes: notes || null,
                recurrence
            });

            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Venda</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Client Selector */}
                    <div className="grid gap-2">
                        <Label>Cliente *</Label>
                        <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={clientComboOpen}
                                    className={cn(
                                        "w-full justify-between font-normal",
                                        !selectedClientId && "text-muted-foreground"
                                    )}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        {selectedClient ? (
                                            <>
                                                <User className="h-4 w-4 shrink-0 text-primary" />
                                                {selectedClient.name}
                                            </>
                                        ) : (
                                            "Selecionar cliente..."
                                        )}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar cliente..." />
                                    <CommandList>
                                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {clients.map((client) => (
                                                <CommandItem
                                                    key={client.id}
                                                    value={client.name}
                                                    onSelect={() => {
                                                        setSelectedClientId(client.id);
                                                        setClientComboOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {client.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Service */}
                    <div className="grid gap-2">
                        <Label htmlFor="edit-service">Serviço</Label>
                        <Input
                            id="edit-service"
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                            placeholder="Ex: Tráfego Pago"
                        />
                    </div>

                    {/* Sale Date */}
                    <div className="grid gap-2">
                        <Label>Data da Venda</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !saleDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {saleDate ? format(saleDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={saleDate}
                                    onSelect={(date) => date && setSaleDate(date)}
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Total Amount */}
                    <div className="grid gap-2">
                        <Label htmlFor="edit-totalAmount">Valor da Venda (R$) *</Label>
                        <Input
                            id="edit-totalAmount"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Tipo de Venda</Label>
                        <Select value={recurrence} onValueChange={(v: any) => setRecurrence(v)}>
                            <SelectTrigger className={cn(recurrence === 'recurring' ? "border-purple-500/50 bg-purple-500/10" : "")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="one_off">Venda Avulsa (Pontual)</SelectItem>
                                <SelectItem value="recurring">Recorrente / MRR (Fixo)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                            {recurrence === 'recurring'
                                ? "Conta para a Meta, mas entra no Financeiro como MRR do Cliente."
                                : "Conta para a Meta e soma imediatamente ao Faturado Total."}
                        </p>
                    </div>

                    {/* Payment Method */}
                    <div className="grid gap-2">
                        <Label>Forma de Pagamento</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="cartao">Cartão</SelectItem>
                                <SelectItem value="boleto">Boleto</SelectItem>
                                <SelectItem value="transferencia">Transferência</SelectItem>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Entry Type and Amount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Tipo de Entrada</Label>
                            <Select value={entryType} onValueChange={setEntryType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-entryAmount">
                                {entryType === "percentage" ? "% de Entrada" : "Valor de Entrada"}
                            </Label>
                            <Input
                                id="edit-entryAmount"
                                value={entryAmount}
                                onChange={(e) => setEntryAmount(e.target.value)}
                                placeholder={entryType === "percentage" ? "50" : "0,00"}
                            />
                        </div>
                    </div>

                    {/* Balance Due Date */}
                    <div className="grid gap-2">
                        <Label>Data de Recebimento do Restante</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !balanceDueDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {balanceDueDate ? format(balanceDueDate, "PPP", { locale: ptBR }) : "Selecionar data (opcional)"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={balanceDueDate}
                                    onSelect={setBalanceDueDate}
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Notes */}
                    <div className="grid gap-2">
                        <Label htmlFor="edit-notes">Observações</Label>
                        <Input
                            id="edit-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anotações adicionais..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedClientId || !totalAmount}
                        className="bg-primary"
                    >
                        {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

