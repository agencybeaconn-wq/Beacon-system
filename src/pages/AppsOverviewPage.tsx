import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Smartphone, Loader2, ArrowRight, Link2, Radio, TabletSmartphone,
    ShoppingBag, Banknote, MonitorSmartphone, AlertCircle, RefreshCw,
} from "lucide-react";

/**
 * Módulo Apps Mobile — gestão da agência (/aplicativos).
 * Visão de todos os clientes com app white-label: status, devices, pedidos,
 * receita e saúde de webhooks, com atalho pro módulo de cada cliente.
 * Fonte: view app_overview (security_invoker — RLS das tabelas-base vale).
 */

interface AppOverviewRow {
    app_id: string;
    client_id: string;
    client_name: string;
    logo_url: string | null;
    app_name: string;
    bundle_id: string;
    status: string;
    created_at: string;
    devices: number;
    pedidos: number;
    receita: number;
    ultimo_webhook: string | null;
    webhooks_ativos: number;
}

interface LinkableClient {
    id: string;
    name: string;
    logo_url: string | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    em_revisao: { label: "Em revisão", variant: "outline" },
    publicado: { label: "Publicado", variant: "default" },
    transferido: { label: "Transferido", variant: "outline" },
};

function tempoRelativo(iso: string | null): string {
    if (!iso) return "nunca";
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
}

export default function AppsOverviewPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [apps, setApps] = useState<AppOverviewRow[]>([]);
    const [linkable, setLinkable] = useState<LinkableClient[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setErro(null);

        const [overviewRes, clientsRes] = await Promise.all([
            supabase.from("app_overview").select("*").order("client_name"),
            supabase.from("agency_clients")
                .select("id, name, logo_url")
                .eq("shopify_status", "connected")
                .or("is_archived.is.null,is_archived.eq.false")
                .or("is_internal.is.null,is_internal.eq.false")
                .order("name"),
        ]);

        const rows = (overviewRes.data ?? []) as AppOverviewRow[];
        setApps(rows);

        if (!clientsRes.error) {
            const comApp = new Set(rows.map((a) => a.client_id));
            setLinkable((clientsRes.data ?? []).filter((c) => !comApp.has(c.id)));
        }

        // erro explícito na tela — empty-state falso ("nenhum app") é pior que erro visível
        const failure = overviewRes.error ?? clientsRes.error;
        if (failure) {
            setErro(failure.message);
            toast({ title: "Erro ao carregar aplicativos", description: failure.message, variant: "destructive" });
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (erro) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="flex flex-col items-center gap-3 text-center px-4">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                    <p className="text-sm text-muted-foreground max-w-md">Erro ao carregar os aplicativos: {erro}</p>
                    <Button variant="outline" onClick={() => void fetchData()}>
                        <RefreshCw className="w-4 h-4 mr-2" />Tentar novamente
                    </Button>
                </div>
            </div>
        );
    }

    const totais = apps.reduce(
        (acc, a) => ({
            devices: acc.devices + a.devices,
            pedidos: acc.pedidos + a.pedidos,
            receita: acc.receita + Number(a.receita),
        }),
        { devices: 0, pedidos: 0, receita: 0 },
    );

    const kpis = [
        { label: "Apps vinculados", value: String(apps.length), icon: MonitorSmartphone },
        { label: "Devices", value: String(totais.devices), icon: TabletSmartphone },
        { label: "Pedidos pelo app", value: String(totais.pedidos), icon: ShoppingBag },
        {
            label: "Receita dos apps",
            value: totais.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            icon: Banknote,
        },
    ];

    return (
        <div className="w-full px-10 py-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Smartphone className="w-6 h-6 text-primary" />
                    Aplicativos
                </h1>
                <p className="text-sm text-muted-foreground">
                    Gestão dos apps white-label dos clientes: publicação, push, pedidos e saúde.
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi) => (
                    <Card key={kpi.label} className="shadow-none border-border/40">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5">
                                <kpi.icon className="w-4 h-4" />{kpi.label}
                            </CardDescription>
                            <CardTitle className="text-3xl">{kpi.value}</CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <Card className="shadow-none border-border/40">
                <CardHeader>
                    <CardTitle className="text-lg">Apps vinculados</CardTitle>
                    <CardDescription>Um app por cliente — clique em gerenciar pra abrir o módulo completo.</CardDescription>
                </CardHeader>
                <CardContent>
                    {apps.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            Nenhum app vinculado ainda — use a lista de clientes prontos abaixo.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>App</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Devices</TableHead>
                                        <TableHead className="text-right">Pedidos</TableHead>
                                        <TableHead className="text-right">Receita</TableHead>
                                        <TableHead>Webhooks</TableHead>
                                        <TableHead>Último evento</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {apps.map((a) => {
                                        const badge = STATUS_BADGE[a.status] ?? { label: a.status, variant: "secondary" as const };
                                        const webhooksOk = a.webhooks_ativos >= 6;
                                        return (
                                            <TableRow key={a.app_id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2.5">
                                                        {a.logo_url ? (
                                                            <img src={a.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                                {a.client_name.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="font-medium">{a.client_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{a.app_name}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{a.bundle_id}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                                                <TableCell className="text-right tabular-nums">{a.devices}</TableCell>
                                                <TableCell className="text-right tabular-nums">{a.pedidos}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {Number(a.receita).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center gap-1.5 text-sm ${webhooksOk ? "text-emerald-500" : "text-amber-500"}`}>
                                                        <Radio className="w-3.5 h-3.5" />{a.webhooks_ativos}/6
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {tempoRelativo(a.ultimo_webhook)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${a.client_id}/aplicativo`)}>
                                                        Gerenciar<ArrowRight className="w-4 h-4 ml-1.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-none border-border/40">
                <CardHeader>
                    <CardTitle className="text-lg">Prontos pra vincular</CardTitle>
                    <CardDescription>Clientes com Shopify conectada que ainda não têm app.</CardDescription>
                </CardHeader>
                <CardContent>
                    {linkable.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Todos os clientes com Shopify conectada já têm app vinculado.
                        </p>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {linkable.map((c) => (
                                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-4 py-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {c.logo_url ? (
                                            <img src={c.logo_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                {c.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="font-medium truncate">{c.name}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(`/clients/${c.id}/aplicativo`)}>
                                        <Link2 className="w-4 h-4 mr-1.5" />Vincular
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
