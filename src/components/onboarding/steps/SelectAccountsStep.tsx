import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, Loader2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdAccount {
    id: string;
    name: string;
    currency: string;
    status: string;
}

interface SelectAccountsStepProps {
    selectedAccounts: string[];
    onUpdate: (accounts: string[]) => void;
    onNext: () => void;
    onBack: () => void;
}

export const SelectAccountsStep: React.FC<SelectAccountsStepProps> = ({
    selectedAccounts,
    onUpdate,
    onNext,
    onBack,
}) => {
    const [accounts, setAccounts] = useState<AdAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                // Get meta connection
                const { data: connection } = await supabase
                    .from('fb_connections')
                    .select('access_token')
                    .eq('user_id', user.id)
                    .single();

                if (!connection) {
                    setError('Conexão Meta não encontrada');
                    setIsLoading(false);
                    return;
                }

                // Fetch ad accounts from Meta API
                const { data, error } = await supabase.functions.invoke('list-ad-accounts', {
                    body: { accessToken: connection.access_token }
                });

                if (error) throw error;
                setAccounts(data?.accounts || []);
            } catch (err: any) {
                setError(err.message || 'Erro ao buscar contas');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccounts();
    }, []);

    const toggleAccount = (accountId: string) => {
        if (selectedAccounts.includes(accountId)) {
            onUpdate(selectedAccounts.filter(id => id !== accountId));
        } else {
            onUpdate([...selectedAccounts, accountId]);
        }
    };

    const canProceed = selectedAccounts.length > 0;

    const handleNext = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario invalido');

            const { data: connection } = await supabase
                .from('fb_connections')
                .select('access_token')
                .eq('user_id', user.id)
                .single();

            if (!connection) throw new Error('Sem conexao');

            const selectedAccountObjects = accounts.filter(acc => selectedAccounts.includes(acc.id));
            const savedAccountIds: string[] = [];

            for (const acc of selectedAccountObjects) {
                const { data: upserted, error: upsertError } = await supabase
                    .from('ad_accounts')
                    .upsert({
                        user_id: user.id,
                        account_id: acc.id,
                        name: acc.name,
                        access_token: connection.access_token,
                        status: acc.status
                    }, { onConflict: 'account_id' })
                    .select('id')
                    .single();

                if (upsertError) {
                    const { data: existing } = await supabase
                        .from('ad_accounts')
                        .select('id')
                        .eq('account_id', acc.id)
                        .eq('user_id', user.id)
                        .single();

                    if (existing) savedAccountIds.push(existing.id);
                    else throw upsertError;
                } else if (upserted) {
                    savedAccountIds.push(upserted.id);
                }
            }

            onUpdate(savedAccountIds);
            onNext();

        } catch (err: any) {
            console.error(err);
            setError('Erro ao salvar contas: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white mb-4">
                    <Building2 className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Selecione suas Contas</h1>
                <p className="text-muted-foreground text-lg">
                    Escolha as contas de anúncio que deseja otimizar.
                </p>
            </div>

            {/* Account List */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500">{error}</div>
                ) : accounts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma conta de anúncio encontrada.
                    </div>
                ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {accounts.map((account) => (
                            <label
                                key={account.id}
                                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAccounts.includes(account.id)
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                <Checkbox
                                    checked={selectedAccounts.includes(account.id)}
                                    onCheckedChange={() => toggleAccount(account.id)}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{account.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        ID: {account.id} • {account.currency}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Selection Count */}
            {selectedAccounts.length > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                    {selectedAccounts.length} conta{selectedAccounts.length > 1 ? 's' : ''} selecionada{selectedAccounts.length > 1 ? 's' : ''}
                </p>
            )}

            {/* Actions */}
            <div className="flex gap-4">
                <Button variant="outline" onClick={onBack} className="flex-1 h-12">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
                <Button
                    onClick={handleNext}
                    disabled={!canProceed || isLoading}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Configurar Contas
                    {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
            </div>
        </div>
    );
};
