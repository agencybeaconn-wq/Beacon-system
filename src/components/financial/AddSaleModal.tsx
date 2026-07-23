import { useState } from "react";
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
import { CalendarIcon, Check, ChevronsUpDown, HandCoins, User, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";
import { SaleRecord } from "@/hooks/useSales";
import { useDashboard } from "@/contexts/DashboardContext";

interface AddSaleModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAddSale: (sale: Omit<SaleRecord, 'id' | 'workspace_id' | 'created_at'>) => Promise<any>;
}

export function AddSaleModal({ isOpen, onOpenChange, onAddSale }: AddSaleModalProps) {
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
    const [soldBy, setSoldBy] = useState<"joao" | "matheus" | "">("")
    const [hasCommission, setHasCommission] = useState(false);
    const [referralName, setReferralName] = useState("");
    const [commissionPct, setCommissionPct] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedClient = clients.find(c => c.id === selectedClientId);

    // Comissionamento (indicação): % sempre sobre o valor total da venda
    const pctParsed = Math.min(100, Math.max(0, parseFloat(commissionPct.replace(",", ".")) || 0));
    const commissionPreview = hasCommission
        ? ((parseFloat(totalAmount.replace(",", ".")) || 0) * pctParsed) / 100
        : 0;
    const commissionInvalid = hasCommission && (!referralName.trim() || pctParsed <= 0);

    const resetForm = () => {
        setSelectedClientId("");
        setService("");
        setSaleDate(new Date());
        setTotalAmount("");
        setPaymentMethod("pix");
        setEntryType("fixed");
        setEntryAmount("");
        setBalanceDueDate(undefined);
        setNotes("");
        setRecurrence("one_off");
        setSoldBy("");
        setHasCommission(false);
        setReferralName("");
        setCommissionPct("");
    };

    const handleSubmit = async () => {
        if (!selectedClientId || !totalAmount || !soldBy) return;

        setIsSubmitting(true);
        try {
            const total = parseFloat(totalAmount.replace(",", ".")) || 0;
            let entry = parseFloat(entryAmount.replace(",", ".")) || 0;

            // If entry type is percentage, calculate the actual value
            if (entryType === "percentage") {
                entry = (total * entry) / 100;
            }

            const status = entry >= total ? "pago" : entry > 0 ? "parcial" : "pendente";

            await onAddSale({
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
                recurrence,
                sold_by: soldBy as 'joao' | 'matheus',
                referral_name: hasCommission && referralName.trim() ? referralName.trim() : null,
                commission_pct: hasCommission && pctParsed > 0 ? pctParsed : null
            });

            resetForm();
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Adicionar Nova Venda</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Vendedor Selector */}
                    <div className="grid gap-2">
                        <Label>Vendedor *</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={soldBy === 'joao' ? 'default' : 'outline'}
                                className={cn(
                                    "flex-1 gap-2 transition-all",
                                    soldBy === 'joao'
                                        ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                        : "hover:border-blue-500/50 hover:text-blue-500"
                                )}
                                onClick={() => setSoldBy('joao')}
                            >
                                <Users className="h-4 w-4" />
                                João
                            </Button>
                            <Button
                                type="button"
                                variant={soldBy === 'matheus' ? 'default' : 'outline'}
                                className={cn(
                                    "flex-1 gap-2 transition-all",
                                    soldBy === 'matheus'
                                        ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                                        : "hover:border-purple-500/50 hover:text-purple-500"
                                )}
                                onClick={() => setSoldBy('matheus')}
                            >
                                <Users className="h-4 w-4" />
                                Matheus
                            </Button>
                        </div>
                    </div>
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
                        <Label htmlFor="service">Serviço</Label>
                        <Input
                            id="service"
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
                        <Label htmlFor="totalAmount">Valor da Venda (R$) *</Label>
                        <Input
                            id="totalAmount"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>

                    {/* Comissionamento (indicação) */}
                    <div className="grid gap-2">
                        <Label>Comissionamento?</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={!hasCommission ? 'default' : 'outline'}
                                className="flex-1 gap-2 transition-all"
                                onClick={() => setHasCommission(false)}
                            >
                                Não
                            </Button>
                            <Button
                                type="button"
                                variant={hasCommission ? 'default' : 'outline'}
                                className={cn(
                                    "flex-1 gap-2 transition-all",
                                    hasCommission
                                        ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                                        : "hover:border-orange-500/50 hover:text-orange-500"
                                )}
                                onClick={() => setHasCommission(true)}
                            >
                                <HandCoins className="h-4 w-4" />
                                Sim
                            </Button>
                        </div>
                        {hasCommission && (
                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="grid gap-2">
                                    <Label htmlFor="referralName">Quem indicou</Label>
                                    <Input
                                        id="referralName"
                                        value={referralName}
                                        onChange={(e) => setReferralName(e.target.value)}
                                        placeholder="Ex: Lucas"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="commissionPct">% de comissão</Label>
                                    <Input
                                        id="commissionPct"
                                        value={commissionPct}
                                        inputMode="decimal"
                                        onChange={(e) => setCommissionPct(e.target.value)}
                                        placeholder="10"
                                    />
                                </div>
                                <p className="col-span-2 text-[10px] text-muted-foreground">
                                    Comissão: <span className="font-semibold text-orange-500">{formatCurrency(commissionPreview)}</span> (descontada do lucro; a venda conta o valor cheio na meta)
                                </p>
                            </div>
                        )}
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
                            <Label htmlFor="entryAmount">
                                {entryType === "percentage" ? "% de Entrada" : "Valor de Entrada"}
                            </Label>
                            <Input
                                id="entryAmount"
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
                        <Label htmlFor="notes">Observações</Label>
                        <Input
                            id="notes"
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
                        disabled={isSubmitting || !selectedClientId || !totalAmount || !soldBy || commissionInvalid}
                        className="bg-primary"
                    >
                        {isSubmitting ? "Salvando..." : "Registrar Venda"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

