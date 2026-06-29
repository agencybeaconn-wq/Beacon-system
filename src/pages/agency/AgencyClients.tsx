import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ExternalLink, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function AgencyClients() {
    const { clients, isLoadingClients, workspaceId } = useDashboard();
    const navigate = useNavigate();

    const handleViewClientTasks = (clientId: string) => {
        navigate(`/agency/clients/${clientId}`);
    };

    if (isLoadingClients) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight italic flex items-center gap-3">
                    <Users className="w-8 h-8 text-primary" />
                    Cartela de Clientes
                </h1>
                <p className="text-muted-foreground text-lg">
                    Selecione um cliente para visualizar suas demandas e recursos.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {clients.map((client: any) => {
                    const initials = client.name
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                    const clientType = client.client_type || 'avulso';

                    return (
                        <Card key={client.id} className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <Avatar className="h-12 w-12 border-2 border-border group-hover:border-primary transition-colors">
                                        <AvatarImage src={client.logo_url || ""} />
                                        <AvatarFallback className="font-bold bg-muted">{initials}</AvatarFallback>
                                    </Avatar>
                                    <Badge
                                        className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider border-0 px-2.5 py-0.5",
                                            clientType === 'fixo'
                                                ? "bg-emerald-500/10 text-emerald-500"
                                                : "bg-orange-500/10 text-orange-500"
                                        )}
                                    >
                                        {clientType === 'fixo' ? 'Fixo (MRR)' : 'Avulso'}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-4 text-xl font-bold truncate">{client.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground">
                                    Clique para ver o quadro de demandas deste cliente.
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full font-bold group-hover:bg-primary" onClick={() => handleViewClientTasks(client.id)}>
                                    Ver Demandas
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}

                {clients.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        Nenhum cliente encontrado.
                    </div>
                )}
            </div>
        </div>
    );
}
