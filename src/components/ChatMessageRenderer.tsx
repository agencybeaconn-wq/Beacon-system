import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Search, MapPin, Loader2, ChevronRight } from 'lucide-react';
import roboAiIcon from "@/assets/robo-ai.svg";
import { StructuredDataDropdown } from './StructuredDataDropdown';
import { InterestSearchWidget } from './InterestSearchWidget';
// LocationSearchWidget removed - locations now handled conversationally via searchMetaGeo
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/contexts/ChatContext';
import { useDashboard } from '@/contexts/DashboardContext';

interface Message {
    role: 'user' | 'assistant' | 'function';
    content: string;
    functionCall?: {
        name: string;
        arguments: any;
    };
    structuredData?: {
        type: 'pixels' | 'identities' | 'creatives' | 'urls' | 'interests' | 'campaign_created' | 'interest_selector' | 'location_selector' | 'locations';
        data?: any[];
        campaignName?: string;
        totalAdSets?: number;
        totalAds?: number;
        draftId?: string;
        requiredCount?: number;
        initialQuery?: string;
        accountId?: string;
    };
}

interface ChatMessageRendererProps {
    message: Message;
    isLast: boolean;
    isLoading: boolean;
}

export function ChatMessageRenderer({ message, isLast, isLoading }: ChatMessageRendererProps) {
    const [displayedContent, setDisplayedContent] = useState("");
    const navigate = useNavigate();
    const { draftCampaign, setActiveDraftCard, setCreativeWizardData, creativeWizardData, creativesProcessed, sendMessage } = useChat();
    const { selectedAccountId } = useDashboard();
    const isAssistant = message.role === 'assistant';
    const isFunctionCall = message.role === 'function' && message.functionCall;
    const shouldAnimate = isAssistant && isLast && isLoading;
    const isCampaignCreated = message.structuredData?.type === 'campaign_created';

    // 🔒 PREVENT RE-TRIGGER: Track if we already opened the wizard for this message
    const wizardTriggeredRef = useRef(false);

    useEffect(() => {
        if (shouldAnimate) {
            let currentIndex = 0;
            const interval = setInterval(() => {
                if (currentIndex <= message.content.length) {
                    setDisplayedContent(message.content.slice(0, currentIndex));
                    currentIndex++;
                } else {
                    clearInterval(interval);
                }
            }, 15); // Velocidade da digitação

            return () => clearInterval(interval);
        } else {
            setDisplayedContent(message.content);
        }
    }, [message.content, shouldAnimate]);

    // 🔥 RENDERIZAÇÃO DE TOOL INVOCATIONS: Badge elegante para function calls
    if (isFunctionCall) {
        const functionName = message.functionCall?.name || '';
        const functionArgs = message.functionCall?.arguments || {};

        // Determinar texto e ícone baseado no nome da função
        let badgeText = '⚙️ Processando...';
        let IconComponent = Loader2;

        if (functionName === 'searchMetaGeo' || functionName === 'search_targeting_geo') {
            const query = functionArgs.query || '';
            badgeText = `🌍 Pesquisando localização${query ? `: ${query}` : '...'}`;
            IconComponent = MapPin;
        } else if (functionName === 'searchMetaInterests' || functionName === 'search_targeting_interests') {
            const query = functionArgs.query || '';
            badgeText = `🔍 Buscando interesses${query ? `: ${query}` : '...'}`;
            IconComponent = Search;
        } else if (functionName === 'propose_campaign_structure' || functionName === 'createCampaignDraft') {
            badgeText = '🚀 Preparando campanha...';
            IconComponent = Loader2;
        } else if (functionName === 'get_historical_performance') {
            badgeText = '📊 Analisando histórico...';
            IconComponent = Loader2;
        } else if (functionName === 'scan_for_anomalies') {
            badgeText = '🔍 Escaneando anomalias...';
            IconComponent = Loader2;
        }

        try {
            return (
                <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                        <img src={roboAiIcon} alt="AI" className="h-5 w-5" />
                    </div>
                    <div className="max-w-[85%] rounded-xl p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none">
                        <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4 text-primary animate-spin" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {badgeText}
                            </span>
                        </div>
                    </div>
                </div>
            );
        } catch (error) {
            console.error("Erro ao renderizar tool invocation:", error);
            return (
                <div className="p-2 text-xs text-red-500 bg-red-50 rounded border border-red-100">
                    Erro ao exibir status da ferramenta.
                </div>
            );
        }
    }

    // Ocultar mensagens com conteúdo '__FUNCTION_CALL__' (marcador antigo)
    if (message.content === '__FUNCTION_CALL__' || message.content.trim() === '__FUNCTION_CALL__') {
        return null;
    }

    // Render structured data dropdown if present
    if (message.structuredData) {

        // Only render dropdown for valid dropdown types (not 'campaign_created', 'interest_selector', 'locations', or 'interests')
        // 'interests' is now handled by InterestSearchWidget for multi-select
        // 'locations' is now auto-resolved in backend - no dropdown needed
        const isValidDropdownType = message.structuredData.type !== 'campaign_created' && message.structuredData.type !== 'interest_selector' && message.structuredData.type !== 'location_selector' && message.structuredData.type !== 'locations' && message.structuredData.type !== 'interests';

        // 🔍 SPECIAL HANDLING FOR INTEREST SELECTOR: Show searchable widget
        if (message.structuredData.type === 'interest_selector') {
            const handleInterestConfirm = async (interests: { id: string; name: string }[]) => {
                // Send a user message confirming the selection
                const interestNames = interests.map(i => i.name).join(', ');
                const interestData = JSON.stringify(interests);
                // The message will be picked up by ChatContext to store in pending campaign data
                await sendMessage(`__INTEREST_SELECTION__${interestData}__END__ Selecionei os interesses: ${interestNames}`);
            };

            return (
                <div className={`flex gap-3 ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
                    {isAssistant && (
                        <div className="h-8 w-8 rounded-lg bg-meta-gradient flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                            <img src={roboAiIcon} alt="AI" className="h-5 w-5 brightness-0 invert" />
                        </div>
                    )}
                    <div className="max-w-[85%] rounded-xl p-3.5 text-sm shadow-sm bg-white dark:bg-card border border-border/50 rounded-tl-none">
                        <p className="text-sm mb-3">{message.content}</p>
                        <InterestSearchWidget
                            accountId={message.structuredData.accountId || selectedAccountId || ''}
                            onConfirm={handleInterestConfirm}
                            initialQuery={message.structuredData.initialQuery}
                        />
                    </div>
                </div>
            );
        }

        // 🌍 LOCATION: Now handled conversationally via searchMetaGeo - widget REMOVED
        // If a location_selector message somehow appears, just display the text (no widget)
        if (message.structuredData.type === 'location_selector') {
            console.log('⚠️ [ChatMessageRenderer] location_selector DEPRECATED - showing text only');
            // Fall through to regular text rendering
        }

        // 🔍 SPECIAL HANDLING FOR INTERESTS: Use the new InterestSearchWidget instead of old dropdown
        // This allows multi-select and proper ID handling
        if (message.structuredData.type === 'interests' && message.structuredData.data && message.structuredData.data.length > 0) {
            const handleInterestConfirmFromData = async (interests: { id: string; name: string }[]) => {
                const interestNames = interests.map(i => i.name).join(', ');
                const interestData = JSON.stringify(interests);
                await sendMessage(`__INTEREST_SELECTION__${interestData}__END__ Selecionei os interesses: ${interestNames}`);
            };

            // Extract initialQuery: from structuredData OR from first interest name
            const extractedQuery = message.structuredData.initialQuery ||
                (message.structuredData.data[0]?.name) ||
                '';

            return (
                <div className={`flex gap-3 ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
                    {isAssistant && (
                        <div className="h-8 w-8 rounded-lg bg-meta-gradient flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                            <img src={roboAiIcon} alt="AI" className="h-5 w-5 brightness-0 invert" />
                        </div>
                    )}
                    <div className="max-w-[85%] rounded-xl p-3.5 text-sm shadow-sm bg-white dark:bg-card border border-border/50 rounded-tl-none">
                        <p className="text-sm mb-3">{message.content}</p>
                        <InterestSearchWidget
                            accountId={selectedAccountId || ''}
                            onConfirm={handleInterestConfirmFromData}
                            initialQuery={extractedQuery}
                        />
                    </div>
                </div>
            );
        }

        // 🎨 SPECIAL HANDLING FOR CREATIVES: Always trigger wizard (regardless of draft)
        // 🔒 GUARD: Only trigger if not already triggered and wizard not already open
        if (message.structuredData.type === 'creatives' && message.structuredData.data && message.structuredData.data.length > 0) {

            // 🔧 FIX: Do NOT trigger wizard here - let ChatContext handle it
            // ChatContext already opens wizard with correct structure (numAdSets from structure string)
            // This fallback was creating only 1 adset placeholder, breaking the structure
            // Just show the message, wizard is already being opened by ChatContext

            // Show a message indicating wizard will open (or is already open)
            return (
                <div className={`flex gap-3 ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
                    {isAssistant && (
                        <div className="h-8 w-8 rounded-lg bg-meta-gradient flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                            <img src={roboAiIcon} alt="AI" className="h-5 w-5 brightness-0 invert" />
                        </div>
                    )}
                    <div className="max-w-[85%] rounded-xl p-3.5 text-sm shadow-sm bg-white dark:bg-card border border-border/50 rounded-tl-none">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">🎨 Selecione os criativos no painel acima</p>
                    </div>
                </div>
            );
        }

        if (isValidDropdownType && message.structuredData.data && message.structuredData.data.length > 0) {
            return (
                <div className={`flex gap-3 ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
                    {isAssistant && (
                        <div className="h-8 w-8 rounded-lg bg-meta-gradient flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                            <img src={roboAiIcon} alt="AI" className="h-5 w-5 brightness-0 invert" />
                        </div>
                    )}
                    <div className="max-w-[85%] rounded-xl p-3.5 text-sm shadow-sm bg-white dark:bg-card border border-border/50 rounded-tl-none">
                        <StructuredDataDropdown
                            dataType={message.structuredData.type as 'pixels' | 'identities' | 'creatives' | 'urls' | 'interests'}
                            data={message.structuredData.data}
                            message={message.content}
                        />
                    </div>
                </div>
            );
        }
    } else {
    }

    return (
        <div className={`flex gap-3 ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
            {isAssistant && (
                <div className="h-8 w-8 rounded-lg bg-meta-gradient flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <img src={roboAiIcon} alt="AI" className="h-5 w-5 brightness-0 invert" />
                </div>
            )}

            <div
                className={`max-w-[85%] rounded-xl p-3.5 text-sm shadow-sm ${!isAssistant
                    ? 'bg-blue-500 text-white rounded-tr-none'
                    : 'bg-white dark:bg-card border border-border/50 rounded-tl-none'
                    }`}
            >
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    <ReactMarkdown
                        components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
                            code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                            pre: ({ children }) => <pre className="bg-muted p-2 rounded-lg overflow-x-auto text-xs font-mono mb-2">{children}</pre>,
                            strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                        }}
                    >
                        {displayedContent}
                    </ReactMarkdown>
                    {shouldAnimate && displayedContent.length < message.content.length && (
                        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary animate-pulse align-middle" />
                    )}
                    {isCampaignCreated && draftCampaign && (
                        <Button
                            onClick={() => {
                                navigate('/campaigns?tab=campaigns', {
                                    state: {
                                        openDraftEditor: true,
                                        draftData: draftCampaign,
                                        accountId: selectedAccountId
                                    }
                                });
                                setActiveDraftCard(false);
                            }}
                            className="w-full mt-3 bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg transition-all group"
                        >
                            Ver campanha criada
                            <ChevronRight className="h-4 w-4 ml-auto group-hover:translate-x-1 transition-transform" />
                        </Button>
                    )}
                </div>
            </div>

            {!isAssistant && (
                <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">VC</span>
                </div>
            )}
        </div>
    );
}
