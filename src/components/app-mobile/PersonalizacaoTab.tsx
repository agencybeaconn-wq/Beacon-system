import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Palette, Save, Smartphone } from "lucide-react";

/**
 * Aba Personalização (E8.1) — o "sem rebuild" na prática: cores, logo e
 * splash do app editados aqui gravam no config remoto (store_apps.config)
 * com bump de versão; o app aplica na PRÓXIMA abertura, sem nova versão
 * nas lojas. Nome do app e ícone NÃO estão aqui de propósito: esses vivem
 * no binário e exigem build + revisão das lojas.
 */

interface Props {
    clientId: string;
    appId: string;
}

interface ConfigEditavel {
    version: number;
    accent: string;
    background: string;
    foreground: string;
    logo_url: string;
    splash_background: string;
    splash_logo_url: string;
    splash_duration_ms: number;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function CampoCor({ id, label, valor, onChange }: {
    id: string; label: string; valor: string; onChange: (v: string) => void;
}) {
    const valido = HEX.test(valor);
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label={`Seletor de cor: ${label}`}
                    value={valido ? valor : "#000000"}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded-md border border-border/60 bg-transparent p-1"
                />
                <Input id={id} value={valor} onChange={(e) => onChange(e.target.value)} className="font-mono w-28" maxLength={7} />
            </div>
            {!valido && <p className="text-xs text-destructive">Use o formato #RRGGBB.</p>}
        </div>
    );
}

export function PersonalizacaoTab({ clientId, appId }: Props) {
    const { toast } = useToast();
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [configCompleto, setConfigCompleto] = useState<Record<string, unknown> | null>(null);
    const [form, setForm] = useState<ConfigEditavel | null>(null);

    const carregar = useCallback(async () => {
        setCarregando(true);
        const { data, error } = await supabase
            .from("store_apps").select("config").eq("id", appId).maybeSingle();
        if (error || !data) {
            toast({ title: "Erro ao carregar personalização", description: error?.message, variant: "destructive" });
            setCarregando(false);
            return;
        }
        const cfg = (data.config ?? {}) as any;
        setConfigCompleto(cfg);
        setForm({
            version: Number(cfg.version ?? 1),
            accent: cfg.theme?.accent ?? "#18181b",
            background: cfg.theme?.background ?? "#fafafa",
            foreground: cfg.theme?.foreground ?? "#18181b",
            logo_url: cfg.theme?.logo_url ?? "",
            splash_background: cfg.splash?.background ?? "#fafafa",
            splash_logo_url: cfg.splash?.logo_url ?? "",
            splash_duration_ms: Number(cfg.splash?.duration_ms ?? 1200),
        });
        setCarregando(false);
    }, [appId, toast]);

    useEffect(() => { void carregar(); }, [carregar]);

    const valido = useMemo(() => !!form
        && HEX.test(form.accent) && HEX.test(form.background)
        && HEX.test(form.foreground) && HEX.test(form.splash_background)
        && form.splash_duration_ms >= 0 && form.splash_duration_ms <= 4000,
    [form]);

    const salvar = async () => {
        if (!form || !configCompleto || !valido) return;
        setSalvando(true);
        const novoConfig = {
            ...configCompleto,
            version: form.version + 1,
            theme: {
                accent: form.accent,
                background: form.background,
                foreground: form.foreground,
                logo_url: form.logo_url.trim() || null,
            },
            splash: {
                background: form.splash_background,
                logo_url: form.splash_logo_url.trim() || null,
                duration_ms: form.splash_duration_ms,
            },
        };
        const { error } = await supabase
            .from("store_apps").update({ config: novoConfig }).eq("id", appId);
        setSalvando(false);
        if (error) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            return;
        }
        toast({
            title: `Publicado — config v${form.version + 1}`,
            description: "O app aplica na próxima abertura, sem atualização nas lojas.",
        });
        void carregar();
    };

    if (carregando || !form) {
        return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
    }

    const set = (patch: Partial<ConfigEditavel>) => setForm((f) => (f ? { ...f, ...patch } : f));

    return (
        <div className="grid lg:grid-cols-[1fr_260px] gap-6 items-start">
            <div className="space-y-6">
                <Card className="shadow-none border-border/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="w-5 h-5 text-primary" />Tema do app
                        </CardTitle>
                        <CardDescription>
                            Vale na próxima abertura do app — sem build, sem revisão de loja. Config atual: v{form.version}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <CampoCor id="cor-acento" label="Cor de acento" valor={form.accent} onChange={(v) => set({ accent: v })} />
                            <CampoCor id="cor-fundo" label="Fundo" valor={form.background} onChange={(v) => set({ background: v })} />
                            <CampoCor id="cor-texto" label="Texto" valor={form.foreground} onChange={(v) => set({ foreground: v })} />
                        </div>
                        <div className="space-y-1.5 max-w-xl">
                            <Label htmlFor="logo-tema">Logo (URL pública, PNG com fundo transparente)</Label>
                            <Input id="logo-tema" value={form.logo_url} onChange={(e) => set({ logo_url: e.target.value })} placeholder="https://sualoja.com/cdn/.../logo.png" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-none border-border/40">
                    <CardHeader>
                        <CardTitle className="text-lg">Splash de abertura</CardTitle>
                        <CardDescription>A tela com a marca que aparece enquanto o app carrega.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <CampoCor id="splash-fundo" label="Fundo da splash" valor={form.splash_background} onChange={(v) => set({ splash_background: v })} />
                            <div className="space-y-1.5">
                                <Label htmlFor="splash-duracao">Duração (ms, máx. 4000)</Label>
                                <Input id="splash-duracao" type="number" min={0} max={4000} step={100} value={form.splash_duration_ms}
                                    onChange={(e) => set({ splash_duration_ms: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div className="space-y-1.5 max-w-xl">
                            <Label htmlFor="splash-logo">Logo da splash (URL pública)</Label>
                            <Input id="splash-logo" value={form.splash_logo_url} onChange={(e) => set({ splash_logo_url: e.target.value })} placeholder="https://..." />
                        </div>
                    </CardContent>
                </Card>

                <Button onClick={salvar} disabled={!valido || salvando}>
                    {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Publicar personalização
                </Button>
            </div>

            <Card className="shadow-none border-border/40 sticky top-6">
                <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4" />Prévia
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mx-auto w-[180px] rounded-[22px] border-4 border-zinc-800 overflow-hidden" style={{ background: form.background }}>
                        <div className="h-8 flex items-center justify-center" style={{ background: form.splash_background }}>
                            {form.splash_logo_url
                                ? <img src={form.splash_logo_url} alt="Logo da splash" className="max-h-5 max-w-[120px] object-contain" />
                                : <span className="text-[9px] text-muted-foreground">splash</span>}
                        </div>
                        <div className="px-3 py-4 space-y-2" style={{ color: form.foreground }}>
                            {form.logo_url
                                ? <img src={form.logo_url} alt="Logo do app" className="max-h-6 max-w-[130px] object-contain" />
                                : <div className="text-[11px] font-bold">Sua marca</div>}
                            <div className="h-2 rounded" style={{ background: form.foreground, opacity: 0.12 }} />
                            <div className="h-2 w-3/4 rounded" style={{ background: form.foreground, opacity: 0.12 }} />
                            <div className="h-7 rounded-md flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: form.accent }}>
                                Comprar
                            </div>
                        </div>
                        <div className="border-t border-black/10 flex justify-around py-1.5" style={{ background: form.background }}>
                            {["●", "●", "●", "●", "●"].map((dot, i) => (
                                <span key={i} className="text-[8px]" style={{ color: i === 0 ? form.accent : "#a1a1aa" }}>{dot}</span>
                            ))}
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 text-center">
                        Representação aproximada — o app real usa esses valores nas tabs, botões e splash.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
