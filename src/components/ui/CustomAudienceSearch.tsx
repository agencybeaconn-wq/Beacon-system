import { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Search, Users, Target, Loader2 } from "lucide-react";
import { useCustomAudiences, CustomAudience } from "@/hooks/useCustomAudiences";
import { useDashboard } from "@/contexts/DashboardContext";
import { cn } from "@/lib/utils";

interface CustomAudienceSearchProps {
    selectedAudiences: { id: string; name?: string }[];
    onAudiencesChange: (audiences: { id: string; name?: string }[]) => void;
    placeholder?: string;
    disabled?: boolean;
    filterType?: 'all' | 'lookalike' | 'custom'; // Filter by subtype
}

export function CustomAudienceSearch({
    selectedAudiences,
    onAudiencesChange,
    placeholder = 'Pesquisar públicos existentes',
    disabled = false,
    filterType = 'all'
}: CustomAudienceSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'lookalike' | 'custom'>(filterType);
    const { selectedAccountId } = useDashboard();
    const containerRef = useRef<HTMLDivElement>(null);

    const { audiences, isLoading, error } = useCustomAudiences(selectedAccountId);

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

    // Filter audiences based on search query and tab
    const filteredAudiences = audiences.filter(audience => {
        // Filter by search query
        const matchesQuery = !query || audience.name.toLowerCase().includes(query.toLowerCase());

        // Filter by tab
        let matchesTab = true;
        if (activeTab === 'lookalike') {
            matchesTab = audience.subtype === 'LOOKALIKE';
        } else if (activeTab === 'custom') {
            matchesTab = audience.subtype !== 'LOOKALIKE';
        }

        // Exclude already selected
        const notSelected = !selectedAudiences.some(s => s.id === audience.id);

        return matchesQuery && matchesTab && notSelected;
    });

    const handleSelect = (audience: CustomAudience) => {
        onAudiencesChange([...selectedAudiences, { id: audience.id, name: audience.name }]);
        setQuery('');
    };

    const handleRemove = (audienceId: string) => {
        onAudiencesChange(selectedAudiences.filter(a => a.id !== audienceId));
    };

    const formatAudienceSize = (count?: number) => {
        if (!count) return '';
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
        return count.toString();
    };

    const getSubtypeLabel = (subtype: string) => {
        switch (subtype) {
            case 'LOOKALIKE': return 'Semelhante';
            case 'WEBSITE': return 'Site';
            case 'CUSTOM': return 'Personalizado';
            case 'CUSTOMER_FILE': return 'Lista de clientes';
            case 'ENGAGEMENT': return 'Engajamento';
            default: return subtype;
        }
    };

    const getSubtypeColor = (subtype: string) => {
        switch (subtype) {
            case 'LOOKALIKE': return 'bg-purple-500';
            case 'WEBSITE': return 'bg-blue-500';
            case 'CUSTOM': return 'bg-green-500';
            case 'CUSTOMER_FILE': return 'bg-orange-500';
            case 'ENGAGEMENT': return 'bg-pink-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Selected audiences badges */}
            {selectedAudiences.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {selectedAudiences.map(audience => (
                        <Badge key={audience.id} variant="secondary" className="gap-1 pr-1">
                            <Users className="h-3 w-3" />
                            <span className="text-xs">{audience.name || audience.id}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-red-100"
                                onClick={() => handleRemove(audience.id)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Search input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="pl-9 h-9"
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex gap-2 p-2 border-b border-border bg-muted/30">
                        <button
                            className={cn(
                                "text-xs pb-1 transition-colors",
                                activeTab === 'all'
                                    ? "font-medium text-foreground border-b-2 border-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setActiveTab('all')}
                        >
                            Todos
                        </button>
                        <button
                            className={cn(
                                "text-xs pb-1 transition-colors",
                                activeTab === 'lookalike'
                                    ? "font-medium text-foreground border-b-2 border-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setActiveTab('lookalike')}
                        >
                            Público semelhante
                        </button>
                        <button
                            className={cn(
                                "text-xs pb-1 transition-colors",
                                activeTab === 'custom'
                                    ? "font-medium text-foreground border-b-2 border-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setActiveTab('custom')}
                        >
                            Público personalizado
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-48 overflow-y-auto">
                        {error && (
                            <div className="p-3 text-xs text-red-500">
                                Erro ao carregar públicos: {error}
                            </div>
                        )}

                        {!error && filteredAudiences.length === 0 && (
                            <div className="p-3 text-xs text-muted-foreground text-center">
                                {isLoading ? 'Carregando...' : 'Nenhum público encontrado'}
                            </div>
                        )}

                        {filteredAudiences.map(audience => (
                            <div
                                key={audience.id}
                                className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                                onClick={() => handleSelect(audience)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", getSubtypeColor(audience.subtype))} />
                                    <div>
                                        <p className="text-sm font-medium">{audience.name}</p>
                                        {audience.approximate_count && (
                                            <p className="text-xs text-muted-foreground">
                                                ~{formatAudienceSize(audience.approximate_count)} pessoas
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {getSubtypeLabel(audience.subtype)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
