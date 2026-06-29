import { useState, useCallback, useEffect } from 'react';
import { Search, X, Loader2, Check, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface MetaLocation {
    key: string;
    name: string;
    type: string; // city, region, country
    country_code?: string;
    country_name?: string;
    region?: string;
    primary_city?: string;
}

interface LocationSearchWidgetProps {
    accountId: string;
    onConfirm: (locations: MetaLocation[]) => void;
    initialQuery?: string;
    maxSelections?: number;
}

export function LocationSearchWidget({
    accountId,
    onConfirm,
    initialQuery = '',
    maxSelections = 10
}: LocationSearchWidgetProps) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<MetaLocation[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<MetaLocation[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Debounced search
    const searchLocations = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            // Always append ", Brasil" to prioritize Brazilian results
            const enhancedQuery = searchQuery.toLowerCase().includes('brasil')
                ? searchQuery
                : `${searchQuery}, Brasil`;

            const { data, error: fnError } = await supabase.functions.invoke('search-meta-geo', {
                body: { query: enhancedQuery, accountId }
            });

            console.log('🌍 [LocationSearchWidget] Response:', data, 'Error:', fnError);

            if (fnError) throw fnError;

            // Handle response format from search-meta-geo
            const locationResults = data?.locations || data?.results || data?.data || [];
            console.log('🌍 [LocationSearchWidget] Parsed results:', locationResults.length, 'items');

            if (Array.isArray(locationResults)) {
                setResults(locationResults);
            } else {
                setResults([]);
            }
            setHasSearched(true);
        } catch (err: any) {
            console.error('Error searching locations:', err);
            setError('Erro ao buscar localizações. Tente novamente.');
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [accountId]);

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                searchLocations(query);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query, searchLocations]);

    // Initial search if initialQuery provided - and auto-select matching result
    useEffect(() => {
        const doInitialSearch = async () => {
            if (initialQuery && initialQuery.length >= 2) {
                setIsSearching(true);
                setError(null);

                try {
                    const enhancedQuery = initialQuery.toLowerCase().includes('brasil')
                        ? initialQuery
                        : `${initialQuery}, Brasil`;

                    const { data, error: fnError } = await supabase.functions.invoke('search-meta-geo', {
                        body: { query: enhancedQuery, accountId }
                    });

                    if (fnError) throw fnError;

                    const locationResults = data?.locations || data?.results || data?.data || [];
                    console.log('🌍 [LocationSearchWidget] Initial search results:', locationResults.length, 'items');

                    if (Array.isArray(locationResults) && locationResults.length > 0) {
                        setResults(locationResults);
                        setHasSearched(true);

                        // 🎯 AUTO-SELECT: Find and select the first result that best matches the query
                        const queryLower = initialQuery.toLowerCase().replace(', brasil', '').trim();
                        const exactMatch = locationResults.find((loc: MetaLocation) =>
                            loc.name.toLowerCase() === queryLower ||
                            loc.name.toLowerCase().startsWith(queryLower)
                        );

                        if (exactMatch) {
                            console.log('🌍 [LocationSearchWidget] Auto-selecting:', exactMatch.name);
                            setSelectedLocations([exactMatch]);
                        }
                    } else {
                        setResults([]);
                    }
                } catch (err: any) {
                    console.error('Error in initial search:', err);
                    setError('Erro ao buscar localizações.');
                    setResults([]);
                } finally {
                    setIsSearching(false);
                }
            }
        };

        doInitialSearch();
    }, [initialQuery, accountId]);

    const toggleLocation = (location: MetaLocation) => {
        const isSelected = selectedLocations.some(l => l.key === location.key);

        if (isSelected) {
            setSelectedLocations(prev => prev.filter(l => l.key !== location.key));
        } else if (selectedLocations.length < maxSelections) {
            setSelectedLocations(prev => [...prev, location]);
        }
    };

    const removeLocation = (locationKey: string) => {
        setSelectedLocations(prev => prev.filter(l => l.key !== locationKey));
    };

    const handleConfirm = async () => {
        if (selectedLocations.length === 0) return;

        setIsConfirming(true);
        try {
            onConfirm(selectedLocations);
        } finally {
            setIsConfirming(false);
        }
    };

    const getLocationTypeLabel = (type: string) => {
        switch (type) {
            case 'city': return 'Cidade';
            case 'region': return 'Estado';
            case 'country': return 'País';
            default: return type;
        }
    };

    const getLocationDescription = (location: MetaLocation) => {
        const parts: string[] = [];
        if (location.region && location.type === 'city') {
            parts.push(location.region);
        }
        if (location.country_name || location.country_code) {
            parts.push(location.country_name || location.country_code || '');
        }
        return parts.join(', ');
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700 space-y-4 max-w-md">
            {/* Header */}
            <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Selecionar Localizações</h3>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar cidade ou estado (ex: São Paulo)"
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

            {/* Selected Locations */}
            {selectedLocations.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Selecionadas ({selectedLocations.length}/{maxSelections}):</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedLocations.map((location) => (
                            <Badge
                                key={location.key}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                            >
                                <MapPin className="h-3 w-3" />
                                <span className="text-xs">{location.name}</span>
                                <button
                                    onClick={() => removeLocation(location.key)}
                                    className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
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
                        {results.map((location) => {
                            const isSelected = selectedLocations.some(l => l.key === location.key);
                            return (
                                <button
                                    key={location.key}
                                    onClick={() => toggleLocation(location)}
                                    disabled={!isSelected && selectedLocations.length >= maxSelections}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${isSelected
                                        ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/40 ring-1 ring-primary/20'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                        } ${!isSelected && selectedLocations.length >= maxSelections ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                                            <p className="text-sm font-medium truncate">{location.name}</p>
                                        </div>
                                        {getLocationDescription(location) && (
                                            <p className="text-xs text-muted-foreground truncate ml-6">
                                                {getLocationDescription(location)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                        <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                            {getLocationTypeLabel(location.type)}
                                        </span>
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
            {selectedLocations.length > 0 && (
                <Button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                    {isConfirming ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Confirmando...
                        </>
                    ) : (
                        <>
                            <Check className="h-4 w-4 mr-2" />
                            Confirmar {selectedLocations.length} localização{selectedLocations.length > 1 ? 'ões' : ''}
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
