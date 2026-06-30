import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredFeature?: string;
}

export const ProtectedRoute = ({ children, requiredFeature }: ProtectedRouteProps) => {
    const { session, isLoading: authLoading, signOut } = useAuth();
    const { canView, isLoading: permsLoading, abacRole, isPendingIdentity, refreshPermissions } = usePermissions();
    const location = useLocation();

    const isLoading = authLoading || permsLoading;

    // O PermissionsContext já re-tenta a resolução (token-race) com backoff e
    // mantém isLoading=true durante os retries. Só consideramos "preso" quando
    // ele DESISTE (isPendingIdentity) ou num backstop longo — nunca num timer
    // curto que dispararia no meio do ciclo de retry.
    const [graceExpired, setGraceExpired] = useState(false);
    const stuckWithoutRole = !isLoading && !!session && !abacRole;
    const showRecovery = stuckWithoutRole && (isPendingIdentity || graceExpired);

    useEffect(() => {
        if (!stuckWithoutRole) {
            setGraceExpired(false);
            return;
        }
        // Backstop pra caminhos que zeram isLoading sem marcar isPendingIdentity
        // (ex.: erro crítico no catch). Maior que o orçamento de retry (~13s).
        const t = setTimeout(() => setGraceExpired(true), 15000);
        return () => clearTimeout(t);
    }, [stuckWithoutRole]);

    // Ainda carregando/re-tentando, e sem veredito de "pendente" ainda
    if (isLoading || (stuckWithoutRole && !showRecovery)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Resolução desistiu — estado de recuperação acionável (não tela morta)
    if (showRecovery) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                    Não foi possível carregar suas permissões de acesso. Isso costuma ser uma falha temporária de conexão.
                </p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => { setGraceExpired(false); refreshPermissions(); }}
                        className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-zinc-950 transition-all hover:opacity-90"
                    >
                        Tentar novamente
                    </button>
                    <button
                        type="button"
                        onClick={() => signOut()}
                        className="rounded-lg border border-border/40 px-4 py-2 text-xs font-bold text-muted-foreground transition-all hover:bg-muted/20"
                    >
                        Sair
                    </button>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If a specific feature is required, check permissions
    if (requiredFeature && !canView(requiredFeature)) {
        console.warn(`[ProtectedRoute] Access denied to feature: ${requiredFeature}. Redirecting to /home`);
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};

