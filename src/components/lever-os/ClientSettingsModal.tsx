import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings, DollarSign, Percent, Loader2 } from "lucide-react";
import { Client } from "@/types/lever-os";

// Constantes para evitar erros de digitação
export const CALCULATION_BASE = {
    REVENUE: 'revenue',
    SPEND: 'spend'
} as const;

export type CalculationBase = typeof CALCULATION_BASE[keyof typeof CALCULATION_BASE];

export interface ClientFinancials {
    fixedFee: number;
    variableFeePercentage: number;
    calculationBase: CalculationBase;
    currency: string;
}

interface ClientSettingsModalProps {
    client: Client;
    onSave: (financials: ClientFinancials) => Promise<void>;
    trigger?: React.ReactNode;
}

export function ClientSettingsModal({ client, onSave, trigger }: ClientSettingsModalProps) {
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state - inicializa com valores do cliente
    const [fixedFee, setFixedFee] = useState(client.financials.fixedFee.toString());
    const [variableFee, setVariableFee] = useState(client.financials.variableFeePercentage.toString());
    const [calculationBase, setCalculationBase] = useState<CalculationBase>(
        (client.financials as any).calculationBase || CALCULATION_BASE.REVENUE
    );

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await onSave({
                fixedFee: parseFloat(fixedFee) || 0,
                variableFeePercentage: parseFloat(variableFee) || 0,
                calculationBase,
                currency: client.financials.currency
            });
            setOpen(false);
        } catch (error) {
            console.error("Erro ao salvar:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Formatação do input de moeda
    const handleFeeChange = (value: string) => {
        // Remove tudo exceto números e vírgula/ponto
        const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
        setFixedFee(cleaned);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="text-xs text-muted-foreground">
                        <Settings className="w-3.5 h-3.5 mr-2" />
                        Configurações
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-none flex items-center justify-center text-sm font-bold text-primary-foreground bg-primary">
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <span>Configurações Financeiras</span>
                            <p className="text-sm font-normal text-muted-foreground">{client.name}</p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Fee Fixo Mensal */}
                    <div className="space-y-2">
                        <Label htmlFor="fixedFee" className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            Valor Fixo Mensal
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                                R$
                            </span>
                            <Input
                                id="fixedFee"
                                type="text"
                                inputMode="decimal"
                                placeholder="2.500,00"
                                value={fixedFee}
                                onChange={(e) => handleFeeChange(e.target.value)}
                                className="pl-10 text-lg font-semibold"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Valor cobrado mensalmente independente do resultado.
                        </p>
                    </div>

                    {/* Comissão */}
                    <div className="space-y-2">
                        <Label htmlFor="variableFee" className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-primary" />
                            Comissão Variável
                        </Label>
                        <div className="relative">
                            <Input
                                id="variableFee"
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                placeholder="10"
                                value={variableFee}
                                onChange={(e) => setVariableFee(e.target.value)}
                                className="pr-10 text-lg font-semibold"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                                %
                            </span>
                        </div>
                    </div>

                    {/* Base de Cálculo */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                            Base de Cálculo da Comissão
                        </Label>
                        <RadioGroup
                            value={calculationBase}
                            onValueChange={(val) => setCalculationBase(val as CalculationBase)}
                            className="grid grid-cols-2 gap-3"
                        >
                            <Label
                                htmlFor="revenue"
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${calculationBase === CALCULATION_BASE.REVENUE
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <RadioGroupItem value={CALCULATION_BASE.REVENUE} id="revenue" className="sr-only" />
                                <span className="text-2xl">📈</span>
                                <span className="font-medium text-sm">Faturamento</span>
                                <span className="text-[10px] text-muted-foreground text-center">
                                    % sobre o revenue gerado
                                </span>
                            </Label>
                            <Label
                                htmlFor="spend"
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${calculationBase === CALCULATION_BASE.SPEND
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <RadioGroupItem value={CALCULATION_BASE.SPEND} id="spend" className="sr-only" />
                                <span className="text-2xl">💰</span>
                                <span className="font-medium text-sm">Investimento</span>
                                <span className="text-[10px] text-muted-foreground text-center">
                                    % sobre o ad spend
                                </span>
                            </Label>
                        </RadioGroup>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            "Salvar Configurações"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
