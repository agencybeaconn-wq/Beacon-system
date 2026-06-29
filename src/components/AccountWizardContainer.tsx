import { useDashboard } from "@/contexts/DashboardContext";
import { ConnectAdAccountWizard } from "./ConnectAdAccountWizard";

export function AccountWizardContainer() {
    const { isAccountWizardOpen, setIsAccountWizardOpen, refreshProfiles } = useDashboard();

    return (
        <ConnectAdAccountWizard
            open={isAccountWizardOpen}
            onOpenChange={setIsAccountWizardOpen}
            onSuccess={() => {
                refreshProfiles();
                // We don't necessarily need a full reload if we handle it in context, 
                // but many parts of the app rely on the db state.
                setTimeout(() => window.location.reload(), 1500);
            }}
        />
    );
}
