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
import { AcademyExpense } from "@/hooks/useAcademyFinancials";

interface AddAcademyExpenseModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (expense: Omit<AcademyExpense, 'id' | 'workspace_id' | 'created_at'>) => Promise<any>;
    monthReference: string;
}

export function AddAcademyExpenseModal({ isOpen, onOpenChange, onAdd, monthReference }: AddAcademyExpenseModalProps) {
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState<string>("outro");
    const [recurrenceType, setRecurrenceType] = useState<string>("variable");
    const [dueDate, setDueDate] = useState<Date>(new Date());
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);

    const resetForm = () => {
        setDescription("");
        setAmount("");
        setCategory("outro");
        setRecurrenceType("variable");
        setDueDate(new Date());
        setNotes("");
    };

    const handleSubmit = async () => {
        if (!description || !amount) return;

        setIsSubmitting(true);
        try {
            await onAdd({
                description,
                amount: parseFloat(amount),
                category: category as any,
                recurrence_type: recurrenceType as any,
                due_date: format(dueDate, 'yyyy-MM-dd'),
                payment_date: null,
                status: 'pending',
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
                    <DialogTitle className="text-lg font-bold">Nova Despesa Academy</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Descrição *</Label>
                        <Input
                            placeholder="Ex: Plataforma Hotmart"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
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
                            <Label>Categoria</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="plataforma">Plataforma</SelectItem>
                                    <SelectItem value="marketing">Marketing</SelectItem>
                                    <SelectItem value="professor">Professor</SelectItem>
                                    <SelectItem value="material">Material</SelectItem>
                                    <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Tipo</Label>
                            <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fixo (recorrente)</SelectItem>
                                    <SelectItem value="variable">Variável (avulso)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                        {isSubmitting ? "Salvando..." : "Registrar Despesa"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
