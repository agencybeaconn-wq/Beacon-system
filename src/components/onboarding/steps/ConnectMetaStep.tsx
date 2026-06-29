import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectMetaStepProps {
    onNext: () => void;
    onBack: () => void;
}

export const ConnectMetaStep: React.FC<ConnectMetaStepProps> = ({ onNext, onBack }) => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if already connected on mount
    React.useEffect(() => {
        const checkConnection = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: connections } = await (supabase as any)
                .from('fb_connections')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

            if (connections && connections.length > 0) {
                setIsConnected(true);
            }
        };
        checkConnection();
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Usuário não autenticado');
                setIsConnecting(false);
                return;
            }

            // Trigger Meta OAuth flow using Authorization Code Flow
            // The callback will be handled by the Supabase edge function
            const appId = import.meta.env.VITE_FB_APP_ID;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const redirectUri = `${supabaseUrl}/functions/v1/fb-oauth-callback`;
            const scope = 'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list,instagram_basic,pages_read_user_content';

            // Pass current origin and user ID in state so callback knows where to redirect and who to associate
            const returnUrl = window.location.origin;
            const state = encodeURIComponent(JSON.stringify({ returnUrl, userId: user.id }));

            // Use response_type=code for Authorization Code Flow (server-side token exchange)
            const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&state=${state}`;

            window.location.href = authUrl;
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar');
            setIsConnecting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1877F2] text-white mb-4">
                    <Facebook className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Conectar sua Conta Meta</h1>
                <p className="text-muted-foreground text-lg">
                    Autorize o LADS a acessar suas contas de anúncio do Meta Ads.
                </p>
            </div>

            {/* Status Card */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {isConnected ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Conta Conectada!</h3>
                            <p className="text-muted-foreground">Sua conta Meta já está vinculada.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="font-semibold text-lg">Permissões Necessárias</h3>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>📊 Acesso às contas de anúncio</li>
                                <li>📈 Leitura de métricas e relatórios</li>
                                <li>📱 Gerenciamento de páginas</li>
                                <li>📷 Conexão com Instagram</li>
                            </ul>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="w-full h-14 text-lg bg-[#1877F2] hover:bg-[#166FE5]"
                        >
                            {isConnecting ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Facebook className="w-5 h-5 mr-2" />
                            )}
                            Conectar com Facebook
                        </Button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <Button variant="outline" onClick={onBack} className="flex-1 h-12">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!isConnected}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};
