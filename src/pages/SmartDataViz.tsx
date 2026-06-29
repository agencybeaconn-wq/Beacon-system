import { SmartDataVizView } from "@/components/smart-data-viz/SmartDataVizView";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function SmartDataViz() {
    return (
        <DashboardLayout>
            <div className="flex-1 w-full bg-background">
                <SmartDataVizView />
            </div>
        </DashboardLayout>
    );
}
