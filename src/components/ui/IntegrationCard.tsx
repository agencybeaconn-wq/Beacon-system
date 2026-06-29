import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, ExternalLink, Settings, Loader2 } from "lucide-react";

interface IntegrationCardProps {
    icon: string | React.ReactNode;
    title: React.ReactNode;
    description: string;
    status: "connected" | "disconnected" | "error" | "loading";
    onConnect?: () => void;
    onDisconnect?: () => void;
    onConfigure?: () => void;
    isLoading?: boolean;
    className?: string;
    children?: React.ReactNode;
    actionLabel?: string;
    footer?: React.ReactNode;
}

export const IntegrationCard = ({
    icon,
    title,
    description,
    status,
    onConnect,
    onDisconnect,
    onConfigure,
    isLoading,
    className,
    children,
    actionLabel = "Conectar",
    footer
}: IntegrationCardProps) => {
    const { t } = useTranslation();
    return (
        <Card className={cn("overflow-hidden transition-all duration-300 hover:shadow-md border-border/50 rounded-xl", className)}>
            <CardHeader className="p-6 pb-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/50">
                        {typeof icon === "string" ? (
                            <img src={icon} alt={typeof title === 'string' ? title : 'Integration icon'} className="h-7 w-7" />
                        ) : (
                            icon
                        )}
                    </div>
                    <div>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            {title}
                            {status === "connected" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="h-3 w-3" />
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                            {description}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-4">
                {children && (
                    <div className="pt-2">
                        {children}
                    </div>
                )}

                <div className="flex items-center gap-2 w-full pt-2">
                    {status === "connected" ? (
                        <>
                            {onConfigure && (
                                <Button variant="outline" size="sm" onClick={onConfigure} className="flex-1 h-10 rounded-xl">
                                    <Settings className="h-4 w-4 mr-2" />
                                    {t('common.configure', 'Configurar')}
                                </Button>
                            )}
                            {onDisconnect && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={onDisconnect}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('common.disconnect', "Desconectar")}
                                </Button>
                            )}
                        </>
                    ) : (
                        <Button
                            onClick={onConnect}
                            disabled={isLoading || status === "disconnected" && !onConnect}
                            size="sm"
                            variant={status === "disconnected" && !onConnect ? "secondary" : "default"}
                            className={cn("w-full h-10 rounded-xl font-semibold",
                                status === "disconnected" && !onConnect ? "opacity-50 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 text-white"
                            )}
                        >
                            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                            {actionLabel}
                        </Button>
                    )}
                </div>

                {footer && (
                    <div className="text-center text-xs text-muted-foreground pt-3 px-2">
                        {footer}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
