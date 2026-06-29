import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { cn } from '@/lib/utils';

export interface Interest {
    id: string;
    name: string;
    audience_size?: number;
    path?: string[];
}

interface InterestSearchProps {
    selectedInterests: Interest[];
    onInterestsChange: (interests: Interest[]) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
}

export function InterestSearch({
    selectedInterests,
    onInterestsChange,
    placeholder = 'Buscar interesses...',
    disabled = false,
    label = 'Interesses'
}: InterestSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Interest[]>([]);
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

    const searchInterests = useCallback(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { data, error: fnError } = await supabase.functions.invoke('search-meta-interests', {
                body: { query: searchQuery, accountId: selectedAccountId },
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
            });

            if (fnError) {
                console.error('[InterestSearch] Function error:', fnError);
                setError('Erro ao buscar interesses');
                setResults([]);
                return;
            }

            if (data?.error) {
                console.error('[InterestSearch] API error:', data.error);
                setError(data.error);
                setResults([]);
                return;
            }

            // Filter out already selected interests
            const filteredResults = (data?.interests || []).filter(
                (interest: Interest) => !selectedInterests.some(sel => sel.id === interest.id)
            );

            setResults(filteredResults);
        } catch (err) {
            console.error('[InterestSearch] Error:', err);
            setError('Erro ao buscar interesses');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccountId, selectedInterests]);

    const handleInputChange = (value: string) => {
        setQuery(value);
        setIsOpen(true);

        // Debounce search
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            searchInterests(value);
        }, 400); // Slightly longer debounce for interests
    };

    const handleSelect = (interest: Interest) => {
        onInterestsChange([...selectedInterests, interest]);
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleRemove = (interestId: string) => {
        onInterestsChange(selectedInterests.filter(int => int.id !== interestId));
    };

    const formatAudienceSize = (size?: number) => {
        if (!size) return null;
        if (size >= 1000000) {
            return `${(size / 1000000).toFixed(1)}M`;
        }
        if (size >= 1000) {
            return `${(size / 1000).toFixed(0)}K`;
        }
        return size.toString();
    };

    return (
        <div ref={containerRef} className="relative w-full space-y-2">
            {/* Selected interests */}
            {selectedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedInterests.map((interest) => (
                        <Badge
                            key={interest.id}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                        >
                            <Sparkles className="h-3 w-3" />
                            <span className="text-xs">{interest.name}</span>
                            {interest.audience_size && (
                                <span className="text-xs opacity-70">
                                    ({formatAudienceSize(interest.audience_size)})
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-red-100 dark:hover:bg-red-900/30"
                                onClick={() => handleRemove(interest.id)}
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
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                            <span className="ml-2 text-sm text-muted-foreground">Buscando interesses...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 text-sm text-red-500">{error}</div>
                    ) : results.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                            {query.length < 2 ? 'Digite pelo menos 2 caracteres' : 'Nenhum interesse encontrado'}
                        </div>
                    ) : (
                        <div className="py-1">
                            {results.map((interest) => (
                                <button
                                    key={interest.id}
                                    onClick={() => handleSelect(interest)}
                                    className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors"
                                >
                                    <span className="p-1 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                        <Sparkles className="h-3 w-3" />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{interest.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {interest.audience_size && (
                                                <span className="flex items-center gap-1">
                                                    <TrendingUp className="h-3 w-3" />
                                                    {formatAudienceSize(interest.audience_size)} pessoas
                                                </span>
                                            )}
                                            {interest.path && interest.path.length > 0 && (
                                                <span className="truncate opacity-70">
                                                    {interest.path.join(' › ')}
                                                </span>
                                            )}
                                        </div>
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
