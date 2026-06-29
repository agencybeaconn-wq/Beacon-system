import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/formatters";

interface Props {
    commission: number;
    isLoading?: boolean;
}

/**
 * Card "Comissão Lever" (slot 4 do topo da dashboard).
 *
 * Visível para os 3 perfis (ADMIN, FUNCIONARIO, CLIENTE) com o mesmo valor:
 *   commission = bestRevenue × (agency_clients.commission_rate / 100)
 *
 * O cálculo respeita `agency_clients.calculation_base` ('revenue' default ou 'spend').
 * Configurado na página de Regras Financeiras de cada cliente.
 *
 * Estado de mostrar/ocultar persiste em localStorage — útil pra screenshots
 * sem revelar o número exato em reuniões com terceiros.
 */
export function CommissionCard({ commission, isLoading = false }: Props) {
    const [showCommission, setShowCommission] = useState<boolean>(() => {
        if (typeof window === "undefined") return true;
        const stored = localStorage.getItem("overview_show_commission");
        return stored === null ? true : stored === "1";
    });

    useEffect(() => {
        localStorage.setItem("overview_show_commission", showCommission ? "1" : "0");
    }, [showCommission]);

    return (
        <Card className="bg-card border-border text-card-foreground shadow-none rounded-2xl">
            <CardHeader className="pb-1 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-foreground">Comissão Beacon</CardTitle>
                <button
                    type="button"
                    onClick={() => setShowCommission((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showCommission ? "Ocultar comissão" : "Mostrar comissão"}
                    title={showCommission ? "Ocultar comissão" : "Mostrar comissão"}
                >
                    {showCommission ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
            </CardHeader>
            <CardContent className="px-6 pb-4 pt-0">
                {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                ) : (
                    <h3 className="text-3xl font-bold font-mono-numbers tracking-tight text-[#34C759] select-none">
                        {showCommission ? formatCurrencyBRL(commission) : "••••••"}
                    </h3>
                )}
            </CardContent>
        </Card>
    );
}
