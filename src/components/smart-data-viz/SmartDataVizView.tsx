import { useState, useMemo } from 'react';
import { useSmartData } from '@/hooks/useSmartData';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/contexts/DashboardContext';
import { SmartDataDashboardV2 } from './SmartDataDashboardV2';
import { ScoreConfiguration } from './ScoreConfiguration';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';

export function SmartDataVizView() {
    const { workspaceId } = useDashboard();
    const smartData = useSmartData(undefined, workspaceId || undefined);

    const { isProcessing = false } = smartData || {};

    const [configOpen, setConfigOpen] = useState(false);

    if (isProcessing) {
        return (
            <div className="space-y-8 animate-pulse p-10">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                </div>
                <Skeleton className="h-[500px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-screen w-full bg-background p-10 pt-10 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Dados Inteligentes</h1>
                    <p className="text-muted-foreground mt-1">Análise de performance e métricas de todos os clientes.</p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setConfigOpen(true)}
                    className="h-9 w-9 rounded-lg shrink-0"
                    title="Configuração do Score"
                >
                    <Settings2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Dashboard */}
            <SmartDataDashboardV2 />

            {/* Config Sheet */}
            <Sheet open={configOpen} onOpenChange={setConfigOpen}>
                <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Configuração do Score</SheetTitle>
                        <SheetDescription>Ajuste os pesos e intervalos de pontuação.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                        <ScoreConfiguration />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
