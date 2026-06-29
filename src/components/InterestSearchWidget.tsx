import { useState, useCallback, useEffect } from 'react';
import { Search, X, Loader2, Check, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface MetaInterest {
    id: string;
    name: string;
    audience_size_lower_bound?: number;
    audience_size_upper_bound?: number;
    path?: string[];
    description?: string;
}

interface InterestSearchWidgetProps {
    accountId: string;
    onConfirm: (interests: MetaInterest[]) => void;
    initialQuery?: string;
    maxSelections?: number;
}

export function InterestSearchWidget({
    accountId,
    onConfirm,
    initialQuery = '',
    maxSelections = 10
}: InterestSearchWidgetProps) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<MetaInterest[]>([]);
    const [selectedInterests, setSelectedInterests] = useState<MetaInterest[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Debounced search
    const searchInterests = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('search-meta-interests', {
                body: { query: searchQuery, accountId }
            });

            console.log('🔍 [InterestSearchWidget] Response:', data, 'Error:', fnError);

            if (fnError) throw fnError;

            // Handle multiple response formats from edge function
            // Edge function returns: { interests: [...] } or cache returns: { data: [...] }
            const interestResults = data?.results || data?.interests || data?.data || [];
            console.log('🔍 [InterestSearchWidget] Parsed results:', interestResults.length, 'items');

            if (Array.isArray(interestResults)) {
                setResults(interestResults);
            } else {
                setResults([]);
            }
            setHasSearched(true);
        } catch (err: any) {
            console.error('Error searching interests:', err);
            setError('Erro ao buscar interesses. Tente novamente.');
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [accountId]);

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                searchInterests(query);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query, searchInterests]);

    // Initial search if initialQuery provided
    useEffect(() => {
        if (initialQuery && initialQuery.length >= 2) {
            searchInterests(initialQuery);
        }
    }, [initialQuery, searchInterests]);

    const toggleInterest = (interest: MetaInterest) => {
        const isSelected = selectedInterests.some(i => i.id === interest.id);

        if (isSelected) {
            setSelectedInterests(prev => prev.filter(i => i.id !== interest.id));
        } else if (selectedInterests.length < maxSelections) {
            setSelectedInterests(prev => [...prev, interest]);
        }
    };

    const removeInterest = (interestId: string) => {
        setSelectedInterests(prev => prev.filter(i => i.id !== interestId));
    };

    const handleConfirm = async () => {
        if (selectedInterests.length === 0) return;

        setIsConfirming(true);
        try {
            onConfirm(selectedInterests);
        } finally {
            setIsConfirming(false);
        }
    };

    const formatAudienceSize = (lower?: number, upper?: number) => {
        if (!lower && !upper) return '';
        const formatNum = (n: number) => {
            if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
            if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
            if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
            return n.toString();
        };
        if (lower && upper) {
            return `${formatNum(lower)} - ${formatNum(upper)}`;
        }
        return formatNum(lower || upper || 0);
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-4 max-w-md">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Selecionar Interesses</h3>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar interesses (ex: futebol, moda, carros)"
                    className="pl-9 pr-4"
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                )}
            </div>

            {/* Error Message */}
            {error && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>
            )}

            {/* Selected Interests */}
            {selectedInterests.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Selecionados ({selectedInterests.length}/{maxSelections}):</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedInterests.map((interest) => (
                            <Badge
                                key={interest.id}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1 bg-primary/10 text-primary border-primary/20"
                            >
                                <span className="text-xs">{interest.name}</span>
                                <button
                                    onClick={() => removeInterest(interest.id)}
                                    className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Results */}
            {hasSearched && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        {results.length > 0 ? `${results.length} resultados:` : 'Nenhum resultado encontrado'}
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {results.map((interest) => {
                            const isSelected = selectedInterests.some(i => i.id === interest.id);
                            return (
                                <button
                                    key={interest.id}
                                    onClick={() => toggleInterest(interest)}
                                    disabled={!isSelected && selectedInterests.length >= maxSelections}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${isSelected
                                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-primary/5'
                                        } ${!isSelected && selectedInterests.length >= maxSelections ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{interest.name}</p>
                                        {interest.path && interest.path.length > 0 && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {interest.path.join(' > ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                        {(interest.audience_size_lower_bound || interest.audience_size_upper_bound) && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {formatAudienceSize(interest.audience_size_lower_bound, interest.audience_size_upper_bound)}
                                            </span>
                                        )}
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Confirm Button */}
            {selectedInterests.length > 0 && (
                <Button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="w-full"
                >
                    {isConfirming ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Confirmando...
                        </>
                    ) : (
                        <>
                            <Check className="h-4 w-4 mr-2" />
                            Confirmar {selectedInterests.length} interesse{selectedInterests.length > 1 ? 's' : ''}
                        </>
                    )}
                </Button>
            )}

            {/* Hint */}
            {!hasSearched && !isSearching && (
                <p className="text-xs text-muted-foreground text-center">
                    Digite pelo menos 2 caracteres para buscar
                </p>
            )}
        </div>
    );
}
