import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BellRing, CalendarClock, Loader2, Plus, Send, Users2 } from "lucide-react";

/**
 * Aba Push do módulo Apps Mobile (E3.4).
 * Compositor (enviar agora / agendar), alvo por segmento e histórico com
 * status + enviados + taxa de abertura (recibos de push_sends).
 * O envio real é do edge push-dispatch; agendada quem processa é o pg_cron.
 */

interface Props {
    clientId: string;
    appId: string;
}

interface Segmento { id: string; name: string }

interface Campanha {
    id: string;
    payload: { title?: string; body?: string } | null;
    status: string;
    sent_count: number;
    scheduled_at: string | null;
    created_at: string;
    segment_id: string | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    agendada: { label: "Agendada", variant: "outline" },
    enviando: { label: "Enviando", variant: "outline" },
    enviada: { label: "Enviada", variant: "default" },
    erro: { label: "Erro", variant: "destructive" },
};

export function PushTab({ clientId, appId }: Props) {
    const { toast } = useToast();
    const [carregando, setCarregando] = useState(true);
    const [campanhas, setCampanhas] = useState<Campanha[]>([]);
    const [aberturas, setAberturas] = useState<Map<string, { total: number; abertos: number }>>(new Map());
    const [segmentos, setSegmentos] = useState<Segmento[]>([]);

    // compositor
    const [titulo, setTitulo] = useState("");
    const [corpo, setCorpo] = useState("");
    const [imagem, setImagem] = useState("");
    const [deepLink, setDeepLink] = useState("");
    const [segmentoAlvo, setSegmentoAlvo] = useState<string>("todos");
    const [agendarPara, setAgendarPara] = useState("");
    const [enviando, setEnviando] = useState(false);

    // segmento novo (inline)
    const [criandoSegmento, setCriandoSegmento] = useState(false);
    const [segNome, setSegNome] = useState("");
    const [segComprou, setSegComprou] = useState<string>("qualquer");
    const [segInativo, setSegInativo] = useState("");

    const carregar = useCallback(async () => {
        setCarregando(true);
        const [campRes, segRes, sendsRes] = await Promise.all([
            supabase.from("push_campaigns")
                .select("id, payload, status, sent_count, scheduled_at, created_at, segment_id")
                .eq("client_id", clientId)
                .order("created_at", { ascending: false })
                .limit(30),
            supabase.from("segments").select("id, name").eq("client_id", clientId).order("name"),
            supabase.from("push_sends")
                .select("campaign_id, status")
                .eq("client_id", clientId)
                .not("campaign_id", "is", null)
                .limit(5000),
        ]);
        if (campRes.error) {
            toast({ title: "Erro ao carregar campanhas", description: campRes.error.message, variant: "destructive" });
        }
        setCampanhas((campRes.data ?? []) as Campanha[]);
        setSegmentos((segRes.data ?? []) as Segmento[]);
        const mapa = new Map<string, { total: number; abertos: number }>();
        for (const s of sendsRes.data ?? []) {
            const key = s.campaign_id as string;
            const atual = mapa.get(key) ?? { total: 0, abertos: 0 };
            atual.total += 1;
            if (s.status === "aberto") atual.abertos += 1;
            mapa.set(key, atual);
        }
        setAberturas(mapa);
        setCarregando(false);
    }, [clientId, toast]);

    useEffect(() => { void carregar(); }, [carregar]);

    const payloadValido = useMemo(
        () => titulo.trim().length > 0 && corpo.trim().length > 0,
        [titulo, corpo],
    );

    // min do input de agendamento: agora (em horário local, formato datetime-local)
    const minAgendamento = useMemo(() => {
        const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 16);
    }, []);

    const limparForm = () => {
        setTitulo(""); setCorpo(""); setImagem(""); setDeepLink(""); setAgendarPara("");
    };

    const disparar = async () => {
        if (!payloadValido) return;
        const agendada = agendarPara !== "";

        // #15 bloqueia agendamento no passado (o tick dispararia no minuto seguinte)
        if (agendada && new Date(agendarPara).getTime() <= Date.now()) {
            toast({ title: "Data inválida", description: "Escolha um horário no futuro para agendar.", variant: "destructive" });
            return;
        }
        setEnviando(true);

        const payload = {
            title: titulo.trim(),
            body: corpo.trim(),
            image_url: imagem.trim() || null,
            deep_link: deepLink.trim() || null,
        };

        const { data: criada, error } = await supabase.from("push_campaigns").insert({
            client_id: clientId,
            app_id: appId,
            payload,
            segment_id: segmentoAlvo === "todos" ? null : segmentoAlvo,
            status: agendada ? "agendada" : "rascunho",
            scheduled_at: agendada ? new Date(agendarPara).toISOString() : null,
        }).select("id").single();

        if (error || !criada) {
            setEnviando(false);
            // #12 form preservado — o lojista não reescreve tudo
            toast({ title: "Erro ao criar campanha", description: error?.message, variant: "destructive" });
            return;
        }

        if (agendada) {
            setEnviando(false);
            toast({ title: "Campanha agendada", description: "O envio sai automaticamente no horário." });
            limparForm();
            void carregar();
            return;
        }

        const { data, error: envioErro } = await supabase.functions.invoke("push-dispatch", {
            body: { campaign_id: criada.id },
        });
        setEnviando(false);

        if (envioErro || data?.erro) {
            toast({ title: "Falha no envio", description: data?.erro ?? envioErro?.message, variant: "destructive" });
            return; // #12 mantém o form
        }

        const enviados = Number(data?.enviados ?? 0);
        const falhas = Number(data?.falhas ?? 0);
        const bloqueados = Number(data?.bloqueados_por_teto ?? 0);

        // #13 toast honesto: 0 enviados NÃO é sucesso
        if (enviados === 0) {
            const motivo = data?.motivo_alvo === "segmento_invalido" ? "o segmento é inválido"
                : data?.motivo_alvo === "segmento_ausente" ? "o segmento não existe mais"
                : bloqueados > 0 ? "todos os aparelhos bateram o limite diário"
                : "nenhum aparelho elegível (ninguém instalou o app ainda ou o segmento não casou)";
            toast({
                title: "Nada foi enviado",
                description: `Motivo: ${motivo}. A campanha ficou registrada.`,
                variant: "destructive",
            });
            void carregar();
            return; // #12 mantém o form pra ajustar e reenviar
        }

        toast({
            title: `Push enviado para ${enviados} aparelho(s)`,
            description: [
                falhas > 0 ? `${falhas} falha(s)` : null,
                bloqueados > 0 ? `${bloqueados} fora por limite diário` : null,
            ].filter(Boolean).join(" · ") || "Entrega concluída.",
        });
        limparForm();
        void carregar();
    };

    const criarSegmento = async () => {
        if (!segNome.trim()) return;
        const definition = {
            platform: null,
            comprou: segComprou === "qualquer" ? null : segComprou,
            inativo_dias: segInativo ? Number(segInativo) : null,
            instalou_ha_dias: null,
            gasto_minimo: null,
        };
        const { error } = await supabase.from("segments").insert({
            client_id: clientId, name: segNome.trim(), definition,
        });
        if (error) {
            toast({ title: "Erro ao criar segmento", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Segmento criado" });
        setCriandoSegmento(false); setSegNome(""); setSegComprou("qualquer"); setSegInativo("");
        void carregar();
    };

    if (carregando) {
        return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-none border-border/40">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellRing className="w-5 h-5 text-primary" />Nova campanha
                    </CardTitle>
                    <CardDescription>
                        Push ilimitado, custo zero. O teto anti-spam por device é respeitado automaticamente.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-w-2xl">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="push-titulo">Título</Label>
                            <Input id="push-titulo" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Chegou manto novo 🔥" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="push-link">Deep link (rota da loja, opcional)</Label>
                            <Input id="push-link" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="/collections/lancamentos" className="font-mono" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="push-corpo">Mensagem</Label>
                        <Textarea id="push-corpo" maxLength={240} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="A coleção 26/27 acabou de cair no app." rows={2} />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="push-img">Imagem (URL, opcional)</Label>
                            <Input id="push-img" value={imagem} onChange={(e) => setImagem(e.target.value)} placeholder="https://..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Alvo</Label>
                            <Select value={segmentoAlvo} onValueChange={setSegmentoAlvo}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os devices</SelectItem>
                                    {segmentos.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="push-agendar">Agendar (vazio = enviar agora)</Label>
                            <Input id="push-agendar" type="datetime-local" min={minAgendamento} value={agendarPara} onChange={(e) => setAgendarPara(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={disparar} disabled={!payloadValido || enviando}>
                            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                : agendarPara ? <CalendarClock className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            {agendarPara ? "Agendar" : "Enviar agora"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setCriandoSegmento((v) => !v)}>
                            <Plus className="w-4 h-4 mr-1.5" />Novo segmento
                        </Button>
                    </div>

                    {criandoSegmento && (
                        <div className="rounded-lg border border-border/40 p-4 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-1.5"><Users2 className="w-4 h-4" />Segmento novo</p>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <Input placeholder="Nome (ex.: Compradores)" value={segNome} onChange={(e) => setSegNome(e.target.value)} />
                                <Select value={segComprou} onValueChange={setSegComprou}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="qualquer">Comprou ou não</SelectItem>
                                        <SelectItem value="sim">Já comprou no app</SelectItem>
                                        <SelectItem value="nao">Nunca comprou</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input type="number" min={1} placeholder="Inativo há X dias (opcional)" value={segInativo} onChange={(e) => setSegInativo(e.target.value)} />
                            </div>
                            <Button size="sm" onClick={criarSegmento} disabled={!segNome.trim()}>Salvar segmento</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-none border-border/40">
                <CardHeader>
                    <CardTitle className="text-lg">Histórico</CardTitle>
                    <CardDescription>Últimas 30 campanhas — abertura vem dos recibos de push tocado.</CardDescription>
                </CardHeader>
                <CardContent>
                    {campanhas.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma campanha ainda — a primeira está no formulário acima.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Campanha</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Alvo</TableHead>
                                        <TableHead className="text-right">Enviados</TableHead>
                                        <TableHead className="text-right">Abertura</TableHead>
                                        <TableHead>Quando</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {campanhas.map((c) => {
                                        const badge = STATUS_BADGE[c.status] ?? { label: c.status, variant: "secondary" as const };
                                        const ab = aberturas.get(c.id);
                                        const taxa = ab && ab.total > 0 ? Math.round((ab.abertos / ab.total) * 100) : null;
                                        const seg = segmentos.find((s) => s.id === c.segment_id);
                                        return (
                                            <TableRow key={c.id}>
                                                <TableCell>
                                                    <div className="flex flex-col max-w-[280px]">
                                                        <span className="font-medium truncate">{c.payload?.title ?? "—"}</span>
                                                        <span className="text-xs text-muted-foreground truncate">{c.payload?.body ?? ""}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                                                <TableCell className="text-sm">{seg?.name ?? "Todos"}</TableCell>
                                                <TableCell className="text-right tabular-nums">{c.sent_count}</TableCell>
                                                <TableCell className="text-right tabular-nums">{taxa === null ? "—" : `${taxa}%`}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(c.scheduled_at ?? c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
        </div>
    );
}
