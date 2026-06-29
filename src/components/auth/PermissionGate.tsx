import { ReactNode } from 'react';
import { usePermissions, PermissionsConfig } from '@/contexts/PermissionsContext';

interface PermissionGateProps {
    /**
     * The feature/module to check permission for.
     * Must match a key in PermissionsConfig (e.g., 'demands', 'products', 'team')
     */
    feature: keyof PermissionsConfig | string;

    /**
     * The minimum permission level required.
     * 'view' = user can see this element if they have view OR edit permission
     * 'edit' = user can see this element ONLY if they have edit permission
     */
    level: 'view' | 'edit';

    /**
     * The content to render if permission is granted
     */
    children: ReactNode;

    /**
     * Optional fallback content to render if permission is denied.
     * If not provided, nothing will be rendered when permission is denied.
     */
    fallback?: ReactNode;

    /**
     * If true, shows loading skeleton while permissions are being loaded.
     * Default: false (renders nothing while loading)
     */
    showLoadingState?: boolean;
}

/**
 * PermissionGate - A standardized component for permission-based UI rendering.
 * 
 * Use this component to wrap any UI elements that should only be visible
 * to users with specific permissions.
 * 
 * @example
 * // Only show edit button if user can edit demands
 * <PermissionGate feature="demands" level="edit">
 *     <Button onClick={handleEdit}>Editar</Button>
 * </PermissionGate>
 * 
 * @example
 * // Show with fallback for view-only users
 * <PermissionGate feature="products" level="edit" fallback={<span>Somente visualização</span>}>
 *     <Button onClick={handleCreate}>Criar Produto</Button>
 * </PermissionGate>
 */
export function PermissionGate({
    feature,
    level,
    children,
    fallback = null,
    showLoadingState = false
}: PermissionGateProps) {
    const { canView, canEdit, isLoading } = usePermissions();

    // While loading, optionally show loading state or nothing
    if (isLoading) {
        if (showLoadingState) {
            return <div className="animate-pulse bg-muted h-8 w-20 rounded" />;
        }
        return null;
    }

    // Check permission based on required level
    const hasPermission = level === 'edit' ? canEdit(feature) : canView(feature);

    // Render children if permission granted, otherwise render fallback
    return hasPermission ? <>{children}</> : <>{fallback}</>;
}

/**
 * usePermissionCheck - Hook for programmatic permission checks.
 * 
 * Use this when you need to check permissions in logic rather than JSX,
 * or when you need to combine multiple permission checks.
 * 
 * @example
 * const { hasEditAccess, hasViewAccess } = usePermissionCheck('demands');
 * if (hasEditAccess) {
 *     // Allow editing
 * }
 */
export function usePermissionCheck(feature: keyof PermissionsConfig | string) {
    const { canView, canEdit, isLoading } = usePermissions();

    return {
        hasViewAccess: canView(feature),
        hasEditAccess: canEdit(feature),
        isLoading,
    };
}

export default PermissionGate;
