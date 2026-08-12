import { useCallback, useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    CheckCircle2, Loader2, Pencil, Plus, Trash2, Flag,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface PriorityProject {
    id: string;
    workspace_id: string;
    client_id: string | null;
    title: string;
    start_date: string; // yyyy-MM-dd
    due_date: string;   // yyyy-MM-dd
    priority_order: number;
    status: "active" | "delivered";
    clientName?: string;
}

interface ClientOption {
    id: string;
    name: string;
}

/** Dias corridos até a entrega (negativo = atrasado). */
function daysLeft(due: string): number {
    return differenceInCalendarDays(parseISO(due), new Date());
}

/** % do prazo já consumido (start → due), clampado em 0..100. */
/** "terça-feira, 11 de agosto" → "Terça-feira, 11 de agosto" (só a 1ª letra). */
function sentenceCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function elapsedPct(start: string, due: string): number {
    const total = differenceInCalendarDays(parseISO(due), parseISO(start));
    if (total <= 0) return 100;
    const used = differenceInCalendarDays(new Date(), parseISO(start));
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

/**
 * Fila de prioridade de projetos ativos — ordem de execução explícita, data de
 * entrega, contagem regressiva e barra de prazo consumido. Persistida em
 * `project_priorities` (RLS por workspace, mesmo isolamento do kanban).
 */
export function ProjectPriorities() {
    const { workspaceId } = useDashboard();
    const [projects, setProjects] = useState<PriorityProject[]>([]);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Form de adição
    const [addOpen, setAddOpen] = useState(false);
    const [newClientId, setNewClientId] = useState<string>("");
    const [newTitle, setNewTitle] = useState("");
    const [newDue, setNewDue] = useState<Date | undefined>(undefined);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [{ data: rows, error }, { data: cls, error: clsErr }] = await Promise.all([
                // Auto-organizada por prazo: quem vence primeiro é a prioridade 1.
                (supabase as any)
                    .from("project_priorities")
                    .select("*, agency_clients:client_id(name)")
                    .eq("workspace_id", workspaceId)
                    .eq("status", "active")
                    .order("due_date", { ascending: true }),
                (supabase as any)
                    .from("agency_clients")
                    .select("id, name")
                    .eq("workspace_id", workspaceId)
                    .order("name"),
            ]);
            if (error) throw error;
            if (clsErr) throw clsErr;
            setProjects((rows || []).map((r: any) => ({ ...r, clientName: r.agency_clients?.name })));
            setClients(cls || []);
        } catch (err: any) {
            console.error("[ProjectPriorities] load:", err);
            toast.error("Erro ao carregar prioridades: " + (err.message || err));
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!workspaceId || !newDue) return;
        const client = clients.find(c => c.id === newClientId);
        const title = newTitle.trim() || client?.name;
        if (!title) {
            toast.error("Selecione um cliente ou dê um nome ao projeto.");
            return;
        }
        setSaving(true);
        try {
            const nextOrder = projects.length ? Math.max(...projects.map(p => p.priority_order)) + 1 : 1;
            const { error } = await (supabase as any).from("project_priorities").insert({
                workspace_id: workspaceId,
                client_id: newClientId || null,
                title,
                due_date: format(newDue, "yyyy-MM-dd"),
                priority_order: nextOrder,
            });
            if (error) throw error;
            toast.success("Projeto adicionado à fila.");
            setAddOpen(false);
            setNewClientId("");
            setNewTitle("");
            setNewDue(undefined);
            await load();
        } catch (err: any) {
            console.error("[ProjectPriorities] add:", err);
            toast.error("Erro ao adicionar: " + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    // ---- Edição de um projeto da fila ----
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editClientId, setEditClientId] = useState<string>("");
    const [editTitle, setEditTitle] = useState("");
    const [editDue, setEditDue] = useState<Date | undefined>(undefined);
    const [savingEdit, setSavingEdit] = useState(false);

    const openEdit = (p: PriorityProject) => {
        setEditingId(p.id);
        setEditClientId(p.client_id ?? "");
        setEditTitle(p.title);
        setEditDue(parseISO(p.due_date));
    };

    const handleEditSave = async () => {
        if (!editingId || !editDue || !editTitle.trim()) return;
        setSavingEdit(true);
        try {
            const { error } = await (supabase as any)
                .from("project_priorities")
                .update({
                    title: editTitle.trim(),
                    client_id: editClientId || null,
                    due_date: format(editDue, "yyyy-MM-dd"),
                })
                .eq("id", editingId);
            if (error) throw error;
            toast.success("Projeto atualizado.");
            setEditingId(null);
            await load(); // a fila se reordena sozinha pelo novo prazo
        } catch (err: any) {
            console.error("[ProjectPriorities] edit:", err);
            toast.error("Erro ao salvar: " + (err.message || err));
        } finally {
            setSavingEdit(false);
        }
    };

    const deliver = async (p: PriorityProject) => {
        const { error } = await (supabase as any)
            .from("project_priorities").update({ status: "delivered" }).eq("id", p.id);
        if (error) {
            toast.error("Erro ao entregar: " + error.message);
            return;
        }
        toast.success(`"${p.title}" entregue!`);
        await load();
    };

    const remove = async (p: PriorityProject) => {
        const { error } = await (supabase as any)
            .from("project_priorities").delete().eq("id", p.id);
        if (error) {
            toast.error("Erro ao remover: " + error.message);
            return;
        }
        await load();
    };

    // Lista já vem ordenada por prazo — a próxima entrega é a primeira.
    const nextDelivery = projects[0] ?? null;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full max-w-5xl">
            {/* Resumo + adicionar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-5">
                    <div>
                        <p className="text-xs text-muted-foreground">Projetos na fila</p>
                        <p className="text-2xl font-semibold font-mono-numbers">{projects.length}</p>
                    </div>
                    {nextDelivery && (
                        <div>
                            <p className="text-xs text-muted-foreground">Próxima entrega</p>
                            <p className="text-2xl font-semibold font-mono-numbers">
                                {sentenceCase(format(parseISO(nextDelivery.due_date), "EEE, dd MMM", { locale: ptBR }).replace(/\./g, ""))}
                                <span className="text-sm text-muted-foreground ml-2 font-normal">
                                    {daysLeft(nextDelivery.due_date) > 1 && `em ${daysLeft(nextDelivery.due_date)} dias`}
                                    {daysLeft(nextDelivery.due_date) === 1 && "amanhã"}
                                    {daysLeft(nextDelivery.due_date) === 0 && "HOJE"}
                                    {daysLeft(nextDelivery.due_date) < 0 && `atrasado ${-daysLeft(nextDelivery.due_date)}d`}
                                </span>
                            </p>
                        </div>
                    )}
                </div>

                <Popover open={addOpen} onOpenChange={setAddOpen}>
                    <PopoverTrigger asChild>
                        <Button size="sm" className="h-9">
                            <Plus className="h-4 w-4" /> Adicionar projeto
                        </Button>
                    </PopoverTrigger>
                    {/* maxHeight = espaço real que o Radix tem na viewport; o meio
                        rola e o botão de confirmar fica SEMPRE visível no rodapé. */}
                    <PopoverContent
                        className="w-[320px] p-0 flex flex-col overflow-hidden"
                        align="end"
                        collisionPadding={12}
                        style={{ maxHeight: "min(var(--radix-popover-content-available-height), 640px)" }}
                    >
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <p className="text-sm font-semibold">Novo projeto na fila</p>
                            <Select value={newClientId} onValueChange={setNewClientId}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Cliente (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder={newClientId ? "Nome do projeto (opcional)" : "Nome do projeto"}
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Data de entrega</p>
                                <Calendar
                                    mode="single"
                                    selected={newDue}
                                    onSelect={setNewDue}
                                    locale={ptBR}
                                    disabled={{ before: new Date() }}
                                    className="p-0"
                                />
                            </div>
                        </div>
                        <div className="p-3 border-t border-border/40 shrink-0">
                            <Button
                                className="w-full h-10"
                                disabled={saving || !newDue || (!newClientId && !newTitle.trim())}
                                onClick={handleAdd}
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar à fila"}
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Fila */}
            {projects.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border/30 py-16 text-center">
                    <Flag className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                        Nenhum projeto na fila. Adicione o primeiro pra definir a ordem de execução.
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {projects.map((p, i) => {
                        const left = daysLeft(p.due_date);
                        const pct = elapsedPct(p.start_date, p.due_date);
                        const overdue = left < 0;
                        const urgent = left >= 0 && left <= 3;
                        return (
                            <div
                                key={p.id}
                                className="mat-card rounded-lg p-4 flex items-center gap-4 transition-shadow duration-200 hover:shadow-elev-2"
                            >
                                {/* Posição */}
                                <div className={cn(
                                    "flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold font-mono-numbers shrink-0",
                                    i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                                )}>
                                    {i + 1}
                                </div>

                                {/* Título + barra de prazo */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <p className="font-semibold truncate">{p.title}</p>
                                        {p.clientName && p.clientName !== p.title && (
                                            <span className="text-xs text-muted-foreground truncate">{p.clientName}</span>
                                        )}
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-[width] duration-500",
                                                overdue ? "bg-destructive" : urgent ? "bg-warning" : "bg-primary",
                                            )}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Prazo: countdown + dia da semana + tile de calendário */}
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                        <p className={cn(
                                            "text-sm font-semibold font-mono-numbers whitespace-nowrap",
                                            overdue ? "text-destructive" : urgent ? "text-warning" : "text-foreground",
                                        )}>
                                            {overdue ? `${-left}d atrasado` : left === 0 ? "entrega HOJE" : left === 1 ? "amanhã" : `${left}d restantes`}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            {sentenceCase(format(parseISO(p.due_date), "EEEE, dd 'de' MMMM", { locale: ptBR }))}
                                        </p>
                                    </div>
                                    {/* Tile estilo ícone de Calendário da Apple: mês na faixa, dia grande.
                                        Cores com foreground CORRETO por urgência — nada de texto branco
                                        sobre faixa clara (bg-primary no dark é branco). */}
                                    <div className="w-12 rounded-[10px] overflow-hidden border border-border/50 shadow-elev-1 shrink-0 text-center bg-background/60 backdrop-blur-md">
                                        <div className={cn(
                                            "text-[9px] font-bold uppercase tracking-wide py-0.5",
                                            overdue ? "bg-destructive text-white"
                                                : urgent ? "bg-warning text-black"
                                                    : "bg-system-info text-white",
                                        )}>
                                            {format(parseISO(p.due_date), "MMM", { locale: ptBR }).replace(".", "")}
                                        </div>
                                        <div className="text-lg font-semibold font-mono-numbers leading-tight py-0.5">
                                            {format(parseISO(p.due_date), "dd")}
                                        </div>
                                    </div>
                                </div>

                                {/* Ações: editar / entregar / remover */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <Popover open={editingId === p.id} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                title="Editar projeto"
                                                onClick={() => openEdit(p)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-[320px] p-0 flex flex-col overflow-hidden"
                                            align="end"
                                            collisionPadding={12}
                                            style={{ maxHeight: "min(var(--radix-popover-content-available-height), 640px)" }}
                                        >
                                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                <p className="text-sm font-semibold">Editar projeto</p>
                                                <Select value={editClientId} onValueChange={setEditClientId}>
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue placeholder="Cliente (opcional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {clients.map(c => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    placeholder="Nome do projeto"
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                />
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1.5">Data de entrega</p>
                                                    <Calendar
                                                        mode="single"
                                                        selected={editDue}
                                                        onSelect={setEditDue}
                                                        defaultMonth={editDue}
                                                        locale={ptBR}
                                                        className="p-0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-3 border-t border-border/40 shrink-0">
                                                <Button
                                                    className="w-full h-10"
                                                    disabled={savingEdit || !editDue || !editTitle.trim()}
                                                    onClick={handleEditSave}
                                                >
                                                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-success"
                                        title="Marcar como entregue"
                                        onClick={() => deliver(p)}
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        title="Remover da fila"
                                        onClick={() => remove(p)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
