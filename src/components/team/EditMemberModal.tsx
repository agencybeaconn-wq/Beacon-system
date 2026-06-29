import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Shield, Users } from "lucide-react";
import { useAgencyRoles } from "@/hooks/useAgencyRoles";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessLevels } from "@/hooks/useAccessLevels";

interface EditMemberModalProps {
    member: any;
    open: boolean;
    onClose: () => void;
}

const SECTORS = ['Gestão', 'Tráfego', 'Design', 'Operacional', 'Comercial', 'Dev'];

export function EditMemberModal({ member, open, onClose }: EditMemberModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { roles, createRole } = useAgencyRoles(); // Added createRole

    const [name, setName] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [role, setRole] = useState<'admin' | 'operator' | 'restricted'>('operator');
    const [sector, setSector] = useState<string>(''); // Sector State
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (member && open) {
            setName(member.name || '');
            setPhone(member.phone || '');
            setRole(member.role);
            fetchData();
        }
    }, [member, open, roles]); // Add roles dependency

    const fetchData = async () => {
        if (!member) return;

        // Fetch Job Functions (member_roles) to detect current Sector
        const { data: jobData } = await (supabase as any).from('member_roles')
            .select('role_id')
            .eq('member_id', member.id);

        if (jobData && roles.length > 0) {
            // Find if any existing role matches a SECTOR name
            const memberRoleIds = jobData.map((r: any) => r.role_id);
            const foundSectorRole = roles.find(r => memberRoleIds.includes(r.id) && SECTORS.includes(r.name));

            if (foundSectorRole) {
                setSector(foundSectorRole.name);
            } else {
                setSector('');
            }
        }
    };

    const handleSave = async () => {
        if (!member) return;
        setIsLoading(true);

        try {
            // 1. Update main role (Admin/Operator), name, and phone
            const table: any = (supabase as any).from('team_members');
            const { error: roleError } = await table
                .update({ role, name: name.trim() || null, phone: phone.trim() || null })
                .eq('id', member.id);

            if (roleError) throw roleError;

            // 2. Update Job Functions (Sector)
            // First, delete ALL existing roles to ensure clean state
            await (supabase as any).from('member_roles').delete().eq('member_id', member.id);

            // If Operator and Sector selected, assign the sector role
            if (role === 'operator' && sector) {
                let sectorRoleId = roles.find(r => r.name === sector)?.id;

                if (!sectorRoleId) {
                    console.log(`[EditMember] Creating new sector role: ${sector}`);
                    try {
                        const newRole = await createRole.mutateAsync({
                            name: sector,
                            permissions: []
                        });
                        if (newRole) sectorRoleId = (newRole as any).id;
                    } catch (e) {
                        console.error("Failed to create sector role:", e);
                    }
                }

                if (sectorRoleId) {
                    const { error: insertError } = await (supabase as any).from('member_roles').insert(
                        [{ member_id: member.id, role_id: sectorRoleId }]
                    );
                    if (insertError) throw insertError;
                }
            }

            // 3. Clear Access Levels (Enforce Standard Profile)
            await (supabase as any).from('member_access_levels').delete().eq('member_id', member.id);

            toast({ title: "Membro atualizado com sucesso!" });
            queryClient.invalidateQueries({ queryKey: ['team_members'] });
            onClose();

        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Membro</DialogTitle>
                    <DialogDescription>
                        Gerencie as permissões e funções de {member?.email}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Nome Completo</Label>
                        <Input
                            id="edit-name"
                            type="text"
                            placeholder="Ex: João Silva"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-phone">Telefone / WhatsApp</Label>
                        <Input
                            id="edit-phone"
                            type="text"
                            placeholder="(11) 99999-9999"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div className="space-y-4">
                        <Label>Tipo de Acesso</Label>
                        <Select
                            value={role}
                            onValueChange={(val: any) => setRole(val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Administrador (Acesso Total)</SelectItem>
                                <SelectItem value="operator">Funcionário (Acesso Padrão)</SelectItem>
                                <SelectItem value="restricted">Restrito (Acesso Mínimo)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            {role === 'admin'
                                ? "Pode gerenciar tudo no sistema, inclusive configurações e financeiro."
                                : role === 'operator'
                                    ? "Pode gerenciar demandas, clientes e produtos. Sem acesso a financeiro ou configurações."
                                    : "Acesso limitado apenas a visualização básica."}
                        </p>
                    </div>

                    {role === 'operator' && (
                        <div className="space-y-2">
                            <Label>Setor / Departamento</Label>
                            <Select
                                value={sector}
                                onValueChange={setSector}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o setor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {SECTORS.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        <p>Ao salvar, o usuário assumirá o perfil padrão selecionado acima.</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
