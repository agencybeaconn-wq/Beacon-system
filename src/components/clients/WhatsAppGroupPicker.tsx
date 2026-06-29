import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Check, RefreshCw, Search, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppGroup {
    jid: string;
    name: string;
    participantCount: number;
}

interface WhatsAppGroupPickerProps {
    valueJid?: string | null;
    valueName?: string | null;
    onChange: (group: { jid: string; name: string } | null) => void;
    disabled?: boolean;
}

export function WhatsAppGroupPicker({ valueJid, valueName, onChange, disabled }: WhatsAppGroupPickerProps) {
    const [open, setOpen] = useState(false);
    const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const fetchGroups = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fnError } = await supabase.functions.invoke("list-whatsapp-groups", {
                body: {},
            });

            if (fnError) throw new Error(fnError.message);
            if (data?.error) throw new Error(data.error);

            setGroups(data?.groups || []);
            setHasFetched(true);
        } catch (err: any) {
            setError(err.message || "Erro ao listar grupos");
            toast.error("Não consegui listar grupos: " + (err.message || "erro desconhecido"));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open && !hasFetched && !isLoading) {
            fetchGroups();
        }
    }, [open, hasFetched, isLoading]);

    const filteredGroups = useMemo(() => {
        if (!search.trim()) return groups;
        const q = search.toLowerCase();
        return groups.filter(g => g.name.toLowerCase().includes(q));
    }, [groups, search]);

    const handleSelect = (group: WhatsAppGroup) => {
        onChange({ jid: group.jid, name: group.name });
        setOpen(false);
        setSearch("");
    };

    const handleClear = () => {
        onChange(null);
    };

    const isSelected = !!valueJid;

    // ── Popover de busca/troca (reaproveitado nos 2 estados visuais) ─────────────
    const popoverContent = (
        <PopoverContent className="w-[360px] p-0" align="end">
            <div className="flex items-center border-b px-3 py-2 gap-2">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar grupo..."
                    className="border-0 focus-visible:ring-0 h-8 px-0"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={fetchGroups}
                    disabled={isLoading}
                    title="Atualizar lista"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </Button>
            </div>

            <div className="max-h-72 overflow-y-auto py-1">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Carregando grupos...
                    </div>
                ) : error ? (
                    <div className="px-3 py-4 text-sm text-destructive">
                        <p>{error}</p>
                        <Button type="button" variant="link" className="h-auto p-0 mt-2 text-xs" onClick={fetchGroups}>
                            Tentar novamente
                        </Button>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {hasFetched ? "Nenhum grupo encontrado" : "Abra para buscar"}
                    </div>
                ) : (
                    filteredGroups.map((group) => (
                        <button
                            key={group.jid}
                            type="button"
                            onClick={() => handleSelect(group)}
                            className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2",
                                group.jid === valueJid && "bg-muted/60"
                            )}
                        >
                            <span className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{group.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {group.participantCount} {group.participantCount === 1 ? "participante" : "participantes"}
                                </span>
                            </span>
                            {group.jid === valueJid && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                        </button>
                    ))
                )}
            </div>
        </PopoverContent>
    );

    // ── Estado COM grupo selecionado: card destacado + acoes "Trocar"/"Remover" ──
    if (isSelected) {
        return (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-colors">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground truncate">
                                {valueName || valueJid?.substring(0, 24) + "..."}
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Notificações ativas neste grupo
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                    className="h-8 text-xs gap-1"
                                >
                                    Trocar
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </PopoverTrigger>
                            {popoverContent}
                        </Popover>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            disabled={disabled}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            title="Remover grupo"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Estado SEM grupo: botao chamativo pra selecionar ─────────────────────────
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className="w-full justify-between font-normal h-12 text-muted-foreground border-dashed"
                >
                    <span className="flex items-center gap-2 truncate">
                        <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>Selecionar grupo do cliente</span>
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            {popoverContent}
        </Popover>
    );
}
