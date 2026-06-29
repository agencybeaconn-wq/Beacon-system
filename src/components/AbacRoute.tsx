import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { can } from "@/permissions/can";
import { type Action, type Role } from "@/permissions/policies";

interface AbacRouteProps {
    children: React.ReactNode;
    resource: string;
    action?: Action;
}

export const AbacRoute = ({ children, resource, action = 'read' }: AbacRouteProps) => {
    const { session, isLoading: authLoading } = useAuth();
    const { abacRole, isLoading: permsLoading } = usePermissions();

    const isLoading = authLoading || permsLoading;

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session || !abacRole) {
        return <Navigate to="/home" replace />;
    }

    const hasAccess = can({ role: abacRole as Role }, action, resource);

    if (!hasAccess) {
        console.warn(`[AbacRoute] Access denied to resource: ${resource} for role ${abacRole}. Redirecting to /home`);
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};
