import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredFeature?: string;
}

export const ProtectedRoute = ({ children, requiredFeature }: ProtectedRouteProps) => {
    const { session, isLoading: authLoading } = useAuth();
    const { canView, isLoading: permsLoading } = usePermissions();
    const location = useLocation();

    const isLoading = authLoading || permsLoading;
    const { abacRole } = usePermissions();

    if (isLoading || (session && !abacRole)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

