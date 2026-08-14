import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, BellRing, CheckCircle2, Loader2, Package, RefreshCw, Truck } from "lucide-react";

interface Props { clientId: string; appId: string }
interface TrackedOrder {
    id: string; order_number: string; tracking_number: string | null; carrier: string;
    status: string; last_event_text: string; last_event_at: string | null; delivered_at: string | null;
}
interface Journey { id: string; preset_key: string | null; name: string; active: boolean }

const PRESETS = [
    {
        key: "tracking_confirmed", name: "Pedido confirmado",
        description: "Confirma imediatamente que o pedido entrou na operação.",
        definition: {
            trigger: { kind: "order_status_changed", status: "confirmado" },
            steps: [{ delay_minutes: 0, push: { title: "Pedido #{{pedido}} confirmado", body: "Recebemos seu pedido e ele já está sendo preparado.", image_url: null, deep_link: "/__app/rastreio" } }],
            exit_on: "delivery",
        },
    },
    {
        key: "tracking_posted", name: "Pedido postado",
        description: "Avisa quando a transportadora recebe a encomenda.",
        definition: {
            trigger: { kind: "order_status_changed", status: "postado" },
            steps: [{ delay_minutes: 0, push: { title: "Pedido #{{pedido}} a caminho", body: "Seu pedido foi postado. Acompanhe cada atualização pelo app.", image_url: null, deep_link: "/__app/rastreio" } }],
            exit_on: "delivery",
        },
    },
    {
        key: "tracking_out_for_delivery", name: "Saiu para entrega",
        description: "Prepara o cliente para receber a encomenda.",
        definition: {
            trigger: { kind: "order_status_changed", status: "saiu_para_entrega" },
            steps: [{ delay_minutes: 0, push: { title: "Chega hoje: pedido #{{pedido}}", body: "Seu pedido saiu para entrega. Fique de olho no endereço informado.", image_url: null, deep_link: "/__app/rastreio" } }],
            exit_on: "delivery",
        },
    },
    {
        key: "tracking_delivered", name: "Pedido entregue",
        description: "Fecha o ciclo de entrega e encerra os confortos pendentes.",
        definition: {
            trigger: { kind: "order_status_changed", status: "entregue" },
            steps: [{ delay_minutes: 0, push: { title: "Pedido #{{pedido}} entregue", body: "A entrega foi concluída. Esperamos que você aproveite sua compra!", image_url: null, deep_link: "/__app/rastreio" } }],
            exit_on: "none",
        },
    },
    {
        key: "tracking_silent_5d", name: "Conforto: 5 dias sem atualização",
        description: "Reduz ansiedade quando o rastreio demora a movimentar.",
        definition: {
            trigger: { kind: "order_silent", days_without_event: 5 },
            steps: [{ delay_minutes: 0, push: { title: "Seu pedido #{{pedido}} continua a caminho", body: "O rastreio pode levar alguns dias para atualizar entre centros logísticos. Seguimos acompanhando por aqui.", image_url: null, deep_link: "/__app/rastreio" } }],
            exit_on: "delivery",
        },
    },
] as const;

const STATUS_LABEL: Record<string, string> = {
    confirmado: "Confirmado", postado: "Postado", transito_internacional: "Trânsito internacional",
    alfandega: "Alfândega", transito_nacional: "Trânsito nacional", saiu_para_entrega: "Saiu para entrega",
    entregue: "Entregue", problema: "Ocorrência", desconhecido: "Aguardando atualização",
};

export function TrackingTab({ clientId, appId }: Props) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [orders, setOrders] = useState<TrackedOrder[]>([]);
    const [journeys, setJourneys] = useState<Journey[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        const [ordersRes, journeysRes] = await Promise.all([
            supabase.from("tracked_orders")
                .select("id, order_number, tracking_number, carrier, status, last_event_text, last_event_at, delivered_at")
                .eq("client_id", clientId).order("created_at", { ascending: false }).limit(50),
            supabase.from("journeys")
                .select("id, preset_key, name, active").eq("client_id", clientId).eq("kind", "conforto_entrega"),
        ]);
        const error = ordersRes.error ?? journeysRes.error;
        if (error) toast({ title: "Erro ao carregar rastreio", description: error.message, variant: "destructive" });
        setOrders((ordersRes.data ?? []) as TrackedOrder[]);
        setJourneys((journeysRes.data ?? []) as Journey[]);
        setLoading(false);
    }, [clientId, toast]);

    useEffect(() => { void load(); }, [load]);

    const journeyByKey = useMemo(
        () => new Map(journeys.filter((j) => j.preset_key).map((j) => [j.preset_key as string, j])),
        [journeys],
    );
    const activeCount = journeys.filter((j) => j.active && j.preset_key?.startsWith("tracking_")).length;
    const delivered = orders.filter((o) => o.status === "entregue").length;
    const problems = orders.filter((o) => o.status === "problema").length;

    const activateDefaults = async () => {
        setSaving(true);
        const rows = PRESETS.map((preset) => ({
            client_id: clientId, app_id: appId, kind: "conforto_entrega",
            preset_key: preset.key, name: preset.name, definition: preset.definition, active: true,
        }));
        const { error } = await supabase.from("journeys").upsert(rows, { onConflict: "client_id,preset_key" });
        setSaving(false);
        if (error) {
            toast({ title: "Não foi possível ativar os padrões", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Notificações automáticas ativadas", description: "Os cinco gatilhos de entrega estão prontos." });
        void load();
    };

    const toggle = async (preset: typeof PRESETS[number], active: boolean) => {
        setSaving(true);
        const { error } = await supabase.from("journeys").upsert({
            client_id: clientId, app_id: appId, kind: "conforto_entrega",
            preset_key: preset.key, name: preset.name, definition: preset.definition, active,
        }, { onConflict: "client_id,preset_key" });
        setSaving(false);
        if (error) toast({ title: "Erro ao atualizar automação", description: error.message, variant: "destructive" });
        else void load();
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

    return <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-none"><CardHeader className="pb-2"><CardDescription>Pedidos rastreados</CardDescription><CardTitle className="text-3xl">{orders.length}</CardTitle></CardHeader></Card>
            <Card className="shadow-none"><CardHeader className="pb-2"><CardDescription>Entregues</CardDescription><CardTitle className="text-3xl">{delivered}</CardTitle></CardHeader></Card>
            <Card className="shadow-none"><CardHeader className="pb-2"><CardDescription>Com ocorrência</CardDescription><CardTitle className="text-3xl">{problems}</CardTitle></CardHeader></Card>
        </div>

        <Card className="shadow-none border-border/50">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />Notificações de conforto</CardTitle><CardDescription className="mt-1.5">Mensagens transacionais; não entram no limite diário de marketing.</CardDescription></div>
                <Button onClick={activateDefaults} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Ativar padrões</Button>
            </CardHeader>
            <CardContent className="space-y-2">
                {PRESETS.map((preset) => {
                    const current = journeyByKey.get(preset.key);
                    return <div key={preset.key} className="flex items-center justify-between gap-5 rounded-xl border border-border/50 px-4 py-3">
                        <div><p className="text-sm font-semibold">{preset.name}</p><p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p></div>
                        <Switch checked={current?.active ?? false} disabled={saving} onCheckedChange={(active) => void toggle(preset, active)} aria-label={`Ativar ${preset.name}`} />
                    </div>;
                })}
                <p className="pt-2 text-xs text-muted-foreground">{activeCount}/5 automações ativas. Mensagens futuras poderão ser personalizadas sem alterar o motor.</p>
            </CardContent>
        </Card>

        <Card className="shadow-none border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Operação de pedidos</CardTitle><CardDescription>Eventos recebidos dos fulfillments da Shopify.</CardDescription></div>
                <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? <div className="py-12 text-center"><Truck className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Nenhum pedido atribuído ao app ainda</p><p className="mt-1 text-xs text-muted-foreground">O primeiro pedido pago pelo app aparecerá automaticamente.</p></div> :
                    <Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Status</TableHead><TableHead>Último evento</TableHead><TableHead>Rastreio</TableHead></TableRow></TableHeader><TableBody>
                        {orders.map((order) => <TableRow key={order.id}><TableCell className="font-medium">#{order.order_number}</TableCell><TableCell><Badge variant={order.status === "problema" ? "destructive" : order.status === "entregue" ? "default" : "secondary"}>{order.status === "problema" && <AlertTriangle className="mr-1 h-3 w-3" />}{STATUS_LABEL[order.status] ?? order.status}</Badge></TableCell><TableCell><p className="max-w-sm truncate text-sm">{order.last_event_text || "Aguardando evento"}</p><p className="text-xs text-muted-foreground">{order.last_event_at ? new Date(order.last_event_at).toLocaleString("pt-BR") : "—"}</p></TableCell><TableCell className="font-mono text-xs">{order.tracking_number ?? "—"}</TableCell></TableRow>)}
                    </TableBody></Table>}
            </CardContent>
        </Card>
    </div>;
}
