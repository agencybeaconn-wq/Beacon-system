import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, CheckCircle2, Clock, Plus, Filter, Wallet, Receipt, CreditCard, UserCircle, Save, X, Percent, Mail, Briefcase, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinancialExpense, MemberFinancial, PartnerProlabore } from "@/hooks/useFinancials";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface ExpensesListProps {
    expenses: FinancialExpense[];
    staff: MemberFinancial[];
    partners: PartnerProlabore[];
    onUpdateStatus: (id: string, status: 'paid' | 'pending') => void;
    onDeleteExpense: (id: string) => void;
    onAddExpense: () => void;
    onUpdateStaffFinancials: (memberId: string, financials: { base_salary: number, commission_rate: number, pix_key?: string | null }) => Promise<void>;
    onAddStaffMember: (staff: { email: string, role: string, base_salary: number, commission_rate: number }) => Promise<any>;
    onDeleteStaffMember: (id: string) => Promise<void>;
    onAddPartner: (partner: Omit<PartnerProlabore, 'id' | 'workspace_id'>) => Promise<any>;
    onUpdatePartner: (id: string, updates: Partial<PartnerProlabore>) => Promise<any>;
    onDeletePartner: (id: string) => Promise<void>;
}

export function ExpensesList({
    expenses,
    staff,
    partners,
    onUpdateStatus,
    onDeleteExpense,
    onAddExpense,
    onUpdateStaffFinancials,
    onAddStaffMember,
    onDeleteStaffMember,
    onAddPartner,
    onUpdatePartner,
    onDeletePartner
}: ExpensesListProps) {
    const [filter, setFilter] = useState<"all" | "fixed" | "variable">("all");
    const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [editStaffValues, setEditStaffValues] = useState({ base_salary: 0, commission_rate: 0, pix_key: '' });
    const [newStaff, setNewStaff] = useState({ email: '', role: '', base_salary: 0, commission_rate: 0 });
    const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
    const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
    const [editPartnerValues, setEditPartnerValues] = useState({ name: '', amount: 0, payment_day: 5, commission_percent: 0, pix_key: '' });
    const [newPartner, setNewPartner] = useState({ name: '', amount: 0, payment_day: 5, commission_percent: 0, pix_key: '' });
    const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'expense' | 'staff' | 'partner' } | null>(null);

    const filteredExpenses = useMemo(() => {
        const safeExpenses = expenses || [];
        if (filter === "all") return safeExpenses;
        return safeExpenses.filter(e => e.recurrence_type === filter);
    }, [expenses, filter]);

    const stats = useMemo(() => {
        const safeExpenses = expenses || [];
        const safeStaff = staff || [];
        const safePartners = partners || [];

        const expensesTotal = safeExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
        const staffTotal = safeStaff.reduce((acc, s) => acc + (s.base_salary || 0), 0);
        const partnersTotal = safePartners.reduce((acc, p) => acc + (p.amount || 0), 0);

        const total = expensesTotal + staffTotal + partnersTotal;
        const fixed = safeExpenses.filter(e => e.recurrence_type === 'fixed').reduce((acc, e) => acc + (e.amount || 0), 0) + staffTotal + partnersTotal;
        const variable = safeExpenses.filter(e => e.recurrence_type === 'variable').reduce((acc, e) => acc + (e.amount || 0), 0);
        const paid = safeExpenses.filter(e => e.status === 'paid').reduce((acc, e) => acc + (e.amount || 0), 0);

        return { total, fixed, variable, paid };
    }, [expenses, staff, partners]);

    const categories: Record<string, string> = {
        'staff': 'Equipe',
        'tool': 'Ferramenta/SaaS',
        'other': 'Outros'
    };

    const handleAddStaff = async () => {
        await onAddStaffMember(newStaff);
        setIsAddStaffModalOpen(false);
        setNewStaff({ email: '', role: '', base_salary: 0, commission_rate: 0 });
    };

    const handleSaveStaffEdit = async (id: string) => {
        await onUpdateStaffFinancials(id, editStaffValues);
        setEditingStaffId(null);
    };

    const handleAddPartner = async () => {
        await onAddPartner({ ...newPartner, pix_key: newPartner.pix_key || null, status: 'active' });
        setIsAddPartnerModalOpen(false);
        setNewPartner({ name: '', amount: 0, payment_day: 5, commission_percent: 0, pix_key: '' });
    };

    const handleSavePartnerEdit = async (id: string) => {
        await onUpdatePartner(id, editPartnerValues);
        setEditingPartnerId(null);
    };

    return (
        <div className="space-y-6">
            {/* Stats Summary Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-3 bg-background border border-border/50 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Investimento Total</span>
                        <Wallet className="h-3 w-3 text-primary" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold">{formatCurrency(stats.total)}</span>
                    </div>
                </Card>
                <Card className="p-3 bg-background border border-border/50 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Custos Fixos</span>
                        <Receipt className="h-3 w-3 text-blue-500" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold">{formatCurrency(stats.fixed)}</span>
                    </div>
                </Card>
                <Card className="p-3 bg-background border border-border/50 hover:border-purple-500/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Variáveis / Avulsos</span>
                        <Filter className="h-3 w-3 text-purple-500" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold">{formatCurrency(stats.variable)}</span>
                    </div>
                </Card>
                <Card className="p-3 bg-background border border-border/50 hover:border-emerald-500/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Total Pago</span>
                        <CreditCard className="h-3 w-3 text-emerald-500" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold">{formatCurrency(stats.paid)}</span>
                    </div>
                </Card>
            </div>

            <Card className="bg-background/50 overflow-hidden border-none shadow-none">
                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">Listagem de Despesas</h3>
                            <p className="text-xs text-muted-foreground">Gerencie as saídas fixas e variáveis da agência.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-auto">
                                <TabsList className="h-10 inline-flex">
                                    <TabsTrigger value="all" className="font-semibold">Tudo</TabsTrigger>
                                    <TabsTrigger value="fixed" className="font-semibold">Fixas</TabsTrigger>
                                    <TabsTrigger value="variable" className="font-semibold">Variáveis</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <Button
                                size="sm"
                                className="h-9 bg-primary hover:bg-primary/90 font-bold"
                                onClick={onAddExpense}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Lançar Despesa
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-md overflow-hidden border border-border/50">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-bold border-r border-border/50">Descrição</TableHead>
                                    <TableHead className="font-bold border-r border-border/50">Categoria</TableHead>
                                    <TableHead className="font-bold border-r border-border/50">Tipo</TableHead>
                                    <TableHead className="font-bold border-r border-border/50">Vencimento</TableHead>
                                    <TableHead className="font-bold border-r border-border/50 text-left">Valor</TableHead>
                                    <TableHead className="font-bold border-r border-border/50">Status</TableHead>
                                    <TableHead className="font-bold text-left">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center space-y-2 opacity-50">
                                                <Receipt className="h-8 w-8" />
                                                <p>Nenhuma despesa encontrada para esta categoria.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredExpenses.map((expense) => (
                                        <TableRow key={expense.id} className="group hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-bold border-r border-border/50">{expense.description}</TableCell>
                                            <TableCell className="border-r border-border/50">
                                                <Badge variant="secondary" className="font-bold capitalize bg-blue-500/5 text-blue-600 border-none px-2">
                                                    {categories[expense.category] || expense.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="border-r border-border/50">
                                                <Badge variant="outline" className={cn(
                                                    "border-none text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                                                    expense.recurrence_type === 'fixed' ? "bg-purple-500/10 text-purple-600" : "bg-blue-500/10 text-blue-600"
                                                )}>
                                                    {expense.recurrence_type === 'fixed' ? 'FIXO' : 'VARIÁVEL'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm border-r border-border/50">
                                                {new Date(expense.due_date).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="font-bold text-primary border-r border-border/50 text-left">
                                                {formatCurrency(expense.amount)}
                                            </TableCell>
                                            <TableCell className="border-r border-border/50">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "border-none flex w-fit items-center gap-1.5 font-bold",
                                                        expense.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                                    )}
                                                >
                                                    {expense.status === 'paid' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                    {expense.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left">
                                                <div className="flex justify-start gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                                        onClick={() => onUpdateStatus(expense.id, expense.status === 'paid' ? 'pending' : 'paid')}
                                                        title={expense.status === 'paid' ? 'Marcar como pendente' : 'Marcar como pago'}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => setItemToDelete({ id: expense.id, type: 'expense' })}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Fixed Costs Sections (Partners & Staff) */}
                    {filter !== "variable" && (
                        <>
                            {/* Partners Section */}
                            <div className="mt-12 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <Wallet className="h-5 w-5 text-primary" />
                                            Gestão de Sócios / Pro-labore
                                        </h3>
                                        <p className="text-xs text-muted-foreground">Retiradas mensais fixas dos sócios.</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 border-primary/20 hover:bg-primary/5 font-bold"
                                        onClick={() => setIsAddPartnerModalOpen(true)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Adicionar Sócio
                                    </Button>
                                </div>

                                <div className="rounded-md overflow-hidden border border-border/50">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold border-r border-border/50 text-left">Nome do Sócio</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Dia de Pagamento</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Valor Pro-labore</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Comissão (%)</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Chave PIX</TableHead>
                                                <TableHead className="font-bold text-left">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(partners || []).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground opacity-50">
                                                        Nenhum sócio cadastrado.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (partners || []).map((partner) => (
                                                    <TableRow key={partner.id} className="group hover:bg-muted/50 transition-colors">
                                                        <TableCell className="font-bold border-r border-border/50 text-left">{partner.name}</TableCell>
                                                        <TableCell className="border-r border-border/50 text-left">
                                                            {editingPartnerId === partner.id ? (
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 w-16"
                                                                    value={editPartnerValues.payment_day}
                                                                    onChange={e => setEditPartnerValues(prev => ({ ...prev, payment_day: Number(e.target.value) }))}
                                                                />
                                                            ) : (
                                                                `Dia ${partner.payment_day}`
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-bold text-emerald-500 border-r border-border/50 text-left">
                                                            {editingPartnerId === partner.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs">R$</span>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-24"
                                                                        value={editPartnerValues.amount === 0 ? '' : editPartnerValues.amount}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setEditPartnerValues(prev => ({ ...prev, amount: val === '' ? 0 : Number(val) }));
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                formatCurrency(partner.amount || 0)
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="border-r border-border/50 text-left">
                                                            {editingPartnerId === partner.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-16"
                                                                        value={editPartnerValues.commission_percent === 0 ? '' : editPartnerValues.commission_percent}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setEditPartnerValues(prev => ({ ...prev, commission_percent: val === '' ? 0 : Number(val) }));
                                                                        }}
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">%</span>
                                                                </div>
                                                            ) : (
                                                                <span className="font-bold text-cyan-500">{partner.commission_percent || 0}%</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="border-r border-border/50 text-left">
                                                            {editingPartnerId === partner.id ? (
                                                                <Input
                                                                    type="text"
                                                                    className="h-8 w-40"
                                                                    placeholder="CPF, e-mail ou telefone"
                                                                    value={editPartnerValues.pix_key}
                                                                    onChange={e => setEditPartnerValues(prev => ({ ...prev, pix_key: e.target.value }))}
                                                                />
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">{partner.pix_key || '—'}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-left">
                                                            <div className="flex justify-start gap-1">
                                                                {editingPartnerId === partner.id ? (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-emerald-500"
                                                                            onClick={() => handleSavePartnerEdit(partner.id)}
                                                                        >
                                                                            <Save className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-destructive"
                                                                            onClick={() => setEditingPartnerId(null)}
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-muted-foreground hover:bg-muted/50"
                                                                            onClick={() => {
                                                                                setEditingPartnerId(partner.id);
                                                                                setEditPartnerValues({
                                                                                    name: partner.name,
                                                                                    amount: partner.amount || 0,
                                                                                    payment_day: partner.payment_day || 5,
                                                                                    commission_percent: partner.commission_percent || 0,
                                                                                    pix_key: partner.pix_key || ''
                                                                                });
                                                                            }}
                                                                        >
                                                                            <Edit2 className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                            onClick={() => setItemToDelete({ id: partner.id, type: 'partner' })}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Staff Section */}
                            <div className="mt-12 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <UserCircle className="h-5 w-5 text-primary" />
                                            Gestão de Equipe / Colaboradores
                                        </h3>
                                        <p className="text-xs text-muted-foreground">Custos fixos com salários e cargos.</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 border-primary/20 hover:bg-primary/5 font-bold"
                                        onClick={() => setIsAddStaffModalOpen(true)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Adicionar Funcionário
                                    </Button>
                                </div>

                                <div className="rounded-md overflow-hidden border border-border/50">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold border-r border-border/50 text-left">Colaborador</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Cargo / Área</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Salário Base</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Comissão (%)</TableHead>
                                                <TableHead className="font-bold border-r border-border/50 text-left">Chave PIX</TableHead>
                                                <TableHead className="font-bold text-left">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(staff || []).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground opacity-50">
                                                        Nenhum colaborador cadastrado.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (staff || []).map((member) => (
                                                    <TableRow key={member.id} className="group hover:bg-muted/50 transition-colors">
                                                        <TableCell className="font-bold border-r border-border/50 text-left">{member.email}</TableCell>
                                                        <TableCell className="border-r border-border/50 uppercase text-[10px] font-black tracking-wider text-muted-foreground text-left">
                                                            {member.role}
                                                        </TableCell>
                                                        <TableCell className="font-bold text-emerald-500 border-r border-border/50 text-left">
                                                            {editingStaffId === member.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs">R$</span>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-24"
                                                                        value={editStaffValues.base_salary === 0 ? '' : editStaffValues.base_salary}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setEditStaffValues(prev => ({ ...prev, base_salary: val === '' ? 0 : Number(val) }));
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                formatCurrency(member.base_salary || 0)
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="border-r border-border/50 text-left">
                                                            {editingStaffId === member.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-16"
                                                                        value={editStaffValues.commission_rate === 0 ? '' : editStaffValues.commission_rate}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setEditStaffValues(prev => ({ ...prev, commission_rate: val === '' ? 0 : Number(val) }));
                                                                        }}
                                                                    />
                                                                    <Percent className="h-3 w-3" />
                                                                </div>
                                                            ) : (
                                                                <Badge variant="secondary" className="bg-blue-500/5 text-blue-500 border-none font-bold">
                                                                    {member.commission_rate || 0}%
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="border-r border-border/50 text-left">
                                                            {editingStaffId === member.id ? (
                                                                <Input
                                                                    type="text"
                                                                    className="h-8 w-40"
                                                                    placeholder="CPF, e-mail ou telefone"
                                                                    value={editStaffValues.pix_key}
                                                                    onChange={e => setEditStaffValues(prev => ({ ...prev, pix_key: e.target.value }))}
                                                                />
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">{member.pix_key || '—'}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-left">
                                                            <div className="flex justify-start gap-1">
                                                                {editingStaffId === member.id ? (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-emerald-500"
                                                                            onClick={() => handleSaveStaffEdit(member.id)}
                                                                        >
                                                                            <Save className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-destructive"
                                                                            onClick={() => setEditingStaffId(null)}
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-muted-foreground hover:bg-muted/50"
                                                                            onClick={() => {
                                                                                setEditingStaffId(member.id);
                                                                                setEditStaffValues({
                                                                                    base_salary: member.base_salary || 0,
                                                                                    commission_rate: member.commission_rate || 0,
                                                                                    pix_key: member.pix_key || ''
                                                                                });
                                                                            }}
                                                                        >
                                                                            <Edit2 className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                            onClick={() => setItemToDelete({ id: member.id, type: 'staff' })}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            <Dialog open={isAddStaffModalOpen} onOpenChange={setIsAddStaffModalOpen}>
                <DialogContent className="bg-background/95 backdrop-blur-md border border-white/10 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase text-primary">
                            Novo Colaborador
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail / Usuário</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="exemplo@empresa.com"
                                    className="pl-10 h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all font-medium"
                                    value={newStaff.email}
                                    onChange={e => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cargo / Área de Atuação</label>
                            <div className="relative group">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Ex: Gestor de Tráfego"
                                    className="pl-10 h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all font-medium"
                                    value={newStaff.role}
                                    onChange={e => setNewStaff(prev => ({ ...prev, role: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Salário Base</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 group-focus-within:text-emerald-400" />
                                    <Input
                                        type="number"
                                        placeholder="0,00"
                                        className="pl-10 h-12 bg-white/5 border-white/10 focus:border-emerald-500/50 transition-all font-bold text-emerald-500"
                                        value={newStaff.base_salary === 0 ? '' : newStaff.base_salary}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewStaff(prev => ({ ...prev, base_salary: val === '' ? 0 : Number(val) }));
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">% Comissão</label>
                                <div className="relative group">
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 group-focus-within:text-blue-400" />
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="pr-10 h-12 bg-white/5 border-white/10 focus:border-blue-500/50 transition-all font-bold text-blue-500"
                                        value={newStaff.commission_rate === 0 ? '' : newStaff.commission_rate}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewStaff(prev => ({ ...prev, commission_rate: val === '' ? 0 : Number(val) }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all"
                            onClick={handleAddStaff}
                        >
                            Finalizar Cadastro
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddPartnerModalOpen} onOpenChange={setIsAddPartnerModalOpen}>
                <DialogContent className="bg-background/95 backdrop-blur-md border border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase text-primary">
                            Novo Sócio (Pro-labore)
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome do Sócio</label>
                            <div className="relative group">
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Nome completo"
                                    className="pl-10 h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all font-medium"
                                    value={newPartner.name}
                                    onChange={e => setNewPartner(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Valor Pro-labore</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 group-focus-within:text-emerald-400" />
                                    <Input
                                        type="number"
                                        placeholder="0,00"
                                        className="pl-10 h-12 bg-white/5 border-white/10 focus:border-emerald-500/50 transition-all font-bold text-emerald-500"
                                        value={newPartner.amount === 0 ? '' : newPartner.amount}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewPartner(prev => ({ ...prev, amount: val === '' ? 0 : Number(val) }));
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Dia Pagamento</label>
                                <div className="relative group">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 group-focus-within:text-blue-400" />
                                    <Input
                                        type="number"
                                        placeholder="5"
                                        className="pl-10 h-12 bg-white/5 border-white/10 focus:border-blue-500/50 transition-all font-bold text-blue-500"
                                        value={newPartner.payment_day}
                                        onChange={e => setNewPartner(prev => ({ ...prev, payment_day: Number(e.target.value) }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Comissão (%)</label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-cyan-500 group-focus-within:text-cyan-400">%</span>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="pl-10 h-12 bg-white/5 border-white/10 focus:border-cyan-500/50 transition-all font-bold text-cyan-500"
                                        value={newPartner.commission_percent === 0 ? '' : newPartner.commission_percent}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewPartner(prev => ({ ...prev, commission_percent: val === '' ? 0 : Number(val) }));
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Chave PIX</label>
                                <Input
                                    type="text"
                                    placeholder="CPF, e-mail, telefone..."
                                    className="h-12 bg-white/5 border-white/10 focus:border-primary/50 transition-all font-medium"
                                    value={newPartner.pix_key}
                                    onChange={e => setNewPartner(prev => ({ ...prev, pix_key: e.target.value }))}
                                />
                            </div>
                        </div>
                        <Button
                            className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all"
                            onClick={handleAddPartner}
                        >
                            Cadastrar Sócio
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmação de Exclusão */}
            <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent className="bg-background border-border/50">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground pt-2">
                            {itemToDelete?.type === 'expense'
                                ? "Tem certeza que deseja remover esta despesa? Esta ação não pode ser desfeita."
                                : itemToDelete?.type === 'staff'
                                    ? "Deseja remover este colaborador da contabilidade? Ele continuará no sistema, mas não aparecerá mais nesta listagem financeira."
                                    : "Tem certeza que deseja remover este sócio? Todas as informações de pro-labore serão excluídas."
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="font-bold border-border/50">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 font-bold text-white px-6"
                            onClick={() => {
                                if (itemToDelete) {
                                    if (itemToDelete.type === 'expense') {
                                        onDeleteExpense(itemToDelete.id);
                                    } else if (itemToDelete.type === 'staff') {
                                        onDeleteStaffMember(itemToDelete.id);
                                    } else {
                                        onDeletePartner(itemToDelete.id);
                                    }
                                    setItemToDelete(null);
                                }
                            }}
                        >
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
