import { TasksView } from "@/components/lever-os/TasksView";
import { LayoutDashboard } from "lucide-react";

export default function PortalGeneralBoard() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight italic flex items-center gap-3">
                    <LayoutDashboard className="w-8 h-8 text-primary" />
                    Quadro Geral
                </h1>
                <p className="text-muted-foreground text-lg">
                    Visão unificada de todas as demandas de todos os clientes.
                </p>
            </div>

            <div className="w-full min-h-[600px]">
                <TasksView
                    clientId={null}
                    title="Todas as Demandas"
                    showClientName={true}
                    ignoreClientFilter={true}
                    readOnly={false} // Employee has access to edit
                />
            </div>
        </div>
    );
}
