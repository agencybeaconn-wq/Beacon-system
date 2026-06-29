import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddTransactionModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    clients: any[];
    onAddExpense: (expense: any) => Promise<void>;
    onCreateInvoice: (clientId: string, amount: number, dueDate: string) => Promise<any>;
}

export function AddTransactionModal({ isOpen, onOpenChange, clients, onAddExpense, onCreateInvoice }: AddTransactionModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [type, setType] = useState<"income" | "expense">("expense");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState<string>("other");
    const [recurrenceType, setRecurrenceType] = useState<"fixed" | "variable">("fixed");
    const [dueDate, setDueDate] = useState<Date>(new Date());
    const [selectedClientId, setSelectedClientId] = useState<string>("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (type === "expense") {
                const sanitizedAmount = typeof amount === 'string' ? amount.replace(',', '.') : amount;
                const numericAmount = Number(sanitizedAmount);

                if (isNaN(numericAmount)) {
                    throw new Error("Valor inválido");
                }

                await onAddExpense({
                    description,
                    amount: numericAmount,
                    category: category as any,
                    recurrence_type: recurrenceType,
                    due_date: format(dueDate, 'yyyy-MM-dd'),
                    status: 'pending'
                });
            } else {
                if (!selectedClientId) {
                    alert("Selecione um cliente para a receita");
                    return;
                }
                const sanitizedAmount = typeof amount === 'string' ? amount.replace(',', '.') : amount;
                const numericAmount = Number(sanitizedAmount);

                if (isNaN(numericAmount)) {
                    throw new Error("Valor inválido");
                }

                await onCreateInvoice(selectedClientId, numericAmount, format(dueDate, 'yyyy-MM-dd'));
            }

            // Success: Reset and close
            setDescription("");
            setAmount("");
            setSelectedClientId("");
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] border-border/40 shadow-2xl bg-background/95 backdrop-blur-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            {type === "expense" ? "Lançar Nova Despesa" : "Lançar Nova Receita"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                        {/* Type Selector */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Lançamento</Label>
                            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-lg border border-border/10">
                                <Button
                                    type="button"
                                    variant={type === "expense" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setType("expense")}
                                    className={cn("h-8 text-xs font-bold transition-all", type === "expense" && "shadow-lg")}
                                >
                                    Despesa
                                </Button>
                                <Button
                                    type="button"
                                    variant={type === "income" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setType("income")}
                                    className={cn("h-8 text-xs font-bold transition-all", type === "income" && "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg")}
                                >
                                    Receita
                                </Button>
                            </div>
                        </div>

                        {type === "income" && (
                            <div className="space-y-2">
                                <Label htmlFor="client" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</Label>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                                    <SelectTrigger className="bg-muted/20 border-border/10">
                                        <SelectValue placeholder="Selecione o Cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map(client => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder={type === "expense" ? "Ex: Assinatura Adobe..." : "Ex: Fee Mensal..."}
                                className="bg-muted/20 border-border/10"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0,00"
                                    className="bg-muted/20 border-border/10 font-mono"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {type === "expense" ? "Categoria" : "Data de Referência"}
                                </Label>
                                {type === "expense" ? (
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="bg-muted/20 border-border/10">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="staff">Equipe / Freelancer</SelectItem>
                                            <SelectItem value="tool">Ferramenta / Software</SelectItem>
                                            <SelectItem value="other">Outros / Geral</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="flex items-center h-10 px-3 rounded-md bg-muted/20 border border-border/10 text-sm font-medium">
                                        {format(dueDate, 'MMMM yyyy', { locale: ptBR })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recorrência</Label>
                                <Select value={recurrenceType} onValueChange={(v: any) => setRecurrenceType(v)}>
                                    <SelectTrigger className="bg-muted/20 border-border/10">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">{type === "expense" ? "Despesa Fixa" : "Receita Recorrente"}</SelectItem>
                                        <SelectItem value="variable">{type === "expense" ? "Despesa Única" : "Parcela Única"}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data de Vencimento</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-muted/20 border-border/10",
                                                !dueDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 border border-border/50">
                                        <Calendar
                                            mode="single"
                                            selected={dueDate}
                                            onSelect={(d) => d && setDueDate(d)}
                                            initialFocus
                                            locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-border/10">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs font-bold">
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !amount || !description || (type === "income" && !selectedClientId)}
                            className={cn(
                                "text-xs font-black uppercase tracking-widest",
                                type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary"
                            )}
                        >
                            {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            {type === "expense" ? "Lançar Despesa" : "Gerar Receita"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
