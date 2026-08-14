import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, TabletSmartphone, Users2, Wallet } from "lucide-react";

/**
 * Aba CRM do módulo Apps Mobile (E5).
 * Base de clientes DO APP: quem instalou, quem logou, quem comprou e quanto.
 * Alimentada pelos webhooks (app_customers) e pelo registro de devices —
 * zero input manual. Segmentos pra push são criados na aba Push.
 */

interface Props {
    clientId: string;
}

interface Cliente {
    id: string;
    shopify_customer_id: string;
    display_name: string | null;
    email: string | null;
    orders_app_count: number;
    total_spent_app: number;
    last_order_at: string | null;
}

interface DeviceResumo {
    shopify_customer_id: string | null;
    platform: string;
    push_enabled: boolean;
    last_seen_at: string;
}

function brl(n: number): string {
    return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tempoRelativo(iso: string | null): string {
    if (!iso) return "—";
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias < 1) return "hoje";
    if (dias === 1) return "ontem";
    return `${dias}d atrás`;
}

export function CrmTab({ clientId }: Props) {
    const { toast } = useToast();
    const [carregando, setCarregando] = useState(true);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [devices, setDevices] = useState<DeviceResumo[]>([]);
    const [busca, setBusca] = useState("");

    const carregar = useCallback(async () => {
        setCarregando(true);
        const [cRes, dRes] = await Promise.all([
            supabase.from("app_customers")
                .select("id, shopify_customer_id, display_name, email, orders_app_count, total_spent_app, last_order_at")
                .eq("client_id", clientId)
                .order("total_spent_app", { ascending: false })
                .limit(200),
            supabase.from("app_devices")
                .select("shopify_customer_id, platform, push_enabled, last_seen_at")
                .eq("client_id", clientId),
        ]);
        if (cRes.error) {
            toast({ title: "Erro ao carregar CRM", description: cRes.error.message, variant: "destructive" });
        }
        setClientes((cRes.data ?? []) as Cliente[]);
        setDevices((dRes.data ?? []) as DeviceResumo[]);
        setCarregando(false);
    }, [clientId, toast]);

    useEffect(() => { void carregar(); }, [carregar]);

    const devicesPorCustomer = useMemo(() => {
        const m = new Map<string, number>();
        for (const d of devices) {
            if (!d.shopify_customer_id) continue;
            m.set(d.shopify_customer_id, (m.get(d.shopify_customer_id) ?? 0) + 1);
        }
        return m;
    }, [devices]);

    const filtrados = useMemo(() => {
        const q = busca.trim().toLowerCase();
        if (!q) return clientes;
        return clientes.filter((c) =>
            (c.display_name ?? "").toLowerCase().includes(q) ||
            (c.email ?? "").toLowerCase().includes(q) ||
            c.shopify_customer_id.includes(q));
    }, [clientes, busca]);

    const kpis = useMemo(() => {
        const anonimos = devices.filter((d) => !d.shopify_customer_id).length;
        const receita = clientes.reduce((acc, c) => acc + Number(c.total_spent_app), 0);
        return { identificados: clientes.length, devicesAnonimos: anonimos, receita };
    }, [clientes, devices]);

    if (carregando) {
        return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <Card className="shadow-none border-border/40">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5"><Users2 className="w-4 h-4" />Clientes identificados</CardDescription>
                        <CardTitle className="text-3xl">{kpis.identificados}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="shadow-none border-border/40">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5"><TabletSmartphone className="w-4 h-4" />Devices sem login</CardDescription>
                        <CardTitle className="text-3xl">{kpis.devicesAnonimos}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="shadow-none border-border/40">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5"><Wallet className="w-4 h-4" />Receita da base</CardDescription>
                        <CardTitle className="text-3xl">{brl(kpis.receita)}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card className="shadow-none border-border/40">
                <CardHeader>
                    <CardTitle className="text-lg">Clientes do app</CardTitle>
                    <CardDescription>
                        Identificados no login da loja dentro do app — pedidos e gasto contam só o que veio pelo app.
                    </CardDescription>
                    <div className="relative max-w-sm mt-2">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Buscar por nome, email ou ID..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent>
                    {filtrados.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            {clientes.length === 0
                                ? "Nenhum cliente identificado ainda — eles aparecem quando logam na loja dentro do app."
                                : "Nada encontrado pra essa busca."}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Pedidos (app)</TableHead>
                                        <TableHead className="text-right">Gasto (app)</TableHead>
                                        <TableHead>Último pedido</TableHead>
                                        <TableHead className="text-right">Devices</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtrados.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{c.display_name || "Sem nome"}</span>
                                                    <span className="text-xs text-muted-foreground">{c.email ?? c.shopify_customer_id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">{c.orders_app_count}</TableCell>
                                            <TableCell className="text-right tabular-nums">{brl(Number(c.total_spent_app))}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{tempoRelativo(c.last_order_at)}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="outline">{devicesPorCustomer.get(c.shopify_customer_id) ?? 0}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
