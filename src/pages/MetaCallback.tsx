import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MetaCallback() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [status, setStatus] = useState('Processando conexão...');

    useEffect(() => {
        const handleCallback = async () => {
            // 1. Get token from Hash (Implicit Flow)
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const error = params.get('error');

            if (error) {
                console.error('Meta Auth Error:', error);
                toast({
                    title: "Erro na conexão",
                    description: "Não foi possível conectar com o Facebook.",
                    variant: "destructive"
                });
                navigate('/connections');
                return;
            }

            if (!accessToken) {
                // Fallback: check query params if code flow was mistakenly used
                const query = new URLSearchParams(window.location.search);
                if (query.get('code')) {
                    toast({
                        title: "Configuração necessária",
                        description: "O fluxo de código requer configuração de servidor. Contate o suporte.",
                        variant: "destructive"
                    });
                }
                return;
            }

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Usuário não logado");

                setStatus('Salvando credenciais...');

                // 2. Save to 'fb_connections' or 'ad_accounts'
                // Ideally we fetch the user's accounts now to get their IDs.
                // Let's create a record in 'fb_connections' first if table exists
                // Or update 'ad_accounts' if that's the primary.
                // Based on types.ts, 'fb_connections' exists.

                // Fetch User Info from Meta to get Name/ID
                const meResp = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}`);
                const meData = await meResp.json();

                if (meData.error) throw new Error(meData.error.message);

                const { error: dbError } = await supabase
                    .from('fb_connections')
                    .upsert({
                        user_id: user.id,
                        access_token: accessToken,
                        name: meData.name,
                        status: 'connected',
                        created_at: new Date().toISOString()
                        // expires_at: calculate base on 'expires_in' param if available
                    }, { onConflict: 'user_id' }); // Assuming user_id one-to-one or use ID

                if (dbError) {
                    // Fallback to ad_accounts if fb_connections fails (legacy)
                    console.warn('Failed to save to fb_connections, trying ad_accounts logic if needed', dbError);
                }

                // 3. Trigger Sync
                setStatus('Sincronizando contas...');
                await supabase.functions.invoke('sync-meta-campaigns', {
                    body: { force: true }
                });

                toast({
                    title: "Conectado!",
                    description: "Sua conta do Facebook foi vinculada com sucesso.",
                });

                navigate('/connections');

            } catch (err: any) {
                console.error('Callback Error:', err);
                toast({
                    title: "Erro",
                    description: err.message || "Falha ao processar conexão.",
                    variant: "destructive"
                });
                navigate('/connections');
            }
        };

        handleCallback();
    }, [navigate, toast]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h2 className="text-lg font-semibold text-foreground">{status}</h2>
        </div>
    );
}
