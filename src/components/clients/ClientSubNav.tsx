import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
    { label: "Configurações", value: "/client-config" },
    { label: "Pedidos", value: "/pedidos" },
    { label: "Documentos", value: "/documentos" },
    { label: "Preços", value: "/precos" },
];

export function ClientSubNav() {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    return (
        <Tabs value={pathname} onValueChange={(val) => navigate(val)}>
            <TabsList className="h-10">
                {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
