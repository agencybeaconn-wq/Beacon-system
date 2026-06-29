import React from 'react';
import { Button } from '@/components/ui/button';
import { PartyPopper, ArrowRight, CheckCircle2, Activity, Facebook, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';

interface CompletionStepProps {
    accountName: string;
    config: {
        pixelId?: string;
        pageId?: string;
        primaryKpi?: string;
        targetValue?: number;
    };
    hasMoreAccounts: boolean;
    onNextAccount: () => void;
    onFinish: () => void;
}

export const CompletionStep: React.FC<CompletionStepProps> = ({
    accountName,
    config,
    hasMoreAccounts,
    onNextAccount,
    onFinish,
}) => {
    const navigate = useNavigate();

    React.useEffect(() => {
        // Trigger confetti!
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10B981', '#14B8A6', '#06B6D4'],
        });
    }, []);

    const handleFinish = () => {
        onFinish();
        navigate('/');
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white mb-4 animate-bounce">
                    <PartyPopper className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Conta Configurada! 🎉</h1>
                <p className="text-muted-foreground text-lg">
                    A conta <span className="font-semibold text-foreground">{accountName}</span> está pronta para ser otimizada.
                </p>
            </div>

            {/* Summary Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-semibold mb-4 text-center">Resumo da Configuração</h3>
                <div className="space-y-3">
                    {config.pixelId && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                            <Activity className="w-5 h-5 text-blue-500" />
                            <span className="text-sm">Pixel configurado</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                        </div>
                    )}
                    {config.pageId && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-50 dark:bg-pink-950/30">
                            <Facebook className="w-5 h-5 text-[#1877F2]" />
                            <span className="text-sm">Página conectada</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                        </div>
                    )}
                    {config.primaryKpi && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                            <Target className="w-5 h-5 text-amber-500" />
                            <span className="text-sm">
                                Meta: {config.primaryKpi} {config.targetValue && `→ ${config.targetValue}`}
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {hasMoreAccounts ? (
                <div className="space-y-4">
                    <Button
                        onClick={onNextAccount}
                        className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    >
                        Configurar Próxima Conta
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handleFinish}
                        className="w-full text-muted-foreground"
                    >
                        Pular e ir pro Dashboard
                    </Button>
                </div>
            ) : (
                <Button
                    onClick={handleFinish}
                    className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                    Ir para o Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
            )}
        </div>
    );
};
