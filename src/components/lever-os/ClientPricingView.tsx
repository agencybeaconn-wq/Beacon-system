import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Plus, Trash2, DollarSign, Tag, Info, ShirtIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingRow {
    id?: string;
    section: string;
    key: string;
    label: string;
    value: string;
    sort_order: number;
}

const DEFAULT_PRODUCTS: Omit<PricingRow, 'id'>[] = [
    { section: 'products', key: 'camisa_torcedor', label: 'Camisa Torcedor', value: '', sort_order: 0 },
    { section: 'products', key: 'camisa_jogador', label: 'Camisa Jogador', value: '', sort_order: 1 },
    { section: 'products', key: 'camisa_retro', label: 'Camisa Retrô', value: '', sort_order: 2 },
    { section: 'products', key: 'conjunto_infantil', label: 'Conjuntos Infantil', value: '', sort_order: 3 },
    { section: 'products', key: 'agasalho_viagem', label: 'Agasalho de Viagem', value: '', sort_order: 4 },
    { section: 'products', key: 'conjunto_treino', label: 'Conjunto de Treino', value: '', sort_order: 5 },
    { section: 'products', key: 'jaqueta', label: 'Jaqueta', value: '', sort_order: 6 },
    { section: 'products', key: 'moletom', label: 'Moletom', value: '', sort_order: 7 },
    { section: 'products', key: 'short', label: 'Short', value: '', sort_order: 8 },
];

const DEFAULT_EXTRAS: Omit<PricingRow, 'id'>[] = [
    { section: 'extras', key: 'patch', label: 'Patch', value: '', sort_order: 0 },
    { section: 'extras', key: 'patrocinio', label: 'Patrocínio Extra', value: '', sort_order: 1 },
    { section: 'extras', key: 'tamanho_2gg', label: 'Acréscimo 2GG', value: '', sort_order: 2 },
    { section: 'extras', key: 'tamanho_3gg', label: 'Acréscimo 3GG', value: '', sort_order: 3 },
    { section: 'extras', key: 'tamanho_4gg', label: 'Acréscimo 4GG', value: '', sort_order: 4 },
    { section: 'extras', key: 'personalizacao', label: 'Personalização (Nome e Número)', value: '', sort_order: 5 },
    { section: 'extras', key: 'manga_longa', label: 'Manga Longa', value: '', sort_order: 6 },
];

const DEFAULT_INFO: Omit<PricingRow, 'id'>[] = [
    { section: 'info', key: 'frete_gratis', label: 'Frete Grátis', value: 'false', sort_order: 0 },
    { section: 'info', key: 'parcelamento', label: 'Parcelamento sem juros', value: 'false', sort_order: 1 },
    { section: 'info', key: 'parcelas_max', label: 'Máximo de parcelas', value: '', sort_order: 2 },
    { section: 'info', key: 'moeda', label: 'Moeda', value: 'BRL', sort_order: 3 },
];

const CURRENCIES = [
    { code: 'BRL', symbol: 'R$', label: 'Real (BRL)' },
    { code: 'USD', symbol: '$', label: 'Dólar (USD)' },
    { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
    { code: 'GBP', symbol: '£', label: 'Libra (GBP)' },
    { code: 'ARS', symbol: 'AR$', label: 'Peso Argentino (ARS)' },
];

interface ClientPricingViewProps {
    clientId: string;
}

export function ClientPricingView({ clientId }: ClientPricingViewProps) {
    const [rows, setRows] = useState<PricingRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [customProducts, setCustomProducts] = useState<{ key: string; label: string; value: string }[]>([]);
    const [customExtras, setCustomExtras] = useState<{ key: string; label: string; value: string }[]>([]);
    const [newProductLabel, setNewProductLabel] = useState('');
    const [newExtraLabel, setNewExtraLabel] = useState('');

    const loadPricing = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('client_pricing')
                .select('*')
                .eq('client_id', clientId)
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setRows(data);
                // Extract custom rows (not in defaults)
                const defaultProductKeys = new Set(DEFAULT_PRODUCTS.map(p => p.key));
                const defaultExtraKeys = new Set(DEFAULT_EXTRAS.map(e => e.key));
                setCustomProducts(
                    data.filter((r: PricingRow) => r.section === 'products' && !defaultProductKeys.has(r.key))
                        .map((r: PricingRow) => ({ key: r.key, label: r.label, value: r.value }))
                );
                setCustomExtras(
                    data.filter((r: PricingRow) => r.section === 'extras' && !defaultExtraKeys.has(r.key))
                        .map((r: PricingRow) => ({ key: r.key, label: r.label, value: r.value }))
                );
            } else {
                // Initialize with defaults
                setRows([...DEFAULT_PRODUCTS, ...DEFAULT_EXTRAS, ...DEFAULT_INFO].map(r => ({ ...r, id: undefined })));
            }
        } catch (err: any) {
            console.error('Error loading pricing:', err);
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => { loadPricing(); }, [loadPricing]);

    const updateValue = (section: string, key: string, value: string) => {
        setRows(prev => {
            const existing = prev.find(r => r.section === section && r.key === key);
            if (existing) {
                return prev.map(r => r.section === section && r.key === key ? { ...r, value } : r);
            }
            return prev;
        });
        setHasChanges(true);
    };

    const getVal = (section: string, key: string) => {
        return rows.find(r => r.section === section && r.key === key)?.value || '';
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Build all rows to upsert
            const allRows = [
                ...DEFAULT_PRODUCTS.map(d => ({
                    client_id: clientId,
                    section: d.section,
                    key: d.key,
                    label: d.label,
                    value: getVal(d.section, d.key),
                    sort_order: d.sort_order,
                })),
                ...customProducts.map((cp, i) => ({
                    client_id: clientId,
                    section: 'products',
                    key: cp.key,
                    label: cp.label,
                    value: cp.value,
                    sort_order: DEFAULT_PRODUCTS.length + i,
                })),
                ...DEFAULT_EXTRAS.map(d => ({
                    client_id: clientId,
                    section: d.section,
                    key: d.key,
                    label: d.label,
                    value: getVal(d.section, d.key),
                    sort_order: d.sort_order,
                })),
                ...customExtras.map((ce, i) => ({
                    client_id: clientId,
                    section: 'extras',
                    key: ce.key,
                    label: ce.label,
                    value: ce.value,
                    sort_order: DEFAULT_EXTRAS.length + i,
                })),
                ...DEFAULT_INFO.map(d => ({
                    client_id: clientId,
                    section: d.section,
                    key: d.key,
                    label: d.label,
                    value: getVal(d.section, d.key),
                    sort_order: d.sort_order,
                })),
            ];

            const { error } = await (supabase as any)
                .from('client_pricing')
                .upsert(allRows, { onConflict: 'client_id,section,key' });

            if (error) throw error;

            toast.success('Preços salvos com sucesso!');
            setHasChanges(false);
            loadPricing();
        } catch (err: any) {
            toast.error('Erro ao salvar preços');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const addCustomProduct = () => {
        if (!newProductLabel.trim()) return;
        const key = `custom_${newProductLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
        setCustomProducts(prev => [...prev, { key, label: newProductLabel.trim(), value: '' }]);
        setRows(prev => [...prev, { section: 'products', key, label: newProductLabel.trim(), value: '', sort_order: DEFAULT_PRODUCTS.length + customProducts.length }]);
        setNewProductLabel('');
        setHasChanges(true);
    };

    const addCustomExtra = () => {
        if (!newExtraLabel.trim()) return;
        const key = `custom_${newExtraLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
        setCustomExtras(prev => [...prev, { key, label: newExtraLabel.trim(), value: '' }]);
        setRows(prev => [...prev, { section: 'extras', key, label: newExtraLabel.trim(), value: '', sort_order: DEFAULT_EXTRAS.length + customExtras.length }]);
        setNewExtraLabel('');
        setHasChanges(true);
    };

    const removeCustomRow = async (section: string, key: string) => {
        if (section === 'products') {
            setCustomProducts(prev => prev.filter(p => p.key !== key));
        } else {
            setCustomExtras(prev => prev.filter(e => e.key !== key));
        }
        setRows(prev => prev.filter(r => !(r.section === section && r.key === key)));
        // Delete from DB if exists
        await (supabase as any).from('client_pricing').delete().eq('client_id', clientId).eq('section', section).eq('key', key);
        setHasChanges(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const currencyCode = getVal('info', 'moeda') || 'BRL';
    const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || 'R$';

    const renderPriceInput = (section: string, key: string, label: string, isCustom?: boolean) => (
        <div key={key} className="flex items-center gap-3 group">
            <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium text-foreground/80">{label}</Label>
            </div>
            <div className="flex items-center gap-0 w-[180px] shrink-0 border border-border rounded-lg overflow-hidden bg-background">
                <span className="px-3 text-sm font-bold text-foreground/60 bg-muted/30 h-10 flex items-center shrink-0 border-r border-border">{currencySymbol}</span>
                <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={getVal(section, key)}
                    onChange={(e) => updateValue(section, key, e.target.value)}
                    className="h-10 text-sm font-medium border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
            </div>
            {isCustom && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => removeCustomRow(section, key)}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            )}
        </div>
    );

    return (
        <div className="w-full space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">Tabela de Preços</h2>
                    <p className="text-sm text-muted-foreground">Valores base e acréscimos dos produtos do cliente</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Currency selector */}
                    <select
                        value={currencyCode}
                        onChange={(e) => updateValue('info', 'moeda', e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium appearance-none cursor-pointer pr-8"
                    >
                        {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>
                        ))}
                    </select>
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Preços Base dos Produtos */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <ShirtIcon className="w-4 h-4 text-primary" />
                            Preços Base dos Produtos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {DEFAULT_PRODUCTS.map(p => renderPriceInput(p.section, p.key, p.label))}
                        {customProducts.map(cp => renderPriceInput('products', cp.key, cp.label, true))}

                        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                            <Input
                                placeholder="Nome do produto..."
                                value={newProductLabel}
                                onChange={(e) => setNewProductLabel(e.target.value)}
                                className="h-8 text-sm flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && addCustomProduct()}
                            />
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addCustomProduct} disabled={!newProductLabel.trim()}>
                                <Plus className="w-3 h-3" /> Adicionar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Valores Extras / Acréscimos */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            Valores Extras / Acréscimos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {DEFAULT_EXTRAS.map(e => renderPriceInput(e.section, e.key, e.label))}
                        {customExtras.map(ce => renderPriceInput('extras', ce.key, ce.label, true))}

                        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                            <Input
                                placeholder="Nome do acréscimo..."
                                value={newExtraLabel}
                                onChange={(e) => setNewExtraLabel(e.target.value)}
                                className="h-8 text-sm flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && addCustomExtra()}
                            />
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addCustomExtra} disabled={!newExtraLabel.trim()}>
                                <Plus className="w-3 h-3" /> Adicionar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Informações Gerais — full width */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Info className="w-4 h-4 text-primary" />
                        Informações Gerais
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/30">
                            <Label className="text-sm font-medium">Frete Grátis</Label>
                            <Switch
                                checked={getVal('info', 'frete_gratis') === 'true'}
                                onCheckedChange={(checked) => updateValue('info', 'frete_gratis', checked ? 'true' : 'false')}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/30">
                            <Label className="text-sm font-medium">Parcelamento sem juros</Label>
                            <Switch
                                checked={getVal('info', 'parcelamento') === 'true'}
                                onCheckedChange={(checked) => updateValue('info', 'parcelamento', checked ? 'true' : 'false')}
                            />
                        </div>
                        {getVal('info', 'parcelamento') === 'true' && (
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/30">
                                <Label className="text-sm font-medium">Máximo de parcelas</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Ex: 3"
                                    value={getVal('info', 'parcelas_max')}
                                    onChange={(e) => updateValue('info', 'parcelas_max', e.target.value)}
                                    className="h-9 w-20 text-sm font-medium rounded-lg text-center"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
