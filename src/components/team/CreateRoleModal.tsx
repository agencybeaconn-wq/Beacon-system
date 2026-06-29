import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Shield, X } from "lucide-react";
import { useAgencyRoles, AgencyRole } from "@/hooks/useAgencyRoles";

const INITIAL_COMPETENCIES = [
    { id: 'strategy', label: 'Estratégia' },
    { id: 'shopify', label: 'Shopify / Dados' },
    { id: 'traffic', label: 'Tráfego Pago' },
    { id: 'automations', label: 'Automações & CRM' },
    { id: 'design', label: 'Design' },
    { id: 'copywriting', label: 'Copywriting' },
];

interface CreateRoleModalProps {
    roleToEdit?: AgencyRole;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function CreateRoleModal({ roleToEdit, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: CreateRoleModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = setControlledOpen || setInternalOpen;

    const [name, setName] = useState("");
    const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
    const [customCompetency, setCustomCompetency] = useState("");
    const [availableCompetencies, setAvailableCompetencies] = useState(INITIAL_COMPETENCIES);
    const { createRole, updateRole } = useAgencyRoles();

    // Initialize or Reset state
    useEffect(() => {
        if (isOpen) {
            if (roleToEdit) {
                setName(roleToEdit.name);
                setSelectedCompetencies(roleToEdit.permissions || []);

                // Merge existing permissions with initial to ensure displayed
                const existingIds = new Set(INITIAL_COMPETENCIES.map(p => p.id));
                const customFromRole = (roleToEdit.permissions || [])
                    .filter(p => !existingIds.has(p))
                    .map(p => ({ id: p, label: p }));

                setAvailableCompetencies([...INITIAL_COMPETENCIES, ...customFromRole]);
            } else {
                setAvailableCompetencies(INITIAL_COMPETENCIES);
                setSelectedCompetencies([]);
                setName("");
            }
        }
    }, [isOpen, roleToEdit]);

    const handleAddCustomCompetency = () => {
        if (!customCompetency.trim()) return;

        const newId = customCompetency.toLowerCase().replace(/\s+/g, '_');

        // Avoid duplicates
        if (!availableCompetencies.find(p => p.id === newId)) {
            setAvailableCompetencies(prev => [...prev, { id: newId, label: customCompetency.trim() }]);
            // Auto-select the new competency
            setSelectedCompetencies(prev => [...prev, newId]);
        }

        setCustomCompetency("");
    };

    const handleToggleCompetency = (id: string) => {
        setSelectedCompetencies(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        if (roleToEdit) {
            await updateRole.mutateAsync({
                id: roleToEdit.id,
                name: name.trim(),
                permissions: selectedCompetencies,
            });
        } else {
            await createRole.mutateAsync({
                name: name.trim(),
                permissions: selectedCompetencies,
            });
        }

        setIsOpen(false);
        if (!roleToEdit) {
            setName("");
            setSelectedCompetencies([]);
            setAvailableCompetencies(INITIAL_COMPETENCIES);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {controlledOpen === undefined && (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button variant="outline" className="gap-2">
                            <Plus className="w-4 h-4" />
                            Criar Função
                        </Button>
                    )}
                </DialogTrigger>
            )}

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{roleToEdit ? 'Editar Função' : 'Nova Função / Cargo'}</DialogTitle>
                    <DialogDescription>
                        {roleToEdit ? 'Edite o nome e as competências do cargo.' : 'Crie um cargo personalizado para organizar sua equipe e definir competências.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Nome da Função / Cargo</Label>
                        <Input
                            placeholder="Ex: Gestor de Tráfego, Head de Design..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <Label className="text-base font-bold">Competências & Especialidades</Label>
                        <p className="text-xs text-muted-foreground mb-4">
                            Selecione ou adicione as especialidades ligadas a este cargo. Isso ajudará na atribuição automática de tarefas no futuro.
                        </p>

                        <div className="flex gap-2 mb-2">
                            <Input
                                placeholder="Adicionar competência (ex: TikTok Ads)"
                                value={customCompetency}
                                onChange={(e) => setCustomCompetency(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomCompetency();
                                    }
                                }}
                                className="h-8 text-sm"
                            />
                            <Button size="sm" variant="secondary" onClick={handleAddCustomCompetency} type="button">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {availableCompetencies.map(perm => (
                                <div
                                    key={perm.id}
                                    className={`
                                        group flex items-center gap-1 rounded-full border text-xs transition-all select-none pl-3 pr-1 py-1
                                        ${selectedCompetencies.includes(perm.id)
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                        }
                                    `}
                                >
                                    <span
                                        onClick={() => handleToggleCompetency(perm.id)}
                                        className="cursor-pointer"
                                    >
                                        {perm.label}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAvailableCompetencies(prev => prev.filter(p => p.id !== perm.id));
                                            setSelectedCompetencies(prev => prev.filter(p => p !== perm.id));
                                        }}
                                        className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {availableCompetencies.length === 0 && (
                                <p className="text-xs text-muted-foreground italic w-full text-center py-4 bg-muted/20 rounded">
                                    Nenhuma competência disponível. Adicione uma acima.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={createRole.isPending || updateRole.isPending || !name.trim()}>
                        {(createRole.isPending || updateRole.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {roleToEdit ? 'Salvar Alterações' : 'Criar Função'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
