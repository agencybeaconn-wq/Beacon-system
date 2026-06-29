import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, Store, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle,
    FolderOpen, FileText, Palette, ShirtIcon, Package, Sparkles, Rocket,
    ChevronRight, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/contexts/DashboardContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as deployService from '@/services/storeDeploymentService';

type Step = 'config' | 'preview' | 'execute';
type DeployStepName = 'theme' | 'collections' | 'pages' | 'menus' | 'products';

const DEPLOY_STEPS: { key: DeployStepName; label: string; icon: any }[] = [
    { key: 'theme', label: 'Tema', icon: Palette },
    { key: 'collections', label: 'Coleções', icon: FolderOpen },
    { key: 'pages', label: 'Páginas', icon: FileText },
    { key: 'menus', label: 'Menus', icon: Store },
    { key: 'products', label: 'Produtos', icon: Package },
];

export function StoreDeployment() {
    const { selectedClientId, clientData, selectedClientName, clients, workspaceId } = useDashboard();
    const isTargetConnected = (clientData as any)?.shopify_status === 'connected';
    const targetShopName = (clientData as any)?.shopify_shop_name || '';

    const [currentStep, setCurrentStep] = useState<Step>('config');

    // Config state
    const [sourceClientId, setSourceClientId] = useState('');
    const [briefings, setBriefings] = useState<any[]>([]);
    const [selectedBriefingId, setSelectedBriefingId] = useState('');
    const [sourceBrandName, setSourceBrandName] = useState('');
    const [steps, setSteps] = useState<Record<string, boolean>>({
        products: true, collections: true, pages: true, menus: true, theme: true,
    });
    const [aiConfig, setAiConfig] = useState({ personalizePages: true, adaptDescriptions: false });

    // Extract/Transform state
    const [extractedData, setExtractedData] = useState<any>(null);
    const [transformedData, setTransformedData] = useState<any>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);

    // Deploy state
    const [deploymentId, setDeploymentId] = useState<string | null>(null);
    const [deployStatus, setDeployStatus] = useState<Record<string, { status: string; created: number; errors: string[] }>>({});
    const [currentDeployStep, setCurrentDeployStep] = useState<DeployStepName | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    // Connected source stores
    const connectedStores = (clients || []).filter((c: any) => c.shopify_status === 'connected' && c.id !== selectedClientId);

    // Load briefings for target client
    useEffect(() => {
        if (!selectedClientId) return;
        (async () => {
            const { data } = await (supabase as any)
                .from('briefings')
                .select('id, client_name, created_at, status')
                .eq('client_group_id', selectedClientId)
                .order('created_at', { ascending: false });
            setBriefings(data || []);
        })();
    }, [selectedClientId]);

    // Check if target has pricing
    const [hasPricing, setHasPricing] = useState(false);
    useEffect(() => {
        if (!selectedClientId) return;
        (async () => {
            const { data } = await (supabase as any)
                .from('client_pricing')
                .select('id')
                .eq('client_id', selectedClientId)
                .limit(1);
            setHasPricing((data || []).length > 0);
        })();
    }, [selectedClientId]);

    // ─── Extract & Transform ─────────────────────────────────────────────

    const handleExtractAndTransform = async () => {
        if (!sourceClientId) { toast.error('Selecione a loja template'); return; }

        setIsExtracting(true);
        try {
            toast.info('Extraindo dados da loja template...');
            const extracted = await deployService.extractTemplate(sourceClientId);
            setExtractedData(extracted);
            toast.success(`Extraído: ${extracted.products?.length || 0} produtos, ${extracted.collections?.length || 0} coleções, ${extracted.pages?.length || 0} páginas`);

            setIsExtracting(false);
            setIsTransforming(true);
            toast.info('Transformando dados com preços e IA...');

            const transformed = await deployService.transformData({
                extractedData: extracted,
                targetClientId: selectedClientId!,
                briefingId: selectedBriefingId || undefined,
                aiConfig,
                sourceBrandName: sourceBrandName || undefined,
            });
            setTransformedData(transformed);
            toast.success('Transformação concluída!');
            setCurrentStep('preview');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsExtracting(false);
            setIsTransforming(false);
        }
    };

    // ─── Deploy ──────────────────────────────────────────────────────────

    const handleDeploy = async () => {
        if (!transformedData || !selectedClientId) return;

        setIsDeploying(true);
        setCurrentStep('execute');

        try {
            // Create deployment record
            const deployment = await deployService.createDeploymentRecord({
                workspaceId: workspaceId || '',
                sourceClientId,
                targetClientId: selectedClientId,
                briefingId: selectedBriefingId || undefined,
                steps,
                aiConfig,
                sourceBrandName,
                targetBrandName: selectedClientName || '',
            });
            setDeploymentId(deployment.id);

            await deployService.updateDeploymentStatus(deployment.id, { status: 'deploying', started_at: new Date().toISOString() });

            // Deploy each step sequentially
            const stepOrder: DeployStepName[] = ['theme', 'collections', 'pages', 'menus', 'products'];

            for (const step of stepOrder) {
                if (!steps[step]) continue;

                setCurrentDeployStep(step);
                setDeployStatus(prev => ({ ...prev, [step]: { status: 'in_progress', created: 0, errors: [] } }));

                try {
                    const result = await deployService.deployStep({
                        deploymentId: deployment.id,
                        targetClientId: selectedClientId,
                        step,
                        data: {
                            [step]: transformedData[step],
                            themeSettings: step === 'theme' ? transformedData.themeSettings : undefined,
                        },
                    });

                    setDeployStatus(prev => ({
                        ...prev,
                        [step]: {
                            status: (result.errors?.length || 0) > 0 ? 'partial' : 'completed',
                            created: result.created || 0,
                            errors: result.errors || [],
                        }
                    }));
                } catch (err: any) {
                    setDeployStatus(prev => ({
                        ...prev,
                        [step]: { status: 'failed', created: 0, errors: [err.message] }
                    }));
                }
            }

            await deployService.updateDeploymentStatus(deployment.id, { status: 'completed', completed_at: new Date().toISOString() });
            setCurrentDeployStep(null);
            toast.success('Implementação concluída!');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsDeploying(false);
        }
    };

    // ─── Guards ──────────────────────────────────────────────────────────

    if (!selectedClientId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
                <Rocket className="w-12 h-12 text-muted-foreground/30" />
                <h2 className="text-xl font-bold">Selecione um Cliente</h2>
                <p className="text-muted-foreground">Selecione o cliente destino no dropdown.</p>
            </div>
        );
    }

    if (!isTargetConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
                <Store className="w-12 h-12 text-muted-foreground/30" />
                <h2 className="text-xl font-bold">Shopify não conectada</h2>
                <p className="text-muted-foreground">Conecte a Shopify de <strong>{selectedClientName}</strong> nas Conexões.</p>
            </div>
        );
    }

    // ─── Render ──────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Implementação de Loja</h1>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Destino:</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-0 font-bold">{targetShopName || selectedClientName}</Badge>
                </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3">
                {(['config', 'preview', 'execute'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                            currentStep === s ? "bg-primary text-white" :
                            (['config', 'preview', 'execute'].indexOf(currentStep) > i) ? "bg-primary/20 text-primary" :
                            "bg-muted text-muted-foreground"
                        )}>
                            {i + 1}
                        </div>
                        <span className={cn("text-sm font-medium", currentStep === s ? "text-foreground" : "text-muted-foreground")}>
                            {s === 'config' ? 'Configurar' : s === 'preview' ? 'Preview' : 'Implementar'}
                        </span>
                        {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
                    </div>
                ))}
            </div>

            {/* ─── Step 1: Config ──────────────────────────────────────── */}
            {currentStep === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6 bg-muted/5 border-border/20 space-y-5">
                        <h3 className="font-bold text-base flex items-center gap-2"><Store className="w-4 h-4 text-primary" /> Loja Template (Origem)</h3>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Selecionar loja</Label>
                            <select
                                value={sourceClientId}
                                onChange={e => setSourceClientId(e.target.value)}
                                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                            >
                                <option value="">Selecione...</option>
                                {connectedStores.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.shopify_shop_name || c.name} ({c.shopify_domain})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Nome da marca template (para substituição)</Label>
                            <Input placeholder="Ex: Beacon Store" value={sourceBrandName} onChange={e => setSourceBrandName(e.target.value)} />
                            <p className="text-[10px] text-muted-foreground">Será substituído pelo nome da marca do cliente em todos os textos</p>
                        </div>
                    </Card>

                    <Card className="p-6 bg-muted/5 border-border/20 space-y-5">
                        <h3 className="font-bold text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Dados do Cliente</h3>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Briefing</Label>
                            <select
                                value={selectedBriefingId}
                                onChange={e => setSelectedBriefingId(e.target.value)}
                                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                            >
                                <option value="">Sem briefing</option>
                                {briefings.map((b: any) => (
                                    <option key={b.id} value={b.id}>
                                        {b.client_name} — {new Date(b.created_at).toLocaleDateString('pt-BR')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <Label className="text-sm">Tabela de preços</Label>
                            {hasPricing ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Configurada</Badge>
                            ) : (
                                <Badge className="bg-amber-500/10 text-amber-600 border-0 text-xs"><AlertCircle className="w-3 h-3 mr-1" /> Não configurada</Badge>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6 bg-muted/5 border-border/20 space-y-4">
                        <h3 className="font-bold text-base flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> O que implementar</h3>
                        {DEPLOY_STEPS.map(({ key, label, icon: Icon }) => (
                            <div key={key} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-muted-foreground" />
                                    <Label className="text-sm font-medium">{label}</Label>
                                </div>
                                <Switch checked={steps[key]} onCheckedChange={v => setSteps(p => ({ ...p, [key]: v }))} />
                            </div>
                        ))}
                    </Card>

                    <Card className="p-6 bg-muted/5 border-border/20 space-y-4">
                        <h3 className="font-bold text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Opções de IA</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">Personalizar páginas com IA</Label>
                                <p className="text-[10px] text-muted-foreground">Reescreve "Sobre Nós", FAQ, etc. para a nova marca</p>
                            </div>
                            <Switch checked={aiConfig.personalizePages} onCheckedChange={v => setAiConfig(p => ({ ...p, personalizePages: v }))} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">Adaptar descrições de produtos</Label>
                                <p className="text-[10px] text-muted-foreground">Usa IA para adaptar cada descrição (mais lento)</p>
                            </div>
                            <Switch checked={aiConfig.adaptDescriptions} onCheckedChange={v => setAiConfig(p => ({ ...p, adaptDescriptions: v }))} />
                        </div>
                    </Card>

                    <div className="lg:col-span-2">
                        <Button
                            onClick={handleExtractAndTransform}
                            disabled={!sourceClientId || isExtracting || isTransforming}
                            className="w-full h-12 text-base font-bold gap-2"
                        >
                            {isExtracting ? <><Loader2 className="w-5 h-5 animate-spin" /> Extraindo da loja template...</> :
                             isTransforming ? <><Loader2 className="w-5 h-5 animate-spin" /> Transformando com IA e preços...</> :
                             <><ArrowRight className="w-5 h-5" /> Extrair e Preparar Preview</>}
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── Step 2: Preview ─────────────────────────────────────── */}
            {currentStep === 'preview' && transformedData && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {DEPLOY_STEPS.map(({ key, label, icon: Icon }) => (
                            <Card key={key} className={cn("p-4 text-center", steps[key] ? "bg-muted/5 border-border/20" : "opacity-40")}>
                                <Icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                                <p className="text-2xl font-black">{transformedData.stats?.[key] || transformedData[key]?.length || 0}</p>
                                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                            </Card>
                        ))}
                    </div>

                    <Tabs defaultValue="products">
                        <TabsList>
                            <TabsTrigger value="products">Produtos ({transformedData.products?.length || 0})</TabsTrigger>
                            <TabsTrigger value="collections">Coleções ({transformedData.collections?.length || 0})</TabsTrigger>
                            <TabsTrigger value="pages">Páginas ({transformedData.pages?.length || 0})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="products">
                            <div className="max-h-[400px] overflow-y-auto space-y-1 mt-2">
                                {(transformedData.products || []).slice(0, 50).map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/10 text-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {p.images?.[0]?.src && <img src={p.images[0].src} alt={p.title || 'Produto'} className="w-8 h-8 rounded object-cover" />}
                                            <span className="font-medium truncate">{p.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-muted-foreground">{p.variants?.length || 0} var.</span>
                                            <span className="text-sm font-bold text-primary">
                                                {p.variants?.[0]?.price ? `R$ ${p.variants[0].price}` : '—'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="collections">
                            <div className="max-h-[400px] overflow-y-auto space-y-1 mt-2">
                                {(transformedData.collections || []).map((c: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/10 text-sm">
                                        <span className="font-medium">{c.title}</span>
                                        <Badge variant="outline" className="text-[9px]">{c._type === 'smart' ? 'Automática' : 'Manual'}</Badge>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="pages">
                            <div className="max-h-[400px] overflow-y-auto space-y-1 mt-2">
                                {(transformedData.pages || []).map((p: any, i: number) => (
                                    <div key={i} className="py-2 px-3 rounded hover:bg-muted/10">
                                        <span className="text-sm font-medium">{p.title}</span>
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{(p.body || '').replace(/<[^>]*>/g, '').slice(0, 120)}</p>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setCurrentStep('config')} className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Voltar
                        </Button>
                        <Button onClick={handleDeploy} className="flex-1 h-12 text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700">
                            <Rocket className="w-5 h-5" /> Implementar na Loja
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── Step 3: Execute ─────────────────────────────────────── */}
            {currentStep === 'execute' && (
                <div className="space-y-4">
                    {DEPLOY_STEPS.filter(s => steps[s.key]).map(({ key, label, icon: Icon }) => {
                        const status = deployStatus[key];
                        const isCurrent = currentDeployStep === key;
                        return (
                            <Card key={key} className={cn(
                                "p-5 border-border/20 transition-all",
                                isCurrent ? "bg-primary/5 border-primary/30" :
                                status?.status === 'completed' ? "bg-emerald-500/5 border-emerald-500/20" :
                                status?.status === 'failed' ? "bg-destructive/5 border-destructive/20" :
                                "bg-muted/5"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {isCurrent ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> :
                                         status?.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                                         status?.status === 'failed' || status?.status === 'partial' ? <XCircle className="w-5 h-5 text-destructive" /> :
                                         <Icon className="w-5 h-5 text-muted-foreground" />}
                                        <div>
                                            <p className="font-bold text-sm">{label}</p>
                                            {status && (
                                                <p className="text-xs text-muted-foreground">
                                                    {status.status === 'in_progress' ? 'Implementando...' :
                                                     status.status === 'completed' ? `${status.created} criados` :
                                                     status.status === 'failed' ? 'Falhou' :
                                                     status.status === 'partial' ? `${status.created} criados, ${status.errors.length} erros` :
                                                     'Aguardando'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {status?.status === 'completed' && (
                                        <Badge className="bg-emerald-500/10 text-emerald-600 border-0">{status.created}</Badge>
                                    )}
                                </div>
                                {status?.errors && status.errors.length > 0 && (
                                    <div className="mt-3 space-y-1 max-h-[100px] overflow-y-auto">
                                        {status.errors.map((err, i) => (
                                            <p key={i} className="text-xs text-destructive/80 pl-8">• {err}</p>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        );
                    })}

                    {!isDeploying && (
                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={() => { setCurrentStep('config'); setDeployStatus({}); }}>
                                Nova Implementação
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
