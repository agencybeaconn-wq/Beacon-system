import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowRight, ArrowLeft, Loader2, Facebook, Instagram, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Page {
    id: string;
    name: string;
    instagram_business_account?: {
        id: string;
        username: string;
    };
}

interface PagesStepProps {
    accountId: string;
    selectedPageId?: string;
    selectedInstagramId?: string;
    onUpdate: (data: { pageId?: string; instagramId?: string }) => void;
    onNext: () => void;
    onBack: () => void;
}

export const PagesStep: React.FC<PagesStepProps> = ({
    accountId,
    selectedPageId,
    selectedInstagramId,
    onUpdate,
    onNext,
    onBack,
}) => {
    const [pages, setPages] = useState<Page[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPages = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                const { data: connection } = await (supabase as any)
                    .from('meta_connections')
                    .select('access_token')
                    .eq('user_id', user.id)
                    .single();

                if (!connection) {
                    setError('Conexão Meta não encontrada');
                    setIsLoading(false);
                    return;
                }

                const { data, error } = await supabase.functions.invoke('list-pages', {
                    body: { accessToken: connection.access_token }
                });

                if (error) throw error;
                setPages(data?.pages || []);
            } catch (err: any) {
                setError(err.message || 'Erro ao buscar páginas');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPages();
    }, [accountId]);

    const handlePageSelect = (pageId: string) => {
        const page = pages.find(p => p.id === pageId);
        onUpdate({
            pageId,
            instagramId: page?.instagram_business_account?.id
        });
    };

    const selectedPage = pages.find(p => p.id === selectedPageId);
    const canProceed = !!selectedPageId;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white mb-4">
                    <Facebook className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Conectar Páginas</h1>
                <p className="text-muted-foreground text-lg">
                    Selecione a página do Facebook para seus anúncios.
                </p>
            </div>

            {/* Page List */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500">{error}</div>
                ) : pages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma página encontrada.
                    </div>
                ) : (
                    <RadioGroup value={selectedPageId} onValueChange={handlePageSelect}>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {pages.map((page) => (
                                <label
                                    key={page.id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPageId === page.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    <RadioGroupItem value={page.id} />
                                    <div className="flex-1">
                                        <p className="font-medium flex items-center gap-2">
                                            <Facebook className="w-4 h-4 text-[#1877F2]" />
                                            {page.name}
                                        </p>
                                        {page.instagram_business_account && (
                                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                <Instagram className="w-4 h-4 text-[#E4405F]" />
                                                @{page.instagram_business_account.username}
                                            </p>
                                        )}
                                    </div>
                                    {selectedPageId === page.id && (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    )}
                                </label>
                            ))}
                        </div>
                    </RadioGroup>
                )}
            </div>

            {/* Instagram Badge */}
            {selectedPage?.instagram_business_account && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Instagram className="w-4 h-4 text-[#E4405F]" />
                    Instagram conectado: @{selectedPage.instagram_business_account.username}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
                <Button variant="outline" onClick={onBack} className="flex-1 h-12">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!canProceed && pages.length > 0}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};
