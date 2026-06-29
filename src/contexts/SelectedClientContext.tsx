/**
 * @deprecated This context has been merged into DashboardContext.
 * Import useSelectedClient from '@/contexts/DashboardContext' instead.
 * This file is kept for backward compatibility only.
 */

// Re-export from DashboardContext for backward compatibility
export { useSelectedClient } from './DashboardContext';

// The Provider is no longer needed - DashboardProvider handles everything
// If any component imports SelectedClientProvider, they should remove it.
export function SelectedClientProvider({ children }: { children: React.ReactNode }) {
    console.warn('[DEPRECATED] SelectedClientProvider is deprecated. It is now handled by DashboardProvider.');
    return <>{children}</>;
}
