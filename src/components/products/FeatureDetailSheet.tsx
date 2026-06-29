import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ProductFeature, useAgencyProducts } from "@/hooks/useAgencyProducts";
import { useAgencyTeam } from "@/hooks/useAgencyTeam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
    Check, Plus, Trash2, UserPlus, ListTodo, X, GripVertical,
    MoreHorizontal, CheckCircle2, Circle, AlignLeft, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FeatureDetailSheetProps {
    featureId: string | null;
    productId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

import { useToast } from "@/hooks/use-toast";

export function FeatureDetailSheet({ featureId, productId, open, onOpenChange }: FeatureDetailSheetProps) {
    const { products, updateFeature } = useAgencyProducts();
    const { members } = useAgencyTeam();
    const { toast } = useToast();
    const [newSubtask, setNewSubtask] = useState("");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editDescription, setEditDescription] = useState("");

    const feature = useMemo(() => {
        if (!featureId || !productId) return null;
        const product = products.find(p => p.id === productId);
        return product?.features?.find(f => f.id === featureId) || null;
    }, [products, featureId, productId]);

    const subtasks = useMemo(() => feature?.subtasks || [], [feature?.subtasks]);
    const assignedMember = useMemo(() =>
        members.find(m => m.id === feature?.assigned_member_id),
        [members, feature?.assigned_member_id]);

    // Sync description when feature changes
    useEffect(() => {
        if (feature) setEditDescription(feature.description || "");
    }, [feature?.id, feature?.description]);

    const handleAddSubtask = async () => {
        if (!feature || !newSubtask.trim()) return;

        const updatedSubtasks = [
            ...subtasks,
            { id: `st_${Date.now()}`, title: newSubtask.trim(), completed: false }
        ];

        try {
            await updateFeature.mutateAsync({
                id: feature.id,
                subtasks: updatedSubtasks
            });
            setNewSubtask("");
            toast({ title: "Sub-tarefa adicionada" });
        } catch (error) {
            console.error(error);
        }
    };

    const handleToggleSubtask = async (subtaskId: string) => {
        if (!feature) return;

        const updatedSubtasks = subtasks.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );

        try {
            await updateFeature.mutateAsync({
                id: feature.id,
                subtasks: updatedSubtasks
            });
            toast({ title: "Status atualizado" });
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteSubtask = async (subtaskId: string) => {
        if (!feature) return;

        const updatedSubtasks = subtasks.filter(st => st.id !== subtaskId);

        try {
            await updateFeature.mutateAsync({
                id: feature.id,
                subtasks: updatedSubtasks
            });
            toast({ title: "Sub-tarefa removida" });
        } catch (error) {
            console.error(error);
        }
    };

    const handleAssignMember = async (memberId: string | null) => {
        if (!feature) return;

        try {
            await updateFeature.mutateAsync({
                id: feature.id,
                assigned_member_id: memberId
            });

            const memberName = members.find(m => m.id === memberId)?.profile?.full_name || "Sem responsável";
            toast({
                title: "Responsável atualizado",
                description: memberId ? `Atribuído a: ${memberName}` : "Removido responsável"
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveDescription = async () => {
        if (!feature) return;
        if (editDescription !== (feature.description || "")) {
            try {
                await updateFeature.mutateAsync({
                    id: feature.id,
                    description: editDescription
                });
                toast({ title: "Descrição atualizada" });
            } catch (error) {
                console.error(error);
                toast({ title: "Erro ao salvar descrição", variant: "destructive" } as any);
            }
        }
        setIsEditingDescription(false);
    };

    if (!feature) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="pb-6 border-b">
                    <SheetTitle className="text-xl font-bold">{feature.name}</SheetTitle>
                    <SheetDescription>
                        Defina os sub-processos e atribua responsáveis para este entregável.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-8 space-y-8">
                    {/* Assignment Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-primary" />
                                Responsável Padrão
                            </h3>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                                    {assignedMember ? (
                                        <>
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={assignedMember.profile?.avatar_url || undefined} />
                                                <AvatarFallback>{assignedMember.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                            </Avatar>
                                            <span className="flex-1 text-left truncate">{assignedMember.profile?.full_name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                                <UserPlus className="w-3 h-3 text-muted-foreground" />
                                            </div>
                                            <span className="flex-1 text-left text-muted-foreground">Selecionar responsável...</span>
                                        </>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64">
                                <DropdownMenuItem onClick={() => handleAssignMember(null)}>
                                    Sem responsável
                                </DropdownMenuItem>
                                {members.map(member => (
                                    <DropdownMenuItem key={member.id} onClick={() => handleAssignMember(member.id)} className="gap-2">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                                            <AvatarFallback>{member.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                        {member.profile?.full_name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Description Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <AlignLeft className="w-4 h-4 text-primary" />
                                Descrição
                            </h3>
                        </div>

                        {isEditingDescription ? (
                            <Textarea
                                autoFocus
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                onBlur={handleSaveDescription}
                                placeholder="Descreva esta demanda padrão..."
                                className="min-h-[120px] text-sm leading-relaxed p-3 bg-background border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                                style={{ whiteSpace: 'pre-wrap' }}
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditingDescription(true)}
                                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed min-h-[60px] p-3 rounded-lg hover:bg-muted/30 cursor-text transition-colors border border-border/30 hover:border-border/60 group relative bg-muted/5"
                                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            >
                                {feature.description || <span className="italic opacity-50">Clique para adicionar uma descrição...</span>}
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* Subtasks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <ListTodo className="w-4 h-4 text-primary" />
                                Sub-processos / Demandas
                            </h3>
                            <Badge variant="secondary" className="text-[10px]">{subtasks.length}</Badge>
                        </div>

                        <div className="space-y-2">
                            {subtasks.map((st) => (
                                <div key={st.id} className="flex items-center gap-2 group p-2 hover:bg-muted/50 rounded-md transition-colors border border-transparent hover:border-border/50">
                                    <span className={cn(
                                        "flex-1 text-sm transition-all",
                                        st.completed && "text-muted-foreground line-through opacity-70"
                                    )}>
                                        {st.title}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                        onClick={() => handleDeleteSubtask(st.id)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}

                            <div className="flex items-center gap-2 pt-2">
                                <Input
                                    value={newSubtask}
                                    onChange={(e) => setNewSubtask(e.target.value)}
                                    placeholder="Adicionar sub-processo..."
                                    className="h-9 text-sm"
                                    onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                                />
                                <Button size="icon" onClick={handleAddSubtask} disabled={!newSubtask.trim()} className="h-9 w-9 shrink-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-6 bg-white border-t space-y-4">
                    <p className="text-[11px] text-muted-foreground italic text-center">
                        Estas demandas serão aplicadas automaticamente na timeline do cliente ao contratar este produto.
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
