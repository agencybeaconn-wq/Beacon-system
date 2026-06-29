import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Loader2 } from "lucide-react";

export const LandingRedirect = () => {
    const { abacRole, isLoading } = usePermissions();
    const navigate = useNavigate();
    const [waited, setWaited] = useState(false);

    // Give permissions an extra moment to resolve if abacRole is still null
    useEffect(() => {
        if (!isLoading && abacRole === null && !waited) {
            const timer = setTimeout(() => setWaited(true), 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, abacRole, waited]);

    useEffect(() => {
        // Don't redirect while still loading
        if (isLoading) return;
        // If abacRole is null and we haven't waited yet, hold off
        if (abacRole === null && !waited) return;

        console.log('[LandingRedirect] Permissions loaded. abacRole:', abacRole);

        if (abacRole === 'ADMIN') {
            navigate("/dashboard", { replace: true });
        } else if (abacRole === 'FUNCIONARIO') {
            navigate("/agency", { replace: true });
        } else if (abacRole === 'CLIENTE') {
            navigate("/portal", { replace: true });
        } else {
            // abacRole is null or unknown - go to home (diagnostic page)
            navigate("/home", { replace: true });
        }
    }, [isLoading, abacRole, navigate, waited]);

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
};
