// ════════════════════════════════════════════════════════════════════════════
// SystemLogs — Painel de observabilidade (admin-only, area Agency).
//
// Onde o time olha o que esta acontecendo em producao: erros de runtime, falhas
// silenciosas do vigia, com filtros e detalhe completo (context + stack).
// Le `system_logs` com o JWT do usuario — a RLS so libera admin.
//
// v1 read-only: "marcar como resolvido" entra depois via edge function
// (escrita em system_logs e exclusiva de service_role, por convencao do projeto).
// ════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Activity, AlertTriangle, RefreshCw, Search, ShieldAlert, Loader2, Bell } from "lucide-react";
import { AlertConfigDialog } from "@/components/system-logs/AlertConfigDialog";

type Severity = "info" | "warn" | "error" | "critical";
type Status = "success" | "failure" | "partial";

interface SystemLog {
    id: string;
    function_name: string;
    action: string;
    status: Status;
    severity: Severity;
    workspace_id: string | null;
    message: string;
    context: Record<string, unknown> | null;
    error: { name?: string; message?: string; stack?: string } | null;
    error_signature: string | null;
    request_id: string | null;
    environment: string;
    duration_ms: number | null;
    resolved: boolean;
    created_at: string;
}

const PERIODS = [
    { value: "24h", label: "Últimas 24h", hours: 24 },
    { value: "7d", label: "Últimos 7 dias", hours: 24 * 7 },
    { value: "30d", label: "Últimos 30 dias", hours: 24 * 30 },
] as const;

const REFRESH_MS = 20_000;
const ROW_LIMIT = 300;

function sinceIso(hours: number): string {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function severityBadge(sev: Severity) {
    switch (sev) {
        case "critical":
            return <Badge className="bg-red-600 hover:bg-red-600 text-white">crítico</Badge>;
        case "error":
            return <Badge variant="destructive">erro</Badge>;
        case "warn":
            return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">aviso</Badge>;
        default:
            return <Badge variant="secondary">info</Badge>;
    }
}

export default function SystemLogs() {
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [selected, setSelected] = useState<SystemLog | null>(null);

    // Filtros
    const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("24h");
    const [severity, setSeverity] = useState<"all" | Severity>("all");
    const [status, setStatus] = useState<"all" | Status>("all");
    const [onlyUnresolved, setOnlyUnresolved] = useState(false);
    const [search, setSearch] = useState("");

    // Cards de resumo
    const [stats, setStats] = useState({ errors24h: 0, silent24h: 0, unresolved: 0, total24h: 0 });

    const [resolving, setResolving] = useState(false);
    const [alertConfigOpen, setAlertConfigOpen] = useState(false);
    const { toast } = useToast();

    const hours = useMemo(
        () => PERIODS.find((p) => p.value === period)?.hours ?? 24,
        [period],
    );

    const fetchLogs = useCallback(async () => {
        setErrorMsg(null);
        const since = sinceIso(hours);

        let q = supabase
            .from("system_logs")
            .select("*")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(ROW_LIMIT);

        if (severity !== "all") q = q.eq("severity", severity);
        if (status !== "all") q = q.eq("status", status);
        if (onlyUnresolved) q = q.eq("resolved", false);
        const s = search.trim();
        if (s) q = q.or(`function_name.ilike.%${s}%,action.ilike.%${s}%,message.ilike.%${s}%`);

        const { data, error } = await q;
        if (error) {
            setErrorMsg(error.message);
            setLogs([]);
        } else {
            setLogs((data ?? []) as SystemLog[]);
        }
        setLoading(false);
    }, [hours, severity, status, onlyUnresolved, search]);

    const fetchStats = useCallback(async () => {
        const since = sinceIso(24);
        const countOf = (build: (q: any) => any) =>
            build(supabase.from("system_logs").select("*", { count: "exact", head: true }));

        const [errors, silent, unresolved, total] = await Promise.all([
            countOf((q) => q.gte("created_at", since).in("severity", ["error", "critical"])),
            countOf((q) => q.gte("created_at", since).like("action", "watchdog:%")),
            countOf((q) => q.eq("resolved", false).in("severity", ["error", "critical"])),
            countOf((q) => q.gte("created_at", since)),
        ]);

        setStats({
            errors24h: errors.count ?? 0,
            silent24h: silent.count ?? 0,
            unresolved: unresolved.count ?? 0,
            total24h: total.count ?? 0,
        });
    }, []);

    const handleResolve = useCallback(
        async (log: SystemLog, resolved: boolean) => {
            setResolving(true);
            const { data, error } = await supabase.functions.invoke("resolve-system-log", {
                body: { id: log.id, resolved },
            });
            setResolving(false);
            const apiError = error?.message ?? (data as { error?: string } | null)?.error;
            if (apiError) {
                toast({ title: "Erro ao atualizar", description: apiError, variant: "destructive" });
                return;
            }
            toast({ title: resolved ? "Marcado como resolvido" : "Reaberto" });
            setSelected((s) => (s && s.id === log.id ? { ...s, resolved } : s));
            fetchLogs();
            fetchStats();
        },
        [toast, fetchLogs, fetchStats],
    );

    useEffect(() => {
        setLoading(true);
        fetchLogs();
        fetchStats();
    }, [fetchLogs, fetchStats]);

    // Auto-refresh do painel (logs "ao vivo").
    useEffect(() => {
        const id = setInterval(() => {
            fetchLogs();
            fetchStats();
        }, REFRESH_MS);
        return () => clearInterval(id);
    }, [fetchLogs, fetchStats]);

    const successRate = stats.total24h > 0
        ? Math.round(((stats.total24h - stats.errors24h) / stats.total24h) * 100)
        : 100;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" strokeWidth={1.75} />
                        Monitoramento do sistema
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Erros de runtime em produção. Atualiza a cada 20s.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAlertConfigOpen(true)}>
                        <Bell className="h-4 w-4 mr-2" />
                        Configurar alertas
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchLogs();
                            fetchStats();
                        }}
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" /> Erros (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.errors24h}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-amber-500" /> Falhas silenciosas (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.silent24h}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Não resolvidos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.unresolved}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Taxa de sucesso (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{successRate}%</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar função, ação ou mensagem…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {PERIODS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Severidade" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Toda severidade</SelectItem>
                        <SelectItem value="critical">Crítico</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                        <SelectItem value="warn">Aviso</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todo status</SelectItem>
                        <SelectItem value="failure">Falha</SelectItem>
                        <SelectItem value="partial">Parcial</SelectItem>
                        <SelectItem value="success">Sucesso</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant={onlyUnresolved ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOnlyUnresolved((v) => !v)}
                >
                    Só não resolvidos
                </Button>
            </div>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando…
                        </div>
                    ) : errorMsg ? (
                        <div className="py-16 text-center text-sm text-destructive">
                            Erro ao carregar logs: {errorMsg}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            Nenhum log no período. Bom sinal — ou as funções ainda não foram instrumentadas.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[140px]">Quando</TableHead>
                                    <TableHead className="w-[110px]">Severidade</TableHead>
                                    <TableHead className="w-[180px]">Função</TableHead>
                                    <TableHead className="w-[160px]">Ação</TableHead>
                                    <TableHead>Mensagem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow
                                        key={log.id}
                                        className="cursor-pointer"
                                        onClick={() => setSelected(log)}
                                    >
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                                        </TableCell>
                                        <TableCell>{severityBadge(log.severity)}</TableCell>
                                        <TableCell className="font-medium text-sm">{log.function_name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{log.action}</TableCell>
                                        <TableCell className="text-sm max-w-[420px] truncate">{log.message}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Detalhe */}
            <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {severityBadge(selected.severity)}
                                    <span className="font-mono text-sm">{selected.function_name}</span>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground">Mensagem</div>
                                    <div className="font-medium">{selected.message}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><span className="text-muted-foreground">Ação:</span> {selected.action}</div>
                                    <div><span className="text-muted-foreground">Status:</span> {selected.status}</div>
                                    <div><span className="text-muted-foreground">Quando:</span> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                                    <div><span className="text-muted-foreground">Duração:</span> {selected.duration_ms != null ? `${selected.duration_ms} ms` : "—"}</div>
                                    <div className="truncate"><span className="text-muted-foreground">Workspace:</span> {selected.workspace_id ?? "—"}</div>
                                    <div className="truncate"><span className="text-muted-foreground">Request:</span> {selected.request_id ?? "—"}</div>
                                </div>
                                {selected.error && (
                                    <div>
                                        <div className="text-muted-foreground mb-1">Erro</div>
                                        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                                            {selected.error.name}: {selected.error.message}
                                            {selected.error.stack ? `\n\n${selected.error.stack}` : ""}
                                        </pre>
                                    </div>
                                )}
                                {selected.context && Object.keys(selected.context).length > 0 && (
                                    <div>
                                        <div className="text-muted-foreground mb-1">Contexto</div>
                                        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                                            {JSON.stringify(selected.context, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-3 border-t">
                                    <span className="text-xs text-muted-foreground">
                                        {selected.resolved ? "✓ Resolvido" : "Em aberto"}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant={selected.resolved ? "outline" : "default"}
                                        disabled={resolving}
                                        onClick={() => handleResolve(selected, !selected.resolved)}
                                    >
                                        {resolving
                                            ? "Salvando…"
                                            : selected.resolved
                                                ? "Reabrir"
                                                : "Marcar como resolvido"}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertConfigDialog open={alertConfigOpen} onOpenChange={setAlertConfigOpen} />
        </div>
    );
}
