import React from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext";
import { can, type PermissionUser } from "@/permissions/can";
import { type Action } from "@/permissions/policies";

interface PermissionGuardProps {
    action: Action;
    resource: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    contextOwnerId?: string;
}

export function PermissionGuard({ action, resource, children, fallback, contextOwnerId }: PermissionGuardProps) {
    const { abacRole, linkedClientId, isLoading } = usePermissions();

    if (isLoading) {
        return null; // Or some loading spinner
    }

    // Constructor do user a partir do contexto atual
    // Fail-safe: sessões antigas sem role assumem CLIENTE
    const safeUser: PermissionUser | null = {
        role: abacRole ?? 'CLIENTE',
        clienteId: linkedClientId || undefined
    };

    // Construct ABACContext
    // If the prop is explicitly passed, use it. Otherwise, assume they are accessing their own contextual scope.
    const context = {
        ownerId: contextOwnerId || linkedClientId || undefined
    };

    if (!safeUser) {
        return <Navigate to="/login" replace />;
    }

    const hasAccess = can(safeUser, action, resource, context);
    console.log('[PermissionGuard] Evaluating access:', {
        action,
        resource,
        safeUser,
        context,
        hasAccess
    });

    if (!hasAccess) {
        return <>{fallback ?? <div>Acesso não autorizado.</div>}</>;
    }

    return <>{children}</>;
}
