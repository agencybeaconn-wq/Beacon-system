import React from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OnboardingStep } from '@/hooks/useOnboardingState';

interface Step {
    id: OnboardingStep;
    label: string;
    description: string;
}

interface WizardLayoutProps {
    currentStep: OnboardingStep;
    steps: Step[];
    children: React.ReactNode;
}

const FIRST_ACCESS_STEPS: Step[] = [
    { id: 'welcome', label: 'Bem-vindo', description: 'Conte sobre seu negócio' },
    { id: 'connect-meta', label: 'Conectar Meta', description: 'Autorize sua conta' },
    { id: 'select-accounts', label: 'Selecionar Contas', description: 'Escolha suas contas' },
];

const ACCOUNT_CONFIG_STEPS: Step[] = [
    { id: 'pixel', label: 'Pixel', description: 'Configure o rastreamento' },
    { id: 'pages', label: 'Páginas', description: 'Conecte FB & Instagram' },
    { id: 'goals', label: 'Metas', description: 'Defina seus objetivos' },
    { id: 'complete', label: 'Pronto!', description: 'Configuração completa' },
];

export const WizardLayout: React.FC<WizardLayoutProps> = ({ currentStep, steps, children }) => {
    const getStepStatus = (stepId: OnboardingStep): 'complete' | 'current' | 'upcoming' => {
        const currentIndex = steps.findIndex(s => s.id === currentStep);
        const stepIndex = steps.findIndex(s => s.id === stepId);

        if (stepIndex < currentIndex) return 'complete';
        if (stepIndex === currentIndex) return 'current';
        return 'upcoming';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
            <div className="flex min-h-screen">
                {/* Sidebar */}
                <aside className="hidden lg:flex flex-col w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 p-8">
                    {/* Logo */}
                    <div className="mb-12">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                            LADS
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">AI Optimizer</p>
                    </div>

                    {/* Steps List */}
                    <nav className="flex-1 space-y-2">
                        {steps.map((step, index) => {
                            const status = getStepStatus(step.id);

                            return (
                                <div
                                    key={step.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 rounded-xl transition-all duration-300",
                                        status === 'current' && "bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800",
                                        status === 'complete' && "opacity-60"
                                    )}
                                >
                                    <div className={cn(
                                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                                        status === 'complete' && "bg-emerald-500 border-emerald-500 text-white",
                                        status === 'current' && "border-emerald-500 bg-emerald-500/10 text-emerald-600",
                                        status === 'upcoming' && "border-slate-300 dark:border-slate-700 text-slate-400"
                                    )}>
                                        {status === 'complete' ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <span className="text-sm font-semibold">{index + 1}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className={cn(
                                            "font-medium",
                                            status === 'current' && "text-emerald-700 dark:text-emerald-400",
                                            status === 'upcoming' && "text-slate-400"
                                        )}>
                                            {step.label}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{step.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </nav>

                    {/* Decorative Gradient */}
                    <div className="mt-auto pt-8">
                        <div className="h-32 rounded-2xl bg-gradient-to-br from-emerald-400/20 via-teal-300/20 to-cyan-400/20 blur-2xl" />
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export { FIRST_ACCESS_STEPS, ACCOUNT_CONFIG_STEPS };
export type { Step };
