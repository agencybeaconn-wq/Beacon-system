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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AcademyRevenue } from "@/hooks/useAcademyFinancials";

interface AddAcademyRevenueModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (revenue: Omit<AcademyRevenue, 'id' | 'workspace_id' | 'created_at'>) => Promise<any>;
    monthReference: string;
}

export function AddAcademyRevenueModal({ isOpen, onOpenChange, onAdd, monthReference }: AddAcademyRevenueModalProps) {
    const [description, setDescription] = useState("");
    const [clientName, setClientName] = useState("");
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<string>("pix");
    const [dueDate, setDueDate] = useState<Date>(new Date());
    const [category, setCategory] = useState<string>("curso");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);

    const resetForm = () => {
        setDescription("");
        setClientName("");
        setAmount("");
        setPaymentMethod("pix");
        setDueDate(new Date());
        setCategory("curso");
        setNotes("");
    };

    const handleSubmit = async () => {
        if (!description || !amount) return;

        setIsSubmitting(true);
        try {
            await onAdd({
                description,
                client_name: clientName || null,
                amount: parseFloat(amount),
                payment_method: paymentMethod as any,
                due_date: format(dueDate, 'yyyy-MM-dd'),
                payment_date: null,
                status: 'pendente',
                category: category as any,
                month_reference: monthReference,
                notes: notes || null,
            });
            resetForm();
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">Nova Receita Academy</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Descrição *</Label>
                        <Input
                            placeholder="Ex: Curso Marketing Digital - Turma 3"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Cliente / Aluno</Label>
                        <Input
                            placeholder="Nome do cliente ou aluno"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Valor (R$) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Método de Pagamento</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Vencimento *</Label>
                            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dueDate}
                                        onSelect={(d) => { if (d) { setDueDate(d); setCalendarOpen(false); } }}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label>Categoria</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="curso">Curso</SelectItem>
                                    <SelectItem value="mentoria">Mentoria</SelectItem>
                                    <SelectItem value="material">Material</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Observações</Label>
                        <Input
                            placeholder="Notas opcionais..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!description || !amount || isSubmitting}
                    >
                        {isSubmitting ? "Salvando..." : "Registrar Receita"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
