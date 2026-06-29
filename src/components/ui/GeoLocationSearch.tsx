import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, X, Globe, Map, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { cn } from '@/lib/utils';

export interface GeoLocation {
    key: string;
    name: string;
    type: 'country' | 'region' | 'city';
    country_code?: string;
    country_name?: string;
    region?: string;
    region_id?: string;
}

interface GeoLocationSearchProps {
    selectedLocations: GeoLocation[];
    onLocationsChange: (locations: GeoLocation[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function GeoLocationSearch({
    selectedLocations,
    onLocationsChange,
    placeholder = 'Buscar localização...',
    disabled = false
}: GeoLocationSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoLocation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { selectedAccountId } = useDashboard();
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchLocations = useCallback(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { data, error: fnError } = await supabase.functions.invoke('search-meta-geo', {
                body: { query: searchQuery, accountId: selectedAccountId },
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
            });

            if (fnError) {
                console.error('[GeoLocationSearch] Function error:', fnError);
                setError('Erro ao buscar localizações');
                setResults([]);
                return;
            }

            if (data?.error) {
                console.error('[GeoLocationSearch] API error:', data.error);
                setError(data.error);
                setResults([]);
                return;
            }

            // Filter out already selected locations
            const filteredResults = (data?.locations || []).filter(
                (loc: GeoLocation) => !selectedLocations.some(sel => sel.key === loc.key)
            );

            setResults(filteredResults);
        } catch (err) {
            console.error('[GeoLocationSearch] Error:', err);
            setError('Erro ao buscar localizações');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccountId, selectedLocations]);

    const handleInputChange = (value: string) => {
        setQuery(value);
        setIsOpen(true);

        // Debounce search
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            searchLocations(value);
        }, 300);
    };

    const handleSelect = (location: GeoLocation) => {
        onLocationsChange([...selectedLocations, location]);
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleRemove = (locationKey: string) => {
        onLocationsChange(selectedLocations.filter(loc => loc.key !== locationKey));
    };

    const getLocationIcon = (type: string) => {
        switch (type) {
            case 'country':
                return <Globe className="h-3 w-3" />;
            case 'region':
                return <Map className="h-3 w-3" />;
            case 'city':
                return <Building2 className="h-3 w-3" />;
            default:
                return <MapPin className="h-3 w-3" />;
        }
    };

    const getLocationTypeLabel = (type: string) => {
        switch (type) {
            case 'country':
                return 'País';
            case 'region':
                return 'Estado/Região';
            case 'city':
                return 'Cidade';
            default:
                return type;
        }
    };

    const getLocationBadgeColor = (type: string) => {
        switch (type) {
            case 'country':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'region':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'city':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
        }
    };

    return (
        <div ref={containerRef} className="relative w-full space-y-2">
            {/* Selected locations */}
            {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedLocations.map((location) => (
                        <Badge
                            key={location.key}
                            variant="secondary"
                            className={cn("flex items-center gap-1 pr-1", getLocationBadgeColor(location.type))}
                        >
                            {getLocationIcon(location.type)}
                            <span className="text-xs">{location.name}</span>
                            {location.country_name && location.type !== 'country' && (
                                <span className="text-xs opacity-70">({location.country_code})</span>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-red-100 dark:hover:bg-red-900/30"
                                onClick={() => handleRemove(location.key)}
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Search input */}
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="pl-9"
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Results dropdown */}
            {isOpen && (query.length >= 2 || results.length > 0) && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 text-sm text-red-500">{error}</div>
                    ) : results.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                            {query.length < 2 ? 'Digite pelo menos 2 caracteres' : 'Nenhuma localização encontrada'}
                        </div>
                    ) : (
                        <div className="py-1">
                            {results.map((location) => (
                                <button
                                    key={location.key}
                                    onClick={() => handleSelect(location)}
                                    className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors"
                                >
                                    <span className={cn("p-1 rounded", getLocationBadgeColor(location.type))}>
                                        {getLocationIcon(location.type)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{location.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {getLocationTypeLabel(location.type)}
                                            {location.country_name && location.type !== 'country' && ` • ${location.country_name}`}
                                            {location.region && location.type === 'city' && ` • ${location.region}`}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
