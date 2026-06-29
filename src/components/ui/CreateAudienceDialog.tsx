import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Globe, Users, Sparkles, ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAdPixels } from "@/hooks/useAdPixels";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { CustomAudienceSearch } from "@/components/ui/CustomAudienceSearch";

interface CreateAudienceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (audience: { id: string; name: string }) => void;
}

type AudienceType = 'website' | 'lookalike' | null;
type Step = 'type' | 'config' | 'confirm';

const PIXEL_EVENTS = [
    { value: 'PageView', label: 'Visualização de Página' },
    { value: 'Purchase', label: 'Compra' },
    { value: 'AddToCart', label: 'Adicionar ao Carrinho' },
    { value: 'InitiateCheckout', label: 'Iniciar Checkout' },
    { value: 'Lead', label: 'Lead' },
    { value: 'CompleteRegistration', label: 'Registro Completo' },
    { value: 'ViewContent', label: 'Visualizar Conteúdo' },
    { value: 'Search', label: 'Pesquisa' },
    { value: 'AddPaymentInfo', label: 'Adicionar Info de Pagamento' },
];

export function CreateAudienceDialog({ open, onOpenChange, onCreated }: CreateAudienceDialogProps) {
    const { selectedAccountId } = useDashboard();
    const { pixels, isLoading: pixelsLoading } = useAdPixels(selectedAccountId);
    const { toast } = useToast();

    // Wizard state
    const [step, setStep] = useState<Step>('type');
    const [audienceType, setAudienceType] = useState<AudienceType>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Website audience config
    const [websiteName, setWebsiteName] = useState('');
    const [selectedPixelId, setSelectedPixelId] = useState('');
    const [selectedEvent, setSelectedEvent] = useState('PageView');
    const [retentionDays, setRetentionDays] = useState(30);
    const [urlContains, setUrlContains] = useState('');

    // Lookalike config
    const [lookalikeName, setLookalikeName] = useState('');
    const [originAudience, setOriginAudience] = useState<{ id: string; name?: string } | null>(null);
    const [lookalikeRatio, setLookalikeRatio] = useState(1); // 1-10%
    const [lookalikeCountry, setLookalikeCountry] = useState('BR'); // Default to Brazil
    const [numberOfAudiences, setNumberOfAudiences] = useState(1); // 1-6

    const resetForm = () => {
        setStep('type');
        setAudienceType(null);
        setWebsiteName('');
        setSelectedPixelId('');
        setSelectedEvent('PageView');
        setRetentionDays(30);
        setUrlContains('');
        setLookalikeName('');
        setOriginAudience(null);
        setLookalikeRatio(1);
        setLookalikeCountry('BR');
        setNumberOfAudiences(1);
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    const handleCreate = async () => {
        if (!selectedAccountId) return;

        setIsCreating(true);
        try {
            // Get access token
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', selectedAccountId)
                .single();

            if (!accountData?.access_token) {
                throw new Error('Token de acesso não encontrado');
            }

            let result;

            if (audienceType === 'website') {
                const { data, error } = await supabase.functions.invoke('manage-custom-audiences', {
                    body: {
                        action: 'CREATE_WEBSITE',
                        accountId: selectedAccountId,
                        accessToken: accountData.access_token,
                        name: websiteName,
                        pixelId: selectedPixelId,
                        retentionDays,
                        eventType: selectedEvent,
                        urlContains: urlContains || undefined
                    }
                });

                if (error || data?.error) throw new Error(error?.message || data?.error);
                result = data.audience;
            } else if (audienceType === 'lookalike') {
                // Auto-generate name if not provided
                const audienceName = lookalikeName || `Semelhante (${lookalikeCountry}, ${lookalikeRatio}%) - ${originAudience?.name}`;

                const { data, error } = await supabase.functions.invoke('manage-custom-audiences', {
                    body: {
                        action: 'CREATE_LOOKALIKE',
                        accountId: selectedAccountId,
                        accessToken: accountData.access_token,
                        name: audienceName,
                        originAudienceId: originAudience?.id,
                        ratio: lookalikeRatio / 100, // Convert to 0.01-0.10
                        country: lookalikeCountry // Country code for lookalike
                    }
                });

                if (error || data?.error) throw new Error(error?.message || data?.error);
                result = data.audience;
            }

            toast({
                title: "Público criado!",
                description: `O público "${result.name}" foi criado com sucesso.`,
            });

            onCreated?.(result);
            handleClose();

        } catch (error: any) {
            console.error('❌ Error creating audience:', error);
            toast({
                title: "Erro ao criar público",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    const canProceedToConfig = audienceType !== null;
    const canProceedToConfirm = audienceType === 'website'
        ? websiteName && selectedPixelId
        : lookalikeName && originAudience;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Criar novo público
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'type' && 'Selecione o tipo de público que deseja criar'}
                        {step === 'config' && audienceType === 'website' && 'Configure o público de site'}
                        {step === 'config' && audienceType === 'lookalike' && 'Configure o público semelhante'}
                        {step === 'confirm' && 'Confirme as configurações'}
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicators */}
                <div className="flex items-center justify-center gap-2 py-2">
                    {['type', 'config', 'confirm'].map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                step === s ? "bg-primary text-primary-foreground" :
                                    ['type', 'config', 'confirm'].indexOf(step) > i ? "bg-green-500 text-white" :
                                        "bg-muted text-muted-foreground"
                            )}>
                                {['type', 'config', 'confirm'].indexOf(step) > i ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            {i < 2 && <div className="w-8 h-0.5 bg-muted" />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Type Selection */}
                {step === 'type' && (
                    <div className="space-y-3 py-4">
                        <button
                            className={cn(
                                "w-full p-4 rounded-lg border-2 text-left transition-all",
                                audienceType === 'website'
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                            )}
                            onClick={() => setAudienceType('website')}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                    <Globe className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium">Público de Site</p>
                                    <p className="text-xs text-muted-foreground">
                                        Pessoas que visitaram seu site (baseado no Pixel)
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            className={cn(
                                "w-full p-4 rounded-lg border-2 text-left transition-all",
                                audienceType === 'lookalike'
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                            )}
                            onClick={() => setAudienceType('lookalike')}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="font-medium">Público Semelhante (Lookalike)</p>
                                    <p className="text-xs text-muted-foreground">
                                        Pessoas parecidas com seu público existente
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Step 2: Configuration */}
                {step === 'config' && audienceType === 'website' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome do público *</Label>
                            <Input
                                value={websiteName}
                                onChange={(e) => setWebsiteName(e.target.value)}
                                placeholder="Ex: Visitantes do site - 30 dias"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Pixel *</Label>
                            <Select value={selectedPixelId} onValueChange={setSelectedPixelId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={pixelsLoading ? "Carregando..." : "Selecione um pixel"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {pixels.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Evento</Label>
                            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PIXEL_EVENTS.map(e => (
                                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Retenção: {retentionDays} dias</Label>
                            <Slider
                                value={[retentionDays]}
                                onValueChange={(v) => setRetentionDays(v[0])}
                                min={1}
                                max={180}
                                step={1}
                                className="py-2"
                            />
                            <p className="text-xs text-muted-foreground">
                                Pessoas que realizaram a ação nos últimos {retentionDays} dias
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>URL contém (opcional)</Label>
                            <Input
                                value={urlContains}
                                onChange={(e) => setUrlContains(e.target.value)}
                                placeholder="Ex: /checkout, /produto"
                            />
                            <p className="text-xs text-muted-foreground">
                                Filtrar por páginas específicas
                            </p>
                        </div>
                    </div>
                )}

                {step === 'config' && audienceType === 'lookalike' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Selecione sua fonte semelhante *</Label>
                            <CustomAudienceSearch
                                selectedAudiences={originAudience ? [originAudience] : []}
                                onAudiencesChange={(audiences) => setOriginAudience(audiences[0] || null)}
                                placeholder="Selecione uma fonte de dados ou um público existente"
                            />
                            <p className="text-xs text-muted-foreground">
                                O público que servirá de base para encontrar pessoas semelhantes
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Selecione a localização do público *</Label>
                            <Select value={lookalikeCountry} onValueChange={setLookalikeCountry}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BR">Brasil</SelectItem>
                                    <SelectItem value="US">Estados Unidos</SelectItem>
                                    <SelectItem value="PT">Portugal</SelectItem>
                                    <SelectItem value="MX">México</SelectItem>
                                    <SelectItem value="AR">Argentina</SelectItem>
                                    <SelectItem value="CO">Colômbia</SelectItem>
                                    <SelectItem value="CL">Chile</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Selecione o tamanho do público</Label>
                            <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Número de públicos</p>
                                    <Select value={String(numberOfAudiences)} onValueChange={(v) => setNumberOfAudiences(parseInt(v))}>
                                        <SelectTrigger className="w-20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5, 6].map(n => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Slider
                                    value={[lookalikeRatio]}
                                    onValueChange={(v) => setLookalikeRatio(v[0])}
                                    min={1}
                                    max={10}
                                    step={1}
                                    className="py-2"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <span key={n}>{n}%</span>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2 mt-2">
                                <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <p className="text-xs text-muted-foreground">
                                    O {lookalikeRatio}% semelhante consiste nas pessoas mais semelhantes à sua fonte de público semelhante. Aumentar a porcentagem cria um público maior e mais amplo.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Nome do público (opcional)</Label>
                            <Input
                                value={lookalikeName}
                                onChange={(e) => setLookalikeName(e.target.value)}
                                placeholder={`Semelhante (${lookalikeCountry}, ${lookalikeRatio}%) - ${originAudience?.name || 'Origem'}`}
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Confirmation */}
                {step === 'confirm' && (
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                            <h4 className="font-medium">Resumo do público</h4>

                            {audienceType === 'website' && (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Tipo:</span>
                                        <span>Público de Site</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Nome:</span>
                                        <span>{websiteName}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Pixel:</span>
                                        <span>{pixels.find(p => p.id === selectedPixelId)?.name}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Evento:</span>
                                        <span>{PIXEL_EVENTS.find(e => e.value === selectedEvent)?.label}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Retenção:</span>
                                        <span>{retentionDays} dias</span>
                                    </div>
                                    {urlContains && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">URL contém:</span>
                                            <span>{urlContains}</span>
                                        </div>
                                    )}
                                </>
                            )}

                            {audienceType === 'lookalike' && (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Tipo:</span>
                                        <span>Público Semelhante</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Origem:</span>
                                        <span>{originAudience?.name}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Localização:</span>
                                        <span>{lookalikeCountry === 'BR' ? 'Brasil' : lookalikeCountry}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Tamanho:</span>
                                        <span>{lookalikeRatio}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Nº de públicos:</span>
                                        <span>{numberOfAudiences}</span>
                                    </div>
                                    {lookalikeName && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Nome:</span>
                                            <span>{lookalikeName}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            O público levará de 1 a 6 horas para ser preenchido
                        </p>
                    </div>
                )}

                {/* Footer buttons */}
                <div className="flex justify-between pt-4 border-t">
                    {step !== 'type' ? (
                        <Button variant="ghost" onClick={() => setStep(step === 'confirm' ? 'config' : 'type')}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    )}

                    {step === 'type' && (
                        <Button onClick={() => setStep('config')} disabled={!canProceedToConfig}>
                            Avançar <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}

                    {step === 'config' && (
                        <Button onClick={() => setStep('confirm')} disabled={!canProceedToConfirm}>
                            Avançar <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}

                    {step === 'confirm' && (
                        <Button onClick={handleCreate} disabled={isCreating}>
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" /> Criar Público
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
