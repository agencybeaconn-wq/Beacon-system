// ════════════════════════════════════════════════════════════════════════════
// AlertConfigDialog — Configura PRA ONDE os alertas de erro vao no WhatsApp.
//
// Reusa a edge function list-whatsapp-groups (mesmo picker do grupo de cliente)
// pra listar os grupos da instancia Evolution conectada do admin. Salva em
// system_settings (RLS de UPDATE so admin). O system-alert-dispatcher le isso.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";

interface WhatsAppGroup {
    jid: string;
    name: string;
    participantCount: number;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AlertConfigDialog({ open, onOpenChange }: Props) {
    const { toast } = useToast();
    const [enabled, setEnabled] = useState(false);
    const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
    const [instanceName, setInstanceName] = useState<string | null>(null);
    const [selectedJid, setSelectedJid] = useState<string>("");
    const [currentGroupName, setCurrentGroupName] = useState<string | null>(null);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [saving, setSaving] = useState(false);

    // Carrega config atual ao abrir.
    useEffect(() => {
        if (!open) return;
        (async () => {
            const { data } = await supabase
                .from("system_settings")
                .select("alert_enabled, alert_instance_name, alert_group_jid, alert_group_name")
                .eq("id", 1)
                .maybeSingle();
            if (data) {
                setEnabled(!!data.alert_enabled);
                setInstanceName(data.alert_instance_name);
                setSelectedJid(data.alert_group_jid ?? "");
                setCurrentGroupName(data.alert_group_name);
            }
        })();
    }, [open]);

    const loadGroups = async () => {
        setLoadingGroups(true);
        const { data, error } = await supabase.functions.invoke("list-whatsapp-groups", { body: {} });
        setLoadingGroups(false);
        const apiError = error?.message ?? (data as { error?: string } | null)?.error;
        if (apiError) {
            toast({ title: "Não foi possível listar grupos", description: apiError, variant: "destructive" });
            return;
        }
        const payload = data as { groups: WhatsAppGroup[]; instanceName: string };
        setGroups(payload.groups ?? []);
        setInstanceName(payload.instanceName ?? null);
    };

    const save = async () => {
        // Se ligado, exige instancia + grupo escolhido.
        if (enabled && (!instanceName || !selectedJid)) {
            toast({
                title: "Faltam dados",
                description: "Carregue os grupos e escolha um antes de ligar os alertas.",
                variant: "destructive",
            });
            return;
        }
        setSaving(true);
        const chosen = groups.find((g) => g.jid === selectedJid);
        const { error } = await supabase
            .from("system_settings")
            .update({
                alert_enabled: enabled,
                alert_instance_name: instanceName,
                alert_group_jid: selectedJid || null,
                alert_group_name: chosen?.name ?? currentGroupName ?? null,
            })
            .eq("id", 1);
        setSaving(false);
        if (error) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Configuração de alerta salva" });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Alertas no WhatsApp</DialogTitle>
                    <DialogDescription>
                        Para onde os erros de produção são enviados. Um grupo, escolhido aqui.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="alert-enabled">Enviar alertas no WhatsApp</Label>
                        <Switch id="alert-enabled" checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Grupo de destino</Label>
                            <Button variant="ghost" size="sm" onClick={loadGroups} disabled={loadingGroups}>
                                {loadingGroups ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                <span className="ml-2">Carregar grupos</span>
                            </Button>
                        </div>

                        {groups.length > 0 ? (
                            <Select value={selectedJid} onValueChange={setSelectedJid}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Escolha um grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map((g) => (
                                        <SelectItem key={g.jid} value={g.jid}>
                                            {g.name} ({g.participantCount})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {selectedJid
                                    ? `Atual: ${currentGroupName ?? selectedJid}. Clique em "Carregar grupos" para trocar.`
                                    : 'Clique em "Carregar grupos" para listar os grupos da sua instância conectada.'}
                            </p>
                        )}
                        {instanceName && (
                            <p className="text-xs text-muted-foreground">Instância: {instanceName}</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={save} disabled={saving}>
                        {saving ? "Salvando…" : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
