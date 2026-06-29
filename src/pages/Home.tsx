import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";

const Home = () => {
    const { user } = useAuth();
    const { abacRole, isPendingIdentity, isLoading } = usePermissions();
    const { workspaceId } = useDashboard();
    const navigate = useNavigate();

    // Redirect logic
    useEffect(() => {
        if (isLoading) return;

        if (abacRole === 'ADMIN') {
            console.log('Home: Redirecting detected ADMIN to /dashboard');
            navigate('/dashboard', { replace: true });
        } else if (abacRole === 'FUNCIONARIO') {
            console.log('Home: Redirecting detected FUNCIONARIO to /agency');
            navigate('/agency', { replace: true });
        } else if (abacRole === 'CLIENTE') {
            console.log('Home: Redirecting detected CLIENTE to /portal');
            navigate('/portal', { replace: true });
        }
    }, [abacRole, isLoading, navigate]);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Identificando perfil...</p>
            </div>
        );
    }

    // If client detected but not redirected yet (should happen instantly via effect)
    if (abacRole === 'CLIENTE') {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Redirecionando para o Portal...</p>
            </div>
        );
    }

    // DIAGNOSTIC STATE: User is logged in but NOT identified as Client or Agency yet (or Ghost)
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
            <Card className="max-w-md w-full border-destructive/20 shadow-2xl">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                        <ShieldAlert className="w-8 h-8 text-destructive" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold">
                            {isPendingIdentity ? 'Aguardando Autorização' : 'Acesso Indefinido'}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {isPendingIdentity
                                ? 'Seu cadastro está sendo processado. Em instantes você terá acesso ao seu portal.'
                                : 'Não conseguimos identificar suas permissões para este ambiente.'}
                        </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg w-full text-left space-y-2 font-mono text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">User:</span>
                            <span className="font-bold">{user?.email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Workspace:</span>
                            <span className="font-bold">{workspaceId || 'Nenhum'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Role Detectada:</span>
                            <span className="text-destructive font-bold">{abacRole || 'Nenhuma'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span>Aguardando Vínculo</span>
                        </div>
                    </div>

                    <div className="space-y-3 w-full">
                        <Button
                            className="w-full font-bold gap-2"
                            onClick={() => window.location.href = '/dashboard'} // Force hard reload attempt
                            disabled={isPendingIdentity}
                        >
                            {isPendingIdentity ? 'Processando...' : 'Tentar Acessar Portal'} <ArrowRight className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => window.location.reload()}
                        >
                            Recarregar Página
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Home;
