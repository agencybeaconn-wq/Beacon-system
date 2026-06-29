import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Target, TrendingUp, AlertTriangle } from 'lucide-react';

const MARKET_DEFAULTS = {
    ROAS: { target: 6.0, risk: 3.0 },
    CPA: { target: 25.00, risk: 50.00 },
    CPL: { target: 8.00, risk: 20.00 },
};

interface GoalsStepProps {
    primaryKpi?: 'ROAS' | 'CPA' | 'CPL';
    targetValue?: number;
    riskThreshold?: number;
    onUpdate: (data: { primaryKpi?: 'ROAS' | 'CPA' | 'CPL'; targetValue?: number; riskThreshold?: number }) => void;
    onNext: () => void;
    onBack: () => void;
}

export const GoalsStep: React.FC<GoalsStepProps> = ({
    primaryKpi = 'ROAS',
    targetValue,
    riskThreshold,
    onUpdate,
    onNext,
    onBack,
}) => {
    const handleKpiChange = (kpi: 'ROAS' | 'CPA' | 'CPL') => {
        const defaults = MARKET_DEFAULTS[kpi];
        onUpdate({
            primaryKpi: kpi,
            targetValue: defaults.target,
            riskThreshold: defaults.risk,
        });
    };

    const canProceed = !!primaryKpi && !!targetValue && !!riskThreshold;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white mb-4">
                    <Target className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Definir Metas</h1>
                <p className="text-muted-foreground text-lg">
                    Configure os objetivos de performance para a IA otimizar.
                </p>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                {/* KPI Selection */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        KPI Principal
                    </Label>
                    <Select value={primaryKpi} onValueChange={(v: any) => handleKpiChange(v)}>
                        <SelectTrigger className="h-12">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ROAS">📈 ROAS (Retorno sobre Gasto)</SelectItem>
                            <SelectItem value="CPA">💰 CPA (Custo por Aquisição)</SelectItem>
                            <SelectItem value="CPL">📋 CPL (Custo por Lead)</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {primaryKpi === 'ROAS' ? 'Ideal para e-commerce e vendas diretas' : 'Ideal para geração de leads ou serviços'}
                    </p>
                </div>

                {/* Target Value */}
                <div className="space-y-2">
                    <Label>Meta Ideal</Label>
                    <div className="relative">
                        {primaryKpi !== 'ROAS' && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        )}
                        <Input
                            type="number"
                            step="0.1"
                            value={targetValue || ''}
                            onChange={(e) => onUpdate({ targetValue: parseFloat(e.target.value) })}
                            className={`h-12 ${primaryKpi !== 'ROAS' ? 'pl-9' : 'pr-8'}`}
                            placeholder={MARKET_DEFAULTS[primaryKpi].target.toString()}
                        />
                        {primaryKpi === 'ROAS' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">x</span>
                        )}
                    </div>
                </div>

                {/* Risk Threshold */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                        Limite de Alerta
                    </Label>
                    <div className="relative">
                        {primaryKpi !== 'ROAS' && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        )}
                        <Input
                            type="number"
                            step="0.1"
                            value={riskThreshold || ''}
                            onChange={(e) => onUpdate({ riskThreshold: parseFloat(e.target.value) })}
                            className={`h-12 border-amber-200 focus:border-amber-500 ${primaryKpi !== 'ROAS' ? 'pl-9' : 'pr-8'}`}
                            placeholder={MARKET_DEFAULTS[primaryKpi].risk.toString()}
                        />
                        {primaryKpi === 'ROAS' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">x</span>
                        )}
                    </div>
                    <p className="text-xs text-amber-600/80">
                        ⚠️ Você receberá alertas se o {primaryKpi} {primaryKpi === 'ROAS' ? 'cair abaixo' : 'ultrapassar'} deste valor.
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <Button variant="outline" onClick={onBack} className="flex-1 h-12">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!canProceed}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                    Finalizar
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};
