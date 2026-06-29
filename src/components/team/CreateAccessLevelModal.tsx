import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, User, Building2, Check, LayoutGrid } from "lucide-react";
import { useAccessLevels, AccessLevel } from "@/hooks/useAccessLevels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ACCESS_FEATURES = [
    // Navegação Principal
    { id: 'dashboard', label: 'Visão Geral (Dashboard)', group: 'Navegação' },
    { id: 'clients', label: 'Clientes (CRM)', group: 'Navegação' },
    { id: 'demands', label: 'Demandas (Kanban)', group: 'Navegação' },
    { id: 'solicitacoes_forms', label: 'Solicitações (Formulário)', group: 'Navegação' },
    { id: 'solicitacoes_list', label: 'Solicitações (Lista)', group: 'Navegação' },
    { id: 'products', label: 'Produtos', group: 'Navegação' },
    { id: 'financial', label: 'Financeiro', group: 'Navegação' },
    { id: 'tracking', label: 'Rastreamento de Pedidos', group: 'Navegação' },
    { id: 'account_groups', label: 'Ativos (Contas)', group: 'Navegação' },
    { id: 'connections', label: 'Conexões & Integrações', group: 'Navegação' },
    // Relatórios
    { id: 'analytics', label: 'Análises (Analytics)', group: 'Relatórios' },
    { id: 'reports', label: 'Análises (Relatórios)', group: 'Relatórios' },
    // Configurações
    { id: 'settings_general', label: 'Configurações Gerais', group: 'Configurações' },
    { id: 'team', label: 'Gestão de Equipe', group: 'Configurações' },
    { id: 'notifications', label: 'Notificações', group: 'Configurações' },
    { id: 'governance', label: 'Governança & Auditoria', group: 'Configurações' },
];

const DEFAULT_PERMISSIONS: Record<string, 'none' | 'view' | 'edit'> = {
    dashboard: 'view',
    clients: 'view',
    demands: 'view',
    solicitacoes_forms: 'edit',
    solicitacoes_list: 'view',
    products: 'view',
    financial: 'none',
    tracking: 'view',
    account_groups: 'none',
    connections: 'none',
    analytics: 'view',
    reports: 'view',
    settings_general: 'none',
    team: 'none',
    notifications: 'none',
    governance: 'none',
};

// Client specific defaults - stricter
const CLIENT_DEFAULT_PERMISSIONS: Record<string, 'none' | 'view' | 'edit'> = {
    dashboard: 'none',
    clients: 'none',
    demands: 'view', // See their demands
    solicitacoes_forms: 'edit', // Can fill the form
    solicitacoes_list: 'none',
    products: 'none',
    financial: 'none',
    tracking: 'none',
    account_groups: 'none',
    connections: 'none',
    analytics: 'none',
    reports: 'none',
    settings_general: 'none',
    team: 'none',
    notifications: 'none',
    governance: 'none',
};

interface CreateAccessLevelModalProps {
    levelToEdit?: AccessLevel | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateAccessLevelModal({ levelToEdit, open, onOpenChange }: CreateAccessLevelModalProps) {
    const [name, setName] = useState("");
    const [roleType, setRoleType] = useState<'internal' | 'client'>('internal');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [permissionsConfig, setPermissionsConfig] = useState<Record<string, 'none' | 'view' | 'edit'>>(DEFAULT_PERMISSIONS);
    const [clients, setClients] = useState<any[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    const { createLevel, updateLevel } = useAccessLevels();

    // Fetch clients on mount
    useEffect(() => {
        const fetchClients = async () => {
            setIsLoadingClients(true);
            const { data } = await (supabase as any)
                .from('agency_clients')
                .select('id, name')
                .order('name');
            setClients(data || []);
            setIsLoadingClients(false);
        };
        fetchClients();
    }, []);

    useEffect(() => {
        if (open) {
            if (levelToEdit) {
                setName(levelToEdit.name);
                const config = levelToEdit.permissions_config as any;
                setPermissionsConfig({ ...DEFAULT_PERMISSIONS, ...config });

                // Restore role type and client ID if present
                if (config.role_type) setRoleType(config.role_type);
                if (config.linked_client_id) setSelectedClientId(config.linked_client_id);
            } else {
                setName("");
                setRoleType('internal');
                setSelectedClientId(null);
                setPermissionsConfig(DEFAULT_PERMISSIONS);
            }
        }
    }, [open, levelToEdit]);

    // Update permissions when switching types
    useEffect(() => {
        if (!levelToEdit) {
            if (roleType === 'client') {
                setPermissionsConfig(CLIENT_DEFAULT_PERMISSIONS);
            } else {
                setPermissionsConfig(DEFAULT_PERMISSIONS);
            }
        }
    }, [roleType, levelToEdit]);

    const handleSave = async () => {
        if (!name.trim()) return;
        if (roleType === 'client' && !selectedClientId) return; // Validate client selection

        // Inject metadata into config
        const finalConfig = {
            ...permissionsConfig,
            role_type: roleType,
            linked_client_id: roleType === 'client' ? selectedClientId : null
        };

        if (levelToEdit) {
            await updateLevel.mutateAsync({
                id: levelToEdit.id,
                name: name.trim(),
                permissions_config: finalConfig
            });
        } else {
            await createLevel.mutateAsync({
                name: name.trim(),
                permissions_config: finalConfig
            });
        }

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] w-full p-8 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                {levelToEdit ? 'Editar Nível de Acesso' : 'Novo Nível de Acesso'}
                                {roleType === 'client' && (
                                    <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 h-6">
                                        CLIENTE
                                    </Badge>
                                )}
                            </DialogTitle>
                            <DialogDescription className="text-base text-muted-foreground">
                                {levelToEdit
                                    ? 'Ajuste as permissões e o escopo deste nível.'
                                    : 'Crie perfis personalizados para sua equipe ou clientes.'}
                            </DialogDescription>
                        </div>
                        <div className="p-2 bg-muted rounded-full">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-6 space-y-8 pr-2 custom-scrollbar">

                    {/* 1. Basic Info & Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Nome do Nível</Label>
                            <Input
                                placeholder="Ex: Gestor de Tráfego, Cliente Coca-Cola..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 text-lg"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Função</Label>
                            <div className="flex items-center gap-2 p-1 bg-muted rounded-lg h-12">
                                <button
                                    type="button"
                                    onClick={() => setRoleType('internal')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 h-full rounded-md text-sm font-medium transition-all duration-200",
                                        roleType === 'internal'
                                            ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                                            : "text-muted-foreground hover:bg-background/50"
                                    )}
                                >
                                    <Shield className="w-4 h-4" />
                                    Interna (Equipe)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRoleType('client')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 h-full rounded-md text-sm font-medium transition-all duration-200",
                                        roleType === 'client'
                                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                            : "text-muted-foreground hover:bg-background/50"
                                    )}
                                >
                                    <User className="w-4 h-4" />
                                    Cliente (Externo)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Client Selection (Conditional) */}
                    {roleType === 'client' && (
                        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                <Building2 className="w-5 h-5" />
                                <h4 className="font-semibold text-lg">Vincular Empresa</h4>
                            </div>
                            <p className="text-sm text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                                Este nível de acesso será restrito aos dados de uma empresa específica. O usuário verá apenas campanhas, demandas e arquivos relacionados a ela.
                            </p>

                            <div className="pt-2">
                                <Select value={selectedClientId || undefined} onValueChange={setSelectedClientId}>
                                    <SelectTrigger className="h-12 bg-background border-blue-200 dark:border-blue-800 text-base">
                                        <SelectValue placeholder="Selecione a empresa do cliente..." />
                                    </SelectTrigger>
                                    <SelectContent className="z-[9999]">
                                        {clients.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">Nenhum cliente ativo encontrado</div>
                                        ) : (
                                            clients.map(client => (
                                                <SelectItem key={client.id} value={client.id} className="text-base py-3">
                                                    {client.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* 3. Permissions Matrix */}
                    <div className="space-y-6 pt-2">
                        <Label className="text-base flex items-center gap-2 font-bold mb-4">
                            <LayoutGrid className="w-5 h-5 text-primary" />
                            Matriz de Permissões
                        </Label>

                        <div className="grid grid-cols-1 gap-8">
                            {['Navegação', 'Relatórios', 'Configurações'].map(group => (
                                <div key={group} className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <h5 className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-32 shrink-0">{group}</h5>
                                        <div className="h-px bg-border flex-1" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {ACCESS_FEATURES.filter(f => f.group === group).map(feature => (
                                            <div
                                                key={feature.id}
                                                className={cn(
                                                    "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                                                    permissionsConfig[feature.id] !== 'none'
                                                        ? "bg-muted/40 border-border"
                                                        : "bg-muted/10 border-border/40 opacity-70 hover:opacity-100"
                                                )}
                                            >
                                                <div>
                                                    <p className="text-base font-medium">{feature.label}</p>
                                                    {roleType === 'client' && feature.id === 'clients' && permissionsConfig[feature.id] !== 'none' && (
                                                        <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                                                            <Shield className="w-3 h-3" />
                                                            Restrito à empresa vinculada
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex bg-background border rounded-lg p-1 gap-1 shadow-sm">
                                                    {(['none', 'view', 'edit'] as const).map((level) => {
                                                        const isActive = permissionsConfig[feature.id] === level;
                                                        const isAllowed = roleType !== 'client' || (roleType === 'client' && level !== 'edit' || (feature.id === 'demands' && level === 'edit')); // Clients restrictions logic hint

                                                        return (
                                                            <button
                                                                key={level}
                                                                type="button"
                                                                onClick={() => setPermissionsConfig(prev => ({ ...prev, [feature.id]: level }))}
                                                                className={cn(
                                                                    "px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 min-w-[80px]",
                                                                    isActive
                                                                        ? (level === 'none' ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" :
                                                                            level === 'view' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                                                                "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400")
                                                                        : "text-muted-foreground hover:bg-muted"
                                                                )}
                                                            >
                                                                {level === 'none' ? 'Bloqueado' : level === 'view' ? 'Ver' : 'Editar'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-6 border-t mt-auto">
                    <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} className="h-12 px-8">Cancelar</Button>
                    <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={createLevel.isPending || updateLevel.isPending || !name.trim() || (roleType === 'client' && !selectedClientId)}
                        className={cn("h-12 px-8 font-semibold text-base", roleType === 'client' ? "bg-blue-600 hover:bg-blue-700" : "")}
                    >
                        {(createLevel.isPending || updateLevel.isPending) && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        {levelToEdit ? 'Salvar Alterações' : roleType === 'client' ? 'Criar Acesso de Cliente' : 'Criar Nível de Acesso'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
