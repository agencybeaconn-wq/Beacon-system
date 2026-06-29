import { useState } from "react";
import { AccessCredential } from "@/types/lever-os";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Copy, ExternalLink, Key, Lock, ShoppingBag, BarChart3, MessageSquare, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AccessVaultProps {
    credentials: AccessCredential[];
}

// Card fake do KartPanda
const KARTPANDA_CREDENTIAL: AccessCredential = {
    id: "kp_001",
    platform: "kartpanda" as any,
    name: "KartPanda Checkout",
    username: "loja-fitness",
    url: "https://pay.loja-fitness.com.br",
    notes: "Checkout principal da loja"
};

export function AccessVault({ credentials: initialCredentials }: AccessVaultProps) {
    const [visiblepasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

    // Adiciona KartPanda aos credentials
    const credentials = [...initialCredentials, KARTPANDA_CREDENTIAL];

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado!`);
    };

    const getPlatformConfig = (platform: string) => {
        const configs: Record<string, { icon: React.ReactNode; gradient: string; iconBg: string }> = {
            shopify: {
                icon: <ShoppingBag className="w-5 h-5 text-emerald-500" />,
                gradient: "from-emerald-500/10 to-transparent",
                iconBg: "bg-emerald-500/10 border-emerald-500/20"
            },
            meta_ads: {
                icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
                gradient: "from-blue-500/10 to-transparent",
                iconBg: "bg-blue-500/10 border-blue-500/20"
            },
            google_ads: {
                icon: <BarChart3 className="w-5 h-5 text-yellow-500" />,
                gradient: "from-yellow-500/10 to-transparent",
                iconBg: "bg-yellow-500/10 border-yellow-500/20"
            },
            reportana: {
                icon: <MessageSquare className="w-5 h-5 text-green-500" />,
                gradient: "from-green-500/10 to-transparent",
                iconBg: "bg-green-500/10 border-green-500/20"
            },
            kartpanda: {
                icon: <ShoppingCart className="w-5 h-5 text-orange-500" />,
                gradient: "from-orange-500/10 to-transparent",
                iconBg: "bg-orange-500/10 border-orange-500/20"
            },
        };
        return configs[platform] || {
            icon: <Key className="w-5 h-5 text-slate-500" />,
            gradient: "from-slate-500/10 to-transparent",
            iconBg: "bg-slate-500/10 border-slate-500/20"
        };
    };

    const getPlatformUrl = (cred: AccessCredential) => {
        if (cred.url) return cred.url;
        if (cred.platform === 'shopify') return 'https://shopify.com/admin';
        if (cred.platform === 'meta_ads') return 'https://business.facebook.com';
        return '#';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Lock className="w-5 h-5 text-primary" />
                        </div>
                        Cofre de Acessos
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Credenciais essenciais para a operação</p>
                </div>
                <Button size="sm">
                    <Key className="w-4 h-4 mr-2" />
                    Adicionar Acesso
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {credentials.map((cred) => {
                    const config = getPlatformConfig(cred.platform);

                    return (
                        <Card
                            key={cred.id}
                            className={cn(
                                "relative overflow-hidden p-5 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg",
                                "group"
                            )}
                        >
                            {/* Gradient Background */}
                            <div className={cn(
                                "absolute inset-0 bg-gradient-to-br pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity",
                                config.gradient
                            )} />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center border",
                                            config.iconBg
                                        )}>
                                            {config.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">{cred.name}</h3>
                                            <span className="text-xs text-muted-foreground capitalize">
                                                {cred.platform.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    {cred.url && (
                                        <a
                                            href={getPlatformUrl(cred)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-muted/50"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {/* Login/Slug */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                                            {cred.platform === 'kartpanda' ? 'Slug da Loja' : 'Login / Email'}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                value={cred.username}
                                                readOnly
                                                className="h-9 text-xs pr-10 bg-background/50 font-mono border-border/50"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-0 top-0 h-9 w-9 hover:bg-muted/50"
                                                onClick={() => copyToClipboard(cred.username, "Login")}
                                            >
                                                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Domínio (para KartPanda) */}
                                    {cred.platform === 'kartpanda' && cred.url && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                                                Domínio Checkout
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    value={cred.url}
                                                    readOnly
                                                    className="h-9 text-xs pr-10 bg-background/50 font-mono border-border/50"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-9 w-9 hover:bg-muted/50"
                                                    onClick={() => copyToClipboard(cred.url!, "Domínio")}
                                                >
                                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Senha */}
                                    {cred.password && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Senha</Label>
                                            <div className="relative">
                                                <Input
                                                    type={visiblepasswords[cred.id] ? "text" : "password"}
                                                    value={cred.password}
                                                    readOnly
                                                    className="h-9 text-xs pr-20 bg-background/50 font-mono border-border/50"
                                                />
                                                <div className="absolute right-0 top-0 flex">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 hover:bg-muted/50"
                                                        onClick={() => togglePasswordVisibility(cred.id)}
                                                    >
                                                        {visiblepasswords[cred.id] ?
                                                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> :
                                                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                        }
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 hover:bg-muted/50"
                                                        onClick={() => copyToClipboard(cred.password!, "Senha")}
                                                    >
                                                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {cred.notes && (
                                        <div className="pt-3 border-t border-border/50">
                                            <p className="text-[10px] text-muted-foreground italic">
                                                "{cred.notes}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
