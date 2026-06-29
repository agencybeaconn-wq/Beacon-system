import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Save, X, Percent, Wallet, UserCircle, Briefcase } from "lucide-react";
import { MemberFinancial } from "@/hooks/useFinancials";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface StaffManagementProps {
    staff: MemberFinancial[];
    clients: any[];
    onUpdateFinancials: (memberId: string, financials: { base_salary: number, commission_rate: number }) => Promise<void>;
    onUpdateCommission: (memberId: string, clientId: string, rate: number) => Promise<void>;
}

export function StaffManagement({ staff, clients, onUpdateFinancials, onUpdateCommission }: StaffManagementProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({ base_salary: 0, commission_rate: 0 });
    const [selectedMemberForCommissions, setSelectedMemberForCommissions] = useState<MemberFinancial | null>(null);

    const startEditing = (member: MemberFinancial) => {
        setEditingId(member.id);
        setEditValues({ base_salary: member.base_salary, commission_rate: member.commission_rate });
    };

    const handleSave = async (id: string) => {
        await onUpdateFinancials(id, editValues);
        setEditingId(null);
    };

    const handleUpdateClientCommission = async (clientId: string, rate: number) => {
        if (!selectedMemberForCommissions) return;
        await onUpdateCommission(selectedMemberForCommissions.id, clientId, rate);
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-6 bg-background border border-border/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Investimento Mensal Base</p>
                            <p className="text-2xl font-bold">{formatCurrency(staff.reduce((acc, curr) => acc + curr.base_salary, 0))}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-background border border-border/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <UserCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Colaboradores</p>
                            <p className="text-2xl font-bold">{staff.length}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="border border-border/50 bg-background/50">
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Configurações Financeiras da Equipe</h3>
                    <div className="rounded-md border border-border/50">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Cargo (Role)</TableHead>
                                    <TableHead>Salário Base (R$)</TableHead>
                                    <TableHead>Comissão Global (%)</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staff.map((member) => (
                                    <TableRow key={member.id} className="group hover:bg-muted/50 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{member.email}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{member.id.split('-')[0]}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">{member.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {editingId === member.id ? (
                                                <div className="relative max-w-[120px]">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                                    <Input
                                                        type="number"
                                                        value={editValues.base_salary}
                                                        onChange={e => setEditValues(prev => ({ ...prev, base_salary: Number(e.target.value) }))}
                                                        className="pl-8 h-8"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-emerald-600">{formatCurrency(member.base_salary)}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === member.id ? (
                                                <div className="relative max-w-[100px]">
                                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3 w-3" />
                                                    <Input
                                                        type="number"
                                                        value={editValues.commission_rate}
                                                        onChange={e => setEditValues(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                                                        className="pr-8 h-8"
                                                    />
                                                </div>
                                            ) : (
                                                <Badge className="bg-blue-500/10 text-blue-600 border-none">
                                                    {member.commission_rate}%
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingId === member.id ? (
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => handleSave(member.id)}>
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => setSelectedMemberForCommissions(member)}
                                                        title="Comissões por Loja"
                                                    >
                                                        <Briefcase className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEditing(member)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </Card>

            <Dialog open={!!selectedMemberForCommissions} onOpenChange={() => setSelectedMemberForCommissions(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Comissões por Loja - {selectedMemberForCommissions?.email}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            Defina comissões específicas para cada loja que este colaborador atende.
                            Se não definido, será usada a taxa global de {selectedMemberForCommissions?.commission_rate}%.
                        </p>
                        <div className="rounded-md border border-border/50 max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Loja/Cliente</TableHead>
                                        <TableHead className="text-right">Taxa Atribuída (%)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clients.map(client => {
                                        const commission = selectedMemberForCommissions?.commissions?.find(c => c.client_id === client.id);
                                        return (
                                            <TableRow key={client.id}>
                                                <TableCell className="font-medium">{client.name}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Input
                                                            type="number"
                                                            className="w-20 h-8"
                                                            defaultValue={commission?.rate || 0}
                                                            onBlur={(e) => handleUpdateClientCommission(client.id, Number(e.target.value))}
                                                        />
                                                        <Percent className="h-3 w-3 text-muted-foreground" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
