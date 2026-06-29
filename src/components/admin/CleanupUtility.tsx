import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CleanupUtility() {
    const [isCleaning, setIsCleaning] = useState(false);
    const [isNuking, setIsNuking] = useState(false);
    const [stats, setStats] = useState<{ deleted: number } | null>(null);

    // OPÇÃO NUCLEAR: Apagar TODAS as tasks do banco para TODOS os clientes
    const handleNuclearReset = async () => {
        if (!confirm("⚠️ ATENÇÃO: Isso vai APAGAR TODAS as demandas de TODOS os clientes do banco de dados. O sistema vai regenerar automaticamente as demandas dos produtos atribuídos. Tem certeza?")) {
            return;
        }

        setIsNuking(true);
        setStats(null);

        try {
            // Deletar TUDO da tabela client_tasks
            const { error, count } = await (supabase as any)
                .from('client_tasks')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000') // Truque para deletar tudo
                .select('id', { count: 'exact' });

            if (error) throw error;

            // Também limpar duplicatas de assigned_products em todos os clientes
            const { data: clients } = await (supabase as any)
                .from('agency_clients')
                .select('id, assigned_products');

            for (const client of clients || []) {
                const raw = client.assigned_products || [];
                const unique = [...new Set(raw)];
                if (raw.length !== unique.length) {
                    await (supabase as any)
                        .from('agency_clients')
                        .update({ assigned_products: unique })
                        .eq('id', client.id);
                }
            }

            setStats({ deleted: count || 0 });
            toast.success("Reset completo!", {
                description: `Todas as demandas foram removidas. Recarregue a página para ver as demandas regeneradas.`
            });

        } catch (error: any) {
            console.error("Erro no reset:", error);
            toast.error("Erro ao processar reset", { description: error.message });
        } finally {
            setIsNuking(false);
        }
    };

    return (
        <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/20 dark:border-red-900/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Reset de Demandas (Admin)
                </CardTitle>
                <CardDescription>
                    Apaga TODAS as demandas do banco e força a regeneração automática a partir dos produtos vinculados.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 p-3 rounded-md border border-red-200 dark:border-red-800">
                    <strong>Ação irreversível:</strong> Todas as demandas manuais serão perdidas. O sistema vai recriar apenas as demandas dos produtos (Assessoria 360, etc) vinculados a cada cliente.
                </div>

                {stats && (
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Reset concluído: {stats.deleted} demandas removidas. Recarregue a página!</span>
                    </div>
                )}

                <Button
                    onClick={handleNuclearReset}
                    disabled={isNuking || isCleaning}
                    variant="destructive"
                    className="w-full"
                >
                    {isNuking ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetando...
                        </>
                    ) : (
                        <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Resetar TODAS as Demandas
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
