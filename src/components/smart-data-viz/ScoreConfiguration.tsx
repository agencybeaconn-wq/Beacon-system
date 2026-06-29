import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, Calculator, Save, RotateCcw, Pencil, Check, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import { getCustomRules, saveCustomRules, resetCustomRules, PillarConfig } from '@/utils/scoringRules';

export function ScoreConfiguration() {
    const [activeTab, setActiveTab] = useState("trafego");
    const [pillars, setPillars] = useState<PillarConfig[]>(() => getCustomRules());
    const [editingCell, setEditingCell] = useState<string | null>(null); // "pillarIdx-metricIdx-ruleIdx" or "weight-pillarIdx"
    const [editValue, setEditValue] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const startEdit = useCallback((key: string, currentValue: number) => {
        setEditingCell(key);
        setEditValue(String(currentValue));
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingCell(null);
        setEditValue('');
    }, []);

    const confirmEdit = useCallback(() => {
        if (!editingCell) return;
        const num = parseFloat(editValue);
        if (isNaN(num) || num < 0) {
            toast.error('Valor inválido');
            return;
        }

        const updated = [...pillars.map(p => ({
            ...p,
            metrics: p.metrics.map(m => ({
                ...m,
                rules: m.rules.map(r => ({ ...r }))
            }))
        }))];

        if (editingCell.startsWith('weight-')) {
            const pi = parseInt(editingCell.split('-')[1]);
            updated[pi].weight = num;
        } else if (editingCell.startsWith('maxscore-')) {
            const [, pi, mi] = editingCell.split('-').map(Number);
            updated[pi].metrics[mi].maxScore = num;
        } else {
            const [pi, mi, ri] = editingCell.split('-').map(Number);
            updated[pi].metrics[mi].rules[ri].points = num;
        }

        setPillars(updated as PillarConfig[]);
        setEditingCell(null);
        setEditValue('');
        setHasChanges(true);
    }, [editingCell, editValue, pillars]);

    const handleSave = useCallback(() => {
        saveCustomRules(pillars);
        setHasChanges(false);
        toast.success('Pesos salvos! Os scores dos clientes serão recalculados na próxima atualização.', {
            duration: 4000,
        });
    }, [pillars]);

    const handleReset = useCallback(() => {
        resetCustomRules();
        setPillars(getCustomRules());
        setHasChanges(false);
        toast.success('Pesos restaurados para os valores padrão.');
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') confirmEdit();
        if (e.key === 'Escape') cancelEdit();
    }, [confirmEdit, cancelEdit]);

    // Calculate total weight for validation display
    const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Calculator className="h-7 w-7 text-primary" />
                        Configuração do Health Score
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Clique nos valores de pontos para editar. Alterações afetam a classificação dos clientes.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 border-border/60">
                        <RotateCcw className="h-4 w-4" /> Restaurar Padrão
                    </Button>
                    {hasChanges && (
                        <Button size="sm" onClick={handleSave} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Save className="h-4 w-4" /> Salvar Alterações
                        </Button>
                    )}
                </div>
            </div>

            {/* Explanation Card */}
            <Card className="bg-card/50 border-border/40">
                <CardContent className="p-5">
                    <div className="flex gap-3 items-start">
                        <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="space-y-3">
                            <div>
                                <h3 className="font-bold text-base text-foreground">Sistema de 4 Pilares</h3>
                                <p className="text-sm text-muted-foreground">
                                    O Score (0–{totalWeight}) é a soma da pontuação nos 4 pilares. Clique nos pesos para ajustar.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {pillars.map((p, pi) => (
                                    <div key={p.id}
                                        className="relative p-3 rounded-lg border border-border/60 bg-background/50 flex flex-col items-center text-center gap-2 transition-all hover:border-border">
                                        <p.icon className={`h-5 w-5 ${p.color}`} />
                                        <span className="font-semibold text-sm text-foreground">{p.name}</span>
                                        <div
                                            className="cursor-pointer group"
                                            onClick={() => startEdit(`weight-${pi}`, p.weight)}
                                        >
                                            {editingCell === `weight-${pi}` ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        autoFocus
                                                        className="w-14 h-7 text-center text-xs bg-background border border-primary rounded px-1 font-mono"
                                                    />
                                                    <button onClick={(e) => { e.stopPropagation(); confirmEdit(); }} className="p-0.5 hover:text-emerald-400">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="p-0.5 hover:text-red-400">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="font-mono text-xs cursor-pointer hover:bg-primary/20 hover:border-primary/50 transition-colors border border-transparent group-hover:border-primary/30"
                                                >
                                                    Max: {p.weight} pts
                                                    <Pencil className="h-2.5 w-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {totalWeight !== 100 && (
                                <p className="text-xs text-amber-400">
                                    ⚠️ Peso total: {totalWeight}/100 — o ideal é que a soma dos 4 pilares seja 100.
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="trafego" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto mb-4">
                    {pillars.map(pillar => (
                        <TabsTrigger
                            key={pillar.id}
                            value={pillar.id}
                            className="py-2.5"
                        >
                            <div className="flex items-center gap-2">
                                <pillar.icon className={`h-4 w-4 ${activeTab === pillar.id ? pillar.color : 'text-muted-foreground'}`} />
                                <span className={activeTab === pillar.id ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                                    {pillar.name}
                                </span>
                            </div>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {pillars.map((pillar, pi) => (
                    <TabsContent key={pillar.id} value={pillar.id} className="mt-5 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <pillar.icon className={`h-5 w-5 ${pillar.color}`} />
                                Regras de Pontuação — {pillar.name}
                            </h3>
                            <Badge variant="outline" className="text-sm px-3 py-1 border-border/60 font-mono">
                                Peso: {pillar.weight} pts
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {pillar.metrics.map((metric, mi) => (
                                <Card key={mi} className="border-border/40 bg-card/50 overflow-hidden">
                                    <CardHeader className="bg-muted/30 border-b border-border/30 py-3 px-4">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-sm font-semibold text-foreground">
                                                {metric.name}
                                            </CardTitle>
                                            <div
                                                className="cursor-pointer group"
                                                onClick={() => startEdit(`maxscore-${pi}-${mi}`, metric.maxScore)}
                                            >
                                                {editingCell === `maxscore-${pi}-${mi}` ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            autoFocus
                                                            className="w-12 h-6 text-center text-xs bg-background border border-primary rounded px-1 font-mono"
                                                        />
                                                        <button onClick={(e) => { e.stopPropagation(); confirmEdit(); }} className="p-0.5 hover:text-emerald-400"><Check className="h-3 w-3" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="p-0.5 hover:text-red-400"><X className="h-3 w-3" /></button>
                                                    </div>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono text-xs cursor-pointer hover:bg-primary/20 transition-colors border-border/60 group-hover:border-primary/30"
                                                    >
                                                        Max: {metric.maxScore} pts
                                                        <Pencil className="h-2.5 w-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <div className="p-0">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-border/20">
                                                    <th className="h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-4 text-left">Intervalo</th>
                                                    <th className="h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground pr-4 text-right">Pontos</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {metric.rules.map((rule, ri) => {
                                                    const cellKey = `${pi}-${mi}-${ri}`;
                                                    const isEditing = editingCell === cellKey;
                                                    return (
                                                        <tr key={ri} className="border-b border-border/10 last:border-0 hover:bg-muted/20 transition-colors">
                                                            <td className="pl-4 py-2.5 text-sm text-muted-foreground">
                                                                {rule.range}
                                                            </td>
                                                            <td className="pr-4 py-2.5 text-right">
                                                                {isEditing ? (
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={editValue}
                                                                            onChange={e => setEditValue(e.target.value)}
                                                                            onKeyDown={handleKeyDown}
                                                                            autoFocus
                                                                            className="w-14 h-7 text-center text-sm bg-background border border-primary rounded px-1 font-mono"
                                                                        />
                                                                        <button onClick={confirmEdit} className="p-0.5 hover:text-emerald-400">
                                                                            <Check className="h-3.5 w-3.5" />
                                                                        </button>
                                                                        <button onClick={cancelEdit} className="p-0.5 hover:text-red-400">
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => startEdit(cellKey, rule.points)}
                                                                        className={`inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-md cursor-pointer transition-all group
                                                                            ${rule.points >= 8 ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' :
                                                                                rule.points >= 5 ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' :
                                                                                    rule.points >= 2 ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' :
                                                                                        'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                                                                            } font-bold text-sm font-mono`}
                                                                    >
                                                                        {rule.points}
                                                                        <Pencil className="h-2.5 w-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
