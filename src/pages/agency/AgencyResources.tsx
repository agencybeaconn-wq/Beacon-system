import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, FolderOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClientResource {
    id: string;
    title: string;
    url: string;
    resource_type: string;
    description: string | null;
}

// --- Resource Type Config ---
const RESOURCE_ICONS: Record<string, { emoji: string; label: string; gradient: string; logo?: string }> = {
    gpt_agent: {
        emoji: "🤖",
        label: "Agente GPT",
        gradient: "from-[#74AA9C] to-[#10A37F]", // Teal/Sage for AI
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1024px-ChatGPT_logo.svg.png",
    },
    google_sheets: {
        emoji: "📊",
        label: "Planilha",
        gradient: "from-[#34A853] to-[#188038]", // Classic Sheets Green
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Google_Sheets_logo_%282014-2020%29.svg/1498px-Google_Sheets_logo_%282014-2020%29.svg.png",
    },
    google_docs: {
        emoji: "📄",
        label: "Documento",
        gradient: "from-[#4285F4] to-[#1A73E8]", // Docs Blue
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Google_Docs_logo_%282014-2020%29.svg/1481px-Google_Docs_logo_%282014-2020%29.svg.png",
    },
    notion: {
        emoji: "📝",
        label: "Notion",
        gradient: "from-[#2C2C2C] to-[#000000]", // Notion Black
        logo: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png",
    },
    figma: {
        emoji: "🎨",
        label: "Figma",
        gradient: "from-[#F24E1E] via-[#A259FF] to-[#1ABCFE]", // Figma Rainbow
        logo: "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg",
    },
    canva: {
        emoji: "🖌️",
        label: "Canva",
        gradient: "from-[#00C4CC] to-[#7D2AE8]", // Canva Turquoise/Purple
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/900px-Canva_icon_2021.svg.png",
    },
    drive: {
        emoji: "📁",
        label: "Drive",
        gradient: "from-[#FFD04B] to-[#FDBE02]", // Drive Yellow
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/1024px-Google_Drive_icon_%282020%29.svg.png",
    },
    trello: {
        emoji: "📋",
        label: "Trello",
        gradient: "from-[#0079BF] to-[#005A8E]", // Trello Blue
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Trello_logo.svg/1280px-Trello_logo.svg.png",
    },
    whatsapp: {
        emoji: "💬",
        label: "WhatsApp",
        gradient: "from-[#25D366] to-[#128C7E]", // WhatsApp Green
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/767px-WhatsApp.svg.png",
    },
    slack: {
        emoji: "💬",
        label: "Slack",
        gradient: "from-[#4A154B] to-[#611F69]", // Slack Aubergine
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/2048px-Slack_icon_2019.svg.png",
    },
    link: {
        emoji: "🔗",
        label: "Link",
        gradient: "from-[#6366F1] to-[#4F46E5]", // Indigo
    },
};

export default function AgencyResources() {
    const { clientData } = useDashboard();
    const { linkedClientId, linkedClientName } = usePermissions();
    const activeClientId = linkedClientId || clientData?.id;

    const [resources, setResources] = useState<ClientResource[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadResources = useCallback(async () => {
        if (!activeClientId) {
            console.log('[DEBUG-PORTAL] No activeClientId');
            setIsLoading(false);
            return;
        }
        try {
            console.log('[DEBUG-PORTAL] Loading resources for:', activeClientId);
            const { data, error } = await (supabase as any)
                .from('client_resources')
                .select('*')
                .eq('client_id', activeClientId);

            if (error) {
                console.error('[DEBUG-PORTAL] Error:', error);
                throw error;
            }
            console.log('[DEBUG-PORTAL] Data received:', data);
            setResources(data || []);
        } catch (error: any) {
            console.error('[PortalResources] Error loading resources:', error);
            toast.error("Erro ao carregar recursos: " + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [activeClientId]);

    useEffect(() => {
        loadResources();
    }, [loadResources]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
            <div className="space-y-2">
                <h1 className="text-5xl font-extrabold tracking-tighter italic bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Ferramentas
                </h1>
                <p className="text-muted-foreground text-xl font-medium max-w-2xl">
                    Sua central de recursos. Planilhas, agentes de IA e documentos essenciais para <span className="text-primary font-bold">{linkedClientName || clientData?.name || "seu projeto"}</span>.
                </p>
            </div>

            {resources.length === 0 ? (
                <Card className="p-16 text-center bg-card/50 backdrop-blur-xl border-border/40 border-dashed rounded-3xl shadow-2xl">
                    <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FolderOpen className="h-10 w-10 text-muted-foreground opacity-40" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">Ainda não há ferramentas por aqui</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-3 text-lg">
                        Sua agência irá compartilhar recursos exclusivos nesta área em breve. Fique de olho!
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {resources.map(resource => {
                        const config = RESOURCE_ICONS[resource.resource_type] || RESOURCE_ICONS.link;

                        return (
                            <a
                                key={resource.id}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative"
                            >
                                {/* Background Glow Effect on Hover */}
                                <div className={cn(
                                    "absolute -inset-0.5 bg-gradient-to-r opacity-0 blur group-hover:opacity-30 transition duration-500 rounded-[2rem]",
                                    config.gradient
                                )} />

                                <Card className={cn(
                                    "relative h-full overflow-hidden border-white/5 bg-[#141414] transition-all duration-300 rounded-[24px]",
                                    "hover:border-white/10 hover:shadow-2xl group cursor-pointer"
                                )}>
                                    {/* Glassy Top Highlight Apple HIG (Subtle) */}
                                    <div className={cn("h-1 w-full bg-gradient-to-r opacity-40", config.gradient)} />

                                    <div className="p-6 flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-6">
                                            {/* Icon / Logo Container */}
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 bg-white/5 border border-white/10">
                                                {config.logo ? (
                                                    <img
                                                        src={config.logo}
                                                        alt={config.label}
                                                        className="w-6 h-6 object-contain drop-shadow-sm"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-xl drop-shadow-sm">{config.emoji}</span>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                                    <ExternalLink className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white/90 shadow-sm",
                                                    "bg-gradient-to-r", config.gradient
                                                )}>
                                                    {config.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 space-y-2 mt-2">
                                            <h3 className="font-bold text-lg text-white tracking-tight group-hover:text-white/90 transition-colors duration-300">
                                                {resource.title}
                                            </h3>

                                            {resource.description && (
                                                <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3 font-medium">
                                                    {resource.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    Acesso Externo
                                                </span>
                                            </div>
                                            <span className="text-[#007AFF] font-bold text-xs group-hover:mr-1 transition-all duration-300 flex items-center gap-1">
                                                Abrir <ExternalLink className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
