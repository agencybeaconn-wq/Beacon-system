
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinancialCosts() {
    const isLoading = true;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Custos Fixos e Variáveis</h1>
                    <p className="text-muted-foreground">
                        Gerencie seus custos operacionais para cálculo preciso da margem.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Novo Custo Fixo
                    </Button>
                    <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" /> Novo Custo Variável
                    </Button>
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Custos Fixos Ativos</CardTitle>
                        <CardDescription>Despesas recorrentes mensais.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Nenhum custo cadastrado.</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Custos Variáveis</CardTitle>
                        <CardDescription>Despesas avulsas ou por período.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Nenhum custo cadastrado.</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
