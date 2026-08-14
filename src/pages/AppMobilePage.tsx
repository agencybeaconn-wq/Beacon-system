import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft, Smartphone, Loader2, Link2, RefreshCw, CheckCircle2,
    XCircle, AlertCircle, Radio, BellRing, Route as RouteIcon, Users2,
    Wallet, Package, Palette, Settings2, LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { PushTab } from "@/components/app-mobile/PushTab";
import { CrmTab } from "@/components/app-mobile/CrmTab";
import { PersonalizacaoTab } from "@/components/app-mobile/PersonalizacaoTab";
import { TrackingTab } from "@/components/app-mobile/TrackingTab";

/**
 * Módulo Apps Mobile — página por cliente (/clients/:id/aplicativo).
 * E1: Configurações (vínculo 1-clique + saúde da conexão) e Visão Geral com
 * contadores reais. Push/Automações/CRM/Cashback/Rastreio/Personalização
 * ganham corpo nas etapas E3–E8 do PLANO-MODULO-APPS.
 */

interface StoreApp {
    id: string;
    bundle_id: string;
    app_name: string;
    status: string;
    config: Record<string, unknown>;
    created_at: string;
}

interface WebhookSub { topic: string; enabled: boolean }
interface LinkResult { topic: string; status: string }

const slugify = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const STATUS_LABEL: Record<string, string> = {
    rascunho: 'Rascunho',
    em_revisao: 'Em revisão nas lojas',
    publicado: 'Publicado',
    transferido: 'Transferido pro cliente',
};

export default function AppMobilePage() {
    const { id: clientId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [clientName, setClientName] = useState('');
    const [shopifyConnected, setShopifyConnected] = useState(false);
    const [app, setApp] = useState<StoreApp | null>(null);
    const [subs, setSubs] = useState<WebhookSub[]>([]);
    const [lastWebhookAt, setLastWebhookAt] = useState<string | null>(null);
    const [counts, setCounts] = useState({ devices: 0, installs: 0, orders: 0, revenue: 0 });

    const [appName, setAppName] = useState('');
    const [bundleId, setBundleId] = useState('');
    const [linking, setLinking] = useState(false);
    const [linkResults, setLinkResults] = useState<LinkResult[] | null>(null);

    const load = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);

        const [{ data: client }, { data: appRow }] = await Promise.all([
            supabase.from('agency_clients')
                .select('name, shopify_status, shopify_domain')
                .eq('id', clientId).maybeSingle(),
            supabase.from('store_apps')
                .select('id, bundle_id, app_name, status, config, created_at')
                .eq('client_id', clientId).maybeSingle(),
        ]);

        if (client) {
            setClientName(client.name);
            setShopifyConnected(client.shopify_status === 'connected' && !!client.shopify_domain);
            setAppName((prev) => prev || client.name);
            setBundleId((prev) => prev || `com.${slugify(client.name)}.app`);
        }
        setApp(appRow as StoreApp | null);

        if (appRow) {
            const [subsRes, lastEvRes, devicesRes, installsRes, ordersRes] = await Promise.all([
                supabase.from('webhook_subscriptions')
                    .select('topic, enabled').eq('client_id', clientId).order('topic'),
                supabase.from('webhook_events')
                    .select('received_at').eq('client_id', clientId)
                    .order('received_at', { ascending: false }).limit(1).maybeSingle(),
                supabase.from('app_devices')
                    .select('id', { count: 'exact', head: true }).eq('client_id', clientId),
                supabase.from('app_events')
                    .select('id', { count: 'exact', head: true })
                    .eq('client_id', clientId).eq('type', 'install'),
                supabase.from('app_orders')
                    .select('total').eq('client_id', clientId),
            ]);
            setSubs((subsRes.data ?? []) as WebhookSub[]);
            setLastWebhookAt(lastEvRes.data?.received_at ?? null);
            setCounts({
                devices: devicesRes.count ?? 0,
                installs: installsRes.count ?? 0,
                orders: ordersRes.data?.length ?? 0,
                revenue: (ordersRes.data ?? []).reduce((acc, o: any) => acc + Number(o.total || 0), 0),
            });
        }
        setLoading(false);
    }, [clientId]);

    useEffect(() => { void load(); }, [load]);

    const vincular = async () => {
        if (!clientId) return;
        setLinking(true);
        setLinkResults(null);
        const { data, error } = await supabase.functions.invoke('app-link', {
            body: { client_id: clientId, bundle_id: bundleId.trim(), app_name: appName.trim() },
        });
        setLinking(false);
        if (error || data?.error) {
            toast.error(`Falha no vínculo: ${data?.error ?? error?.message}`);
            return;
        }
        setLinkResults(data.webhooks ?? []);
        toast.success('App vinculado e webhooks sincronizados.');
        void load();
    };

    const configVersion = useMemo(
        () => (app?.config as any)?.version ?? null,
        [app],
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const placeholder = (etapa: string, texto: string) => (
        <Card className="border-dashed border-border/60 shadow-none">
            <CardContent className="py-14 flex flex-col items-center gap-2 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground max-w-md">{texto}</p>
                <Badge variant="outline" className="mt-1">chega na etapa {etapa}</Badge>
            </CardContent>
        </Card>
    );

    return (
        <div className="w-full px-10 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${clientId}`)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Smartphone className="w-6 h-6 text-primary" />
                            Aplicativo — {clientName}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            App white-label da loja: push, automações, rastreio e cashback.
                        </p>
                    </div>
                </div>
                {app && (
                    <Badge variant={app.status === 'publicado' ? 'default' : 'secondary'}>
                        {STATUS_LABEL[app.status] ?? app.status}
                    </Badge>
                )}
            </div>

            <Tabs defaultValue={app ? 'visao-geral' : 'configuracoes'} className="w-full">
                <TabsList className="flex flex-wrap h-auto">
                    <TabsTrigger value="visao-geral"><LayoutDashboard className="w-4 h-4 mr-1.5" />Visão Geral</TabsTrigger>
                    <TabsTrigger value="push"><BellRing className="w-4 h-4 mr-1.5" />Push</TabsTrigger>
                    <TabsTrigger value="automacoes"><RouteIcon className="w-4 h-4 mr-1.5" />Automações</TabsTrigger>
                    <TabsTrigger value="crm"><Users2 className="w-4 h-4 mr-1.5" />CRM</TabsTrigger>
                    <TabsTrigger value="cashback"><Wallet className="w-4 h-4 mr-1.5" />Cashback</TabsTrigger>
                    <TabsTrigger value="rastreio"><Package className="w-4 h-4 mr-1.5" />Rastreio</TabsTrigger>
                    <TabsTrigger value="personalizacao"><Palette className="w-4 h-4 mr-1.5" />Personalização</TabsTrigger>
                    <TabsTrigger value="configuracoes"><Settings2 className="w-4 h-4 mr-1.5" />Configurações</TabsTrigger>
                </TabsList>

                <TabsContent value="visao-geral" className="mt-6">
                    {!app ? placeholder('atual', 'Vincule o app na aba Configurações pra começar a medir.') : (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Devices ativos', value: counts.devices },
                                { label: 'Instalações', value: counts.installs },
                                { label: 'Pedidos pelo app', value: counts.orders },
                                {
                                    label: 'Receita do app',
                                    value: counts.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                                },
                            ].map((kpi) => (
                                <Card key={kpi.label} className="shadow-none border-border/40">
                                    <CardHeader className="pb-2">
                                        <CardDescription>{kpi.label}</CardDescription>
                                        <CardTitle className="text-3xl">{kpi.value}</CardTitle>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="push" className="mt-6">
                    {app && clientId
                        ? <PushTab clientId={clientId} appId={app.id} />
                        : placeholder('atual', 'Vincule o app na aba Configurações pra liberar o push.')}
                </TabsContent>
                <TabsContent value="automacoes" className="mt-6">
                    {placeholder('E4', 'Jornadas: boas-vindas, carrinho abandonado e fluxos custom.')}
                </TabsContent>
                <TabsContent value="crm" className="mt-6">
                    {app && clientId
                        ? <CrmTab clientId={clientId} />
                        : placeholder('atual', 'Vincule o app na aba Configurações pra liberar o CRM.')}
                </TabsContent>
                <TabsContent value="cashback" className="mt-6">
                    {placeholder('E7', 'Regra de acúmulo, extrato e resgate por cupom.')}
                </TabsContent>
                <TabsContent value="rastreio" className="mt-6">
                    {app && clientId
                        ? <TrackingTab clientId={clientId} appId={app.id} />
                        : placeholder('atual', 'Vincule o app na aba Configurações pra liberar o rastreio.')}
                </TabsContent>
                <TabsContent value="personalizacao" className="mt-6">
                    {app && clientId
                        ? <PersonalizacaoTab clientId={clientId} appId={app.id} />
                        : placeholder('atual', 'Vincule o app na aba Configurações pra liberar a personalização.')}
                </TabsContent>

                <TabsContent value="configuracoes" className="mt-6 space-y-6">
                    {!shopifyConnected && (
                        <Card className="border-amber-500/40 bg-amber-500/5 shadow-none">
                            <CardContent className="py-4 flex items-center gap-3 text-sm">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                Este cliente não tem Shopify conectada — conecte a loja antes de vincular o app.
                            </CardContent>
                        </Card>
                    )}

                    {!app ? (
                        <Card className="shadow-none border-border/40">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-primary" />Vincular app
                                </CardTitle>
                                <CardDescription>
                                    Cria o registro do app e instala os webhooks na Shopify do cliente
                                    (pedidos, checkouts e fulfillments) em um clique.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 max-w-xl">
                                <div className="space-y-1.5">
                                    <Label htmlFor="app-name">Nome do app</Label>
                                    <Input id="app-name" value={appName} onChange={(e) => setAppName(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="bundle-id">Bundle ID</Label>
                                    <Input id="bundle-id" value={bundleId} onChange={(e) => setBundleId(e.target.value)} className="font-mono" />
                                    <p className="text-xs text-muted-foreground">
                                        Permanente após publicar nas lojas — nasce no formato com.nomedocliente.app
                                        pra transferência futura da conta.
                                    </p>
                                </div>
                                <Button onClick={vincular} disabled={linking || !shopifyConnected || !appName.trim()}>
                                    {linking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                                    Vincular app
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <Card className="shadow-none border-border/40">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Smartphone className="w-5 h-5 text-primary" />{app.app_name}
                                    </CardTitle>
                                    <CardDescription className="font-mono">{app.bundle_id}</CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground space-y-1">
                                    <p>Status: <span className="text-foreground">{STATUS_LABEL[app.status] ?? app.status}</span></p>
                                    <p>Config remoto: <span className="text-foreground">{configVersion ? `v${configVersion}` : 'não configurado'}</span></p>
                                    <p>Vinculado em: <span className="text-foreground">{new Date(app.created_at).toLocaleDateString('pt-BR')}</span></p>
                                </CardContent>
                            </Card>

                            <Card className="shadow-none border-border/40">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Radio className="w-5 h-5 text-primary" />Saúde da conexão
                                        </CardTitle>
                                        <CardDescription>
                                            {lastWebhookAt
                                                ? `Último webhook: ${new Date(lastWebhookAt).toLocaleString('pt-BR')}`
                                                : 'Nenhum webhook recebido ainda — chega no primeiro pedido/checkout da loja.'}
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={vincular} disabled={linking}>
                                        {linking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                        Re-sincronizar webhooks
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {subs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nenhum webhook registrado — use o botão acima.</p>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {subs.map((s) => (
                                                <div key={s.topic} className="flex items-center gap-2 text-sm rounded-md border border-border/40 px-3 py-2">
                                                    {s.enabled
                                                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                                                    <span className="font-mono text-xs">{s.topic}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {linkResults && (
                                        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                                            {linkResults.map((r) => (
                                                <p key={r.topic} className="font-mono">
                                                    {r.topic}: {r.status}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
