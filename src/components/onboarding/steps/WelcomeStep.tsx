import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ArrowRight, Sparkles } from 'lucide-react';

interface WelcomeStepProps {
    businessName: string;
    segment: string;
    onUpdate: (data: { businessName?: string; segment?: string }) => void;
    onNext: () => void;
}

const SEGMENTS = [
    { value: 'ecommerce', label: '🛒 E-commerce' },
    { value: 'infoproducts', label: '📚 Infoprodutos' },
    { value: 'saas', label: '💻 SaaS' },
    { value: 'services', label: '🔧 Serviços' },
    { value: 'local', label: '📍 Negócio Local' },
    { value: 'agency', label: '🏢 Agência' },
    { value: 'other', label: '✨ Outro' },
];

export const WelcomeStep: React.FC<WelcomeStepProps> = ({
    businessName,
    segment,
    onUpdate,
    onNext,
}) => {
    const canProceed = businessName.trim().length > 0 && segment.length > 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white mb-4">
                    <Sparkles className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao LADS!</h1>
                <p className="text-muted-foreground text-lg">
                    Vamos configurar sua conta para otimizar seus anúncios com IA.
                </p>
            </div>

            {/* Form */}
            <div className="space-y-6 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="space-y-2">
                    <Label htmlFor="businessName" className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        Nome do Negócio
                    </Label>
                    <Input
                        id="businessName"
                        placeholder="Ex: Loja do João"
                        value={businessName}
                        onChange={(e) => onUpdate({ businessName: e.target.value })}
                        className="h-12 text-lg"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="segment">Segmento</Label>
                    <Select value={segment} onValueChange={(v) => onUpdate({ segment: v })}>
                        <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder="Selecione seu segmento" />
                        </SelectTrigger>
                        <SelectContent>
                            {SEGMENTS.map((seg) => (
                                <SelectItem key={seg.value} value={seg.value} className="text-base">
                                    {seg.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Action */}
            <Button
                onClick={onNext}
                disabled={!canProceed}
                className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
                Continuar
                <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
        </div>
    );
};
