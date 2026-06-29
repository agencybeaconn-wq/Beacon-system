import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, Loader2, Activity, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Pixel {
    id: string;
    name: string;
}

interface PixelStepProps {
    accountId: string;
    selectedPixelId?: string;
    onUpdate: (pixelId: string) => void;
    onNext: () => void;
    onBack: () => void;
}

export const PixelStep: React.FC<PixelStepProps> = ({
    accountId,
    selectedPixelId,
    onUpdate,
    onNext,
    onBack,
}) => {
    const [pixels, setPixels] = useState<Pixel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPixels = async () => {
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

                const { data, error } = await supabase.functions.invoke('list-pixels', {
                    body: { accessToken: connection.access_token, accountId }
                });

                if (error) throw error;
                setPixels(data?.pixels || []);
            } catch (err: any) {
                setError(err.message || 'Erro ao buscar pixels');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPixels();
    }, [accountId]);

    const canProceed = !!selectedPixelId;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-4">
                    <Activity className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Configurar Pixel</h1>
                <p className="text-muted-foreground text-lg">
                    Selecione o pixel principal para rastreamento de conversões.
                </p>
            </div>

            {/* Pixel List */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500">{error}</div>
                ) : pixels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="mb-2">Nenhum pixel encontrado nesta conta.</p>
                        <p className="text-sm">Você pode criar um pixel no Meta Business Suite.</p>
                    </div>
                ) : (
                    <RadioGroup value={selectedPixelId} onValueChange={onUpdate}>
                        <div className="space-y-3">
                            {pixels.map((pixel) => (
                                <label
                                    key={pixel.id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPixelId === pixel.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    <RadioGroupItem value={pixel.id} />
                                    <div className="flex-1">
                                        <p className="font-medium">{pixel.name}</p>
                                        <p className="text-sm text-muted-foreground">ID: {pixel.id}</p>
                                    </div>
                                    {selectedPixelId === pixel.id && (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    )}
                                </label>
                            ))}
                        </div>
                    </RadioGroup>
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
                    disabled={!canProceed && pixels.length > 0}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};
