import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLadsAI } from '@/hooks/useLadsAI';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';

interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'function';
    content: string;
    functionCall?: {
        name: string;
        arguments: any;
    };
    structuredData?: {
        type: 'pixels' | 'identities' | 'creatives' | 'urls' | 'interests' | 'campaign_created' | 'interest_selector' | 'location_selector';
        data?: any[];
        campaignName?: string;
        totalAdSets?: number;
        totalAds?: number;
        draftId?: string;
        requiredCount?: number; // For creative selection wizard
        initialQuery?: string; // For interest selector
        accountId?: string; // For interest selector
    };
}

// Creative wizard data types
interface CreativeForWizard {
    id: string;
    hash?: string;
    name: string;
    url: string;
    thumbnail?: string;
    type: 'image' | 'video';
}

interface CreativeWizardData {
    campaignName: string;
    adSets: {
        id: string;
        name: string;
        ads: { id: string; name: string }[];
    }[];
    creatives: CreativeForWizard[];
}

interface CreativeAssignment {
    adId: string;
    adSetId: string;
    creative: CreativeForWizard;
}

interface ChatContextType {
    messages: Message[];
    isLoading: boolean;
    input: string;
    setInput: (input: string) => void;
    sendMessage: (content?: string) => Promise<void>;
    addMessage: (message: Message) => void;
    clearMessages: () => void;
    resetChat: () => void; // New: Full reset for error recovery
    pendingFunctionCall: { name: string; args: any } | null;
    // Draft Card Update System (legacy)
    draftCardUpdate: DraftCardUpdate | null;
    consumeDraftUpdate: () => DraftCardUpdate | null;
    // New Draft System (inline rendering)
    activeDraftCard: boolean;
    setActiveDraftCard: (active: boolean) => void;
    draftCampaign: DraftCampaign | null;
    setDraftCampaign: (draft: DraftCampaign | null) => void;
    // Creative Selection Wizard
    creativeWizardData: CreativeWizardData | null;
    setCreativeWizardData: (data: CreativeWizardData | null) => void;
    creativesProcessed: boolean;
    applyCreativeAssignments: (assignments: CreativeAssignment[]) => void;
    refreshAccountDefaults: () => Promise<void>;
    // Pre-selected creatives from Library
    preSelectedCreatives: any[];
    setPreSelectedCreatives: (creatives: any[]) => void;
}

// Draft Campaign structures for inline rendering
interface DraftAd {
    id: string; // Temporary ID like 'draft-ad-1'
    name: string;
    adSetId: string;
    primaryText: string;
    headline: string;
    description: string;
    destinationUrl: string;
    pageId: string;
    pageName?: string;
    pixelId?: string; // Pixel ID from parent adset's promoted_object
    instagramActorId?: string; // Instagram account ID for the ad
    creativeHash?: string; // Hash of creative/media file
    creativeName?: string; // Name of creative file
    creativeUrl?: string; // URL to display the creative (video URL for videos)
    creativeThumbnail?: string; // 🖼️ Thumbnail URL (image) for video previews
    creativeType?: string; // 'image' or 'video'
    urlParameters?: string; // URL tracking parameters
    ctaType?: string; // Call-to-action button type (SHOP_NOW, LEARN_MORE, etc.)
    status: 'DRAFT';
}

interface DraftAdSet {
    id: string; // Temporary ID like 'draft-adset-1'
    name: string;
    campaignId: string;
    dailyBudget: string; // ABO budget
    targeting: any;
    status: 'DRAFT';
    ads: DraftAd[];
    promotedObject?: {
        pixelId?: string;
        customEventType?: string;
        objectStoreUrl?: string;
    };
    // Advanced Fields
    optimizationGoal?: string;
    attributionSpec?: string;
    conversionEvent?: string;
    billingEvent?: string;
    bidAmount?: number | null;
    startTime?: string;
    endTime?: string | null;
}

interface DraftCampaign {
    id: string; // Temporary ID like 'draft-campaign-1'
    name: string;
    objective: string;
    budget: string; // CBO budget
    dailyBudget: string; // Used for display
    status: 'DRAFT';
    adSets: DraftAdSet[];
    createdAt: Date;

    // Advanced Fields
    advantageCampaignBudget?: boolean; // New field for CBO flag
    specialAdCategories?: string[];
    bidStrategy?: string; // LOWEST_COST_WITHOUT_CAP, etc.
    buyingType?: string; // AUCTION, etc.
    budgetStrategy?: 'CBO' | 'ABO'; // Helper for UI
    startTime?: string;

    // 🆕 Catalog Fields (Advantage+ Catalog)
    advantageCatalog?: boolean;
    productCatalogId?: string;
    productCatalogName?: string;
    productSetId?: string;
    productSetName?: string;
}


// Update operation types for Draft Card (legacy, will be simplified)
interface DraftCardUpdate {
    operation: 'update_all_ads' | 'update_specific_ad' | 'update_all_adsets' | 'update_specific_adset' | 'update_campaign' | 'copy_ad_to_all' | 'add_adsets' | 'add_ads' | 'add_primary_texts';
    adSetIndex?: number;
    adIndex?: number;
    fields: Record<string, any>; // Now includes page_name, destination_url, etc.
    // New fields for array operations
    count?: number;
    textsList?: string[];
    confirmationMessage?: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Helper to safely parse localStorage JSON
const safeParseJSON = <T,>(key: string, defaultValue: T): T => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
    } catch {
        return defaultValue;
    }
};

// 🔧 Helper to parse relative dates (tomorrow, today, now) to ISO strings
const parseRelativeDate = (dateInput: string | undefined): string => {
    if (!dateInput) return new Date().toISOString();

    const input = dateInput.toLowerCase().trim();
    const now = new Date();

    // If already a valid ISO date, return as-is
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateInput)) {
        return dateInput;
    }

    // Parse "tomorrow" - next day at 08:00
    if (input === 'tomorrow' || input === 'amanhã' || input === 'amanha') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        return tomorrow.toISOString();
    }

    // Parse "today" - today at next full hour
    if (input === 'today' || input === 'hoje') {
        const today = new Date(now);
        today.setHours(today.getHours() + 1, 0, 0, 0);
        return today.toISOString();
    }

    // Parse "now" - 15 minutes from now
    if (input === 'now' || input === 'agora') {
        const soon = new Date(now);
        soon.setMinutes(soon.getMinutes() + 15);
        return soon.toISOString();
    }

    // If contains "at" time specification (e.g., "tomorrow at 5pm")
    const timeMatch = input.match(/(\d{1,2})\s*(am|pm|h|:)/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        if (timeMatch[2]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (timeMatch[2]?.toLowerCase() === 'am' && hours === 12) hours = 0;

        const targetDate = input.includes('tomorrow') || input.includes('amanhã')
            ? new Date(now.setDate(now.getDate() + 1))
            : new Date();
        targetDate.setHours(hours, 0, 0, 0);
        return targetDate.toISOString();
    }

    // Default: return input if not recognized (might be ISO already)
    return dateInput;
};

// 🔇 SILENT EXECUTION: Filter out technical text from AI responses
// Removes patterns like "[Chama X]", "[Chamar Y]", "Um momento...", etc.
const filterTechnicalText = (text: string): string => {
    if (!text) return text;

    let filtered = text
        // Remove patterns like [Chama getAccountPixels], [Chamar searchMetaInterests com query "joias"]
        .replace(/\[Chama[r]?\s+[^\]]+\]/gi, '')
        // Remove patterns like [Chame getAccountPixels]
        .replace(/\[Chame\s+[^\]]+\]/gi, '')
        // Remove "Um momento..." or "Um instante..."
        .replace(/Um\s+(momento|instante)[\.!]*/gi, '')
        // Remove "Vou buscar..." patterns
        .replace(/Vou\s+buscar\s+[^\.]+\.\.\./gi, '')
        // Remove "Buscando..." patterns  
        .replace(/Buscando\s+[^\.]+\.\.\./gi, '')
        // 🌍 Remove __AUTO_LOCATION__ technical markers
        .replace(/\n*__AUTO_LOCATION__.+?__END__/g, '')
        // Remove multiple consecutive newlines
        .replace(/\n{3,}/g, '\n\n')
        // Trim whitespace
        .trim();

    return filtered;
};

export function ChatProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [pendingFunctionCall, setPendingFunctionCall] = useState<{ name: string; args: any } | null>(null);
    const [draftCardUpdate, setDraftCardUpdate] = useState<DraftCardUpdate | null>(null);
    const [accountDefaults, setAccountDefaults] = useState<any>(null); // 🆕 Estado para padrões da conta
    // 🔧 PERSISTIR: Estado do draft persiste entre navegações
    const [activeDraftCard, setActiveDraftCard] = useState(() => safeParseJSON('lads_active_draft', false));
    const [draftCampaign, setDraftCampaign] = useState<DraftCampaign | null>(() => safeParseJSON('lads_draft_campaign', null));
    // 🎨 Creative Selection Wizard state
    const [creativeWizardData, setCreativeWizardData] = useState<CreativeWizardData | null>(null);
    // 🔒 Flag to prevent re-triggering wizard after creatives applied (PERSISTED)
    const [creativesProcessed, setCreativesProcessed] = useState(() => safeParseJSON('lads_creatives_processed', false));
    const [pendingCampaignProposal, setPendingCampaignProposal] = useState<any | null>(null);
    const [preSelectedCreatives, setPreSelectedCreatives] = useState<any[]>([]); // Pre-selected creatives from Library
    const [pendingSelectedInterests, setPendingSelectedInterests] = useState<{ id: string; name: string }[]>([]);
    const [pendingSelectedLocations, setPendingSelectedLocations] = useState<{ key: string; name: string; type: string }[]>([]);
    const { selectedAccountId, selectedClientId } = useDashboard();

    const isInitialLoad = useRef(true);
    const [currentAccountName, setCurrentAccountName] = useState<string | null>(null);
    const hasWelcomeMessageRef = useRef(false);
    const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 🔧 PERSISTIR: Salvar estado do draft quando mudar
    useEffect(() => {
        localStorage.setItem('lads_active_draft', JSON.stringify(activeDraftCard));
    }, [activeDraftCard]);

    useEffect(() => {
        if (draftCampaign) {
            localStorage.setItem('lads_draft_campaign', JSON.stringify(draftCampaign));
        } else {
            localStorage.removeItem('lads_draft_campaign');
        }
    }, [draftCampaign]);

    // 🔒 PERSISTIR: Salvar creativesProcessed quando mudar
    useEffect(() => {
        localStorage.setItem('lads_creatives_processed', JSON.stringify(creativesProcessed));
    }, [creativesProcessed]);

    // Consume draft update (returns and clears the update)
    const consumeDraftUpdate = useCallback(() => {
        const update = draftCardUpdate;
        if (update) {
            setDraftCardUpdate(null);
        }
        return update;
    }, [draftCardUpdate]);

    // Carregar nome da conta e PADRÕES (Page/Pixel) ao trocar de conta
    const fetchAccountDetails = useCallback(async () => {
        if (!selectedAccountId) {
            setCurrentAccountName(null);
            setAccountDefaults(null);
            return;
        }

        // Persistence Check: Só limpar se mudou DE FATO a conta (não no refresh)
        const lastAccountId = localStorage.getItem('last_chat_account_id');

        // 🚨 FIX: Se não houver lastAccountId, assume que é uma troca inicial
        // Se houver e for diferente, é uma troca explicita -> Resetar tudo
        const isRefreshed = lastAccountId === selectedAccountId;

        console.log(`🔎 [ChatContext] Sync Check: Last=${lastAccountId} Current=${selectedAccountId} Refreshed=${isRefreshed}`);

        if (!isRefreshed) {
            console.log('🔄 [ChatContext] Conta alterada (ou nova sessão). Limpando chat.');

            // 🧹 LIMPEZA COMPLETA DE ESTADO
            setMessages([]);
            setAccountDefaults(null);
            setCurrentAccountName(null);

            // 🧹 Limpar localStorage antigo
            localStorage.removeItem('lads_chat_history');

            // 🧹 Reiniciar flags
            hasWelcomeMessageRef.current = false;

            // Salvar nova conta atual
            localStorage.setItem('last_chat_account_id', selectedAccountId);
        } else {
            console.log('♻️ [ChatContext] Refresh detectado (mesma conta). Mantendo histórico.');
        }

        try {
            // 1. Fetch Account Name
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('name')
                .eq('id', selectedAccountId)
                .single();

            if (accountData) {
                setCurrentAccountName(accountData.name);
            }

            // 2. Fetch Account Defaults (Page/Pixel/Domain)
            console.log('🔍 [ChatContext] Buscando padrões da conta:', selectedAccountId);
            const { data: defaultsData } = await (supabase as any)
                .from('account_settings')
                .select('default_page_id, default_page_name, default_pixel_id, default_pixel_name, default_domain, default_instagram_id, default_instagram_name')
                .eq('ad_account_id', selectedAccountId)
                .maybeSingle();

            if (defaultsData) {
                console.log('✅ [ChatContext] Padrões encontrados:', defaultsData);
                setAccountDefaults(defaultsData);
            } else {
                console.log('ℹ️ [ChatContext] Nenhum padrão encontrado para esta conta.');
                setAccountDefaults(null);
            }

        } catch (error) {
            console.error('Error fetching account details:', error);
        }
    }, [selectedAccountId]);

    useEffect(() => {
        fetchAccountDetails();
    }, [fetchAccountDetails]);

    // Persistência: Carregar mensagens do localStorage ao iniciar
    useEffect(() => {
        const savedMessages = localStorage.getItem('lads_chat_history');
        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    hasWelcomeMessageRef.current = true; // Assumir que já tem boas-vindas se tem histórico
                }
            } catch (e) {
                console.error('Failed to parse chat history', e);
            }
        }
        isInitialLoad.current = false;
    }, []);

    // Persistência: Salvar mensagens no localStorage sempre que mudar
    useEffect(() => {
        if (!isInitialLoad.current) {
            localStorage.setItem('lads_chat_history', JSON.stringify(messages));
        }
    }, [messages]);

    // Lógica de Boas-vindas
    useEffect(() => {
        if (isInitialLoad.current) return;

        // Só injetar se: tem nome da conta, não tem mensagens, e ainda não injetou nesta sessão
        if (currentAccountName && messages.length === 0 && !hasWelcomeMessageRef.current) {
            const welcomeMsg: Message = {
                id: 'welcome',
                role: 'assistant',
                content: `Hi! I'm connected to **${currentAccountName}**. I can help create campaigns, analyze data, or adjust budgets. Where should we start?`
            };
            setMessages([welcomeMsg]);
            hasWelcomeMessageRef.current = true;
        }
    }, [currentAccountName, messages.length]);

    // Define handleFunctionCall separately to allow recursive calls
    const handleFunctionCall = async (functionName: string, args: any) => {
        console.log(`🔧 [ChatContext] Function call recebida: ${functionName}`);
        setPendingFunctionCall({ name: functionName, args });

        // This block handles the case where applyCreativeAssignments has been called
        // and we need to resume a pending campaign proposal with the creative assignments.
        if (pendingCampaignProposal) {
            console.log('🏗️ [ChatContext] Resuming pending proposal with assignments');
            // Re-run the proposal handler with the assignments injected
            // We need to inject the creative hash into the ads of the proposal

            // Clone the proposal to avoid mutating state directly
            const updatedProposal = JSON.parse(JSON.stringify(pendingCampaignProposal));

            // 🔴 DEBUG: Track budget_strategy through creative wizard flow
            console.log('🔴 [ChatContext] CREATIVE WIZARD FLOW - budget_strategy:', {
                'pendingCampaignProposal.budget_strategy': pendingCampaignProposal.budget_strategy,
                'updatedProposal.budget_strategy': updatedProposal.budget_strategy,
                'updatedProposal.campaign?.budget_strategy': updatedProposal.campaign?.budget_strategy
            });

            const campaignData = updatedProposal.campaign || updatedProposal;

            // Get text defaults from campaign or first ad for fallback (fixes placeholder text issue)
            const defaultCopy = {
                primary_text: campaignData.copy?.primary_text || campaignData.primary_text || updatedProposal.adsets?.[0]?.ads?.[0]?.copy?.primary_text || '',
                headline: campaignData.copy?.headline || campaignData.headline || updatedProposal.adsets?.[0]?.ads?.[0]?.copy?.headline || '',
                description: campaignData.copy?.description || campaignData.description || updatedProposal.adsets?.[0]?.ads?.[0]?.copy?.description || ''
            };

            console.log('📝 [ChatContext] Default Copy Fallback:', defaultCopy);

            // Reconstruct the structure with explicit assignments
            // If the proposal had "placeholders" or implicit structure, we need to expand it now
            // based on the wizard's adSets structure which is the "truth" for the user

            // However, onFunctionCall logic (which we call next) re-generates the structure 
            // based on updatedProposal.adsets. So we need to update updatedProposal.adsets 
            // to match the Wizard's structure (which might have been expanded from 1-15-5 string)

            // 1. Get the structure from wizard assignments (grouped by set)
            const adSetMap = new Map<string, { adId: string; adSetId: string; creative: CreativeForWizard }[]>();
            (args as CreativeAssignment[]).forEach(a => { // Assuming 'args' here are the CreativeAssignments
                const existing = adSetMap.get(a.adSetId) || [];
                existing.push(a);
                adSetMap.set(a.adSetId, existing);
            });

            // 2. Expand/Overwrite updatedProposal.adsets to match wizard count (e.g. 15 sets)
            // If AI only sent 1 adset but user requested 15, onFunctionCall would execute logic again.
            // But we can preemptively populate 'updatedProposal.adsets' with the mapped creatives AND COPY.

            // We need to know how many sets/ads we have now.
            // Safest way: Let onFunctionCall do the expansion, BUT we need to provide it with
            // an adsets array that HAS the creative_hash for the *correct indices*.

            // But onFunctionCall uses `adsetsData[adsetIdx]` which might loop/reuse if not enough provided.
            // So we should expand `updatedProposal.adsets` here to be fully explicit.

            const numAdSetsInWizard = new Set((args as CreativeAssignment[]).map(a => a.adSetId)).size;
            // Or better, use the structure string to determine target count, just like onFunctionCall does.
            const structureString = updatedProposal.structure || updatedProposal.campaign?.structure || '1-1-1';
            const parts = structureString.split('-').map(Number);
            const targetAdSets = isNaN(parts[1]) || parts[1] < 1 ? 1 : Math.min(parts[1], 50);
            const targetAdsPerSet = isNaN(parts[2]) || parts[2] < 1 ? 1 : Math.min(parts[2], 50);

            console.log(`📊 [ChatContext] Ensuring proposal has ${targetAdSets} x ${targetAdsPerSet} explicit structure`);

            const expandedAdSets = Array.from({ length: targetAdSets }, (_, setIdx) => {
                // Get source AI adset (reuse/loop if needed, or use first)
                const sourceAdSet = updatedProposal.adsets?.[setIdx] || updatedProposal.adsets?.[0] || {};

                // Get assignments for this specific "draft-adset-X" ID from wizard
                const wizardSetId = `draft-adset-${setIdx}`;
                const setAssignments = adSetMap.get(wizardSetId) || [];

                // 🔧 FIX: Gerar nome único para adset em vez de usar nome duplicado da IA
                let uniqueAdsetName = sourceAdSet.name || '';
                if (!uniqueAdsetName || uniqueAdsetName.toLowerCase().includes('conjunto 1') || uniqueAdsetName.toLowerCase().includes('conjunto 2')) {
                    const audienceMode = sourceAdSet.targeting?.audience_mode === 'manual' ? 'Manual' : 'Adv+';
                    const genderHint = sourceAdSet.targeting?.genders?.includes(2) ? 'Feminino' :
                        sourceAdSet.targeting?.genders?.includes(1) ? 'Masculino' : '';
                    uniqueAdsetName = `CJ${setIdx + 1}${genderHint ? ' - ' + genderHint : ''} ${audienceMode}`;
                }

                return {
                    ...sourceAdSet,
                    name: uniqueAdsetName,
                    ads: Array.from({ length: targetAdsPerSet }, (_, adIdx) => {
                        const sourceAd = sourceAdSet.ads?.[adIdx] || sourceAdSet.ads?.[0] || {};
                        const wizardAdId = `draft-ad-${setIdx}-${adIdx}`;
                        const assignment = setAssignments.find(a => a.adId === wizardAdId);

                        // Determine copy (specific -> source -> default/fallback)
                        const adCopy = {
                            primary_text: sourceAd.copy?.primary_text || sourceAd.primary_text || defaultCopy.primary_text,
                            headline: sourceAd.copy?.headline || sourceAd.headline || defaultCopy.headline,
                            description: sourceAd.copy?.description || sourceAd.description || defaultCopy.description,
                        };

                        // 🎥 FIX: Use creative_type to distinguish video vs image
                        const isVideo = assignment?.creative?.type?.toLowerCase() === 'video';

                        return {
                            ...sourceAd,
                            name: sourceAd.name || `Anúncio ${adIdx + 1}`,
                            // Use video_id for videos, creative_hash for images
                            creative_hash: isVideo ? undefined : (assignment ? (assignment.creative.hash || assignment.creative.id) : null),
                            video_id: isVideo ? (assignment?.creative.id || null) : undefined,
                            // Explicitly set copy here so next step picks it up
                            copy: adCopy,
                            primary_text: adCopy.primary_text, // Add flattened fields just in case
                            headline: adCopy.headline,
                            description: adCopy.description
                        };
                    })
                };
            });

            // Update the proposal with the fully expanded structure
            if (updatedProposal.campaign) {
                updatedProposal.campaign.adsets = expandedAdSets;
            } else {
                updatedProposal.adsets = expandedAdSets;
            }

            // Clear pending proposal
            setPendingCampaignProposal(null);

            // Call onFunctionCall again with the updated, creative-enriched, fully expanded arguments
            const funcName = updatedProposal.campaign ? 'createCampaignDraft' : 'propose_campaign_structure';
            handleFunctionCall(funcName, updatedProposal); // Recursive call
            return;
        }

        // NEW DRAFT SYSTEM: Create inline draft from AI proposal
        if (functionName === 'propose_campaign_structure' || functionName === 'createCampaignDraft') {
            console.log('🎨 [ChatContext] Criando rascunho inline:', JSON.stringify(args, null, 2));
            console.log('🔧 [ChatContext] accountDefaults disponíveis:', accountDefaults);

            // 🎯 CREATIVE ENFORCEMENT: Check if we need to collect creatives first
            // Reset flag for new campaign flow to ensure wizard can trigger again
            setCreativesProcessed(false);

            const hasCreativeHash = args.adsets?.some((adset: any) =>
                adset.ads?.some((ad: any) => ad.creative_hash || ad.creativeHash)
            );

            // 🔒 VALIDATION FUNCTION: Check all required fields before opening creative wizard
            const validateCampaignRequirements = (campaignArgs: any): { isValid: boolean; missing: string[] } => {
                const missing: string[] = [];
                const campaignData = campaignArgs.campaign || campaignArgs;

                // Check for pixel_id (required for SALES objective)
                const objective = campaignData.objective || 'SALES';
                if (objective === 'SALES' || objective === 'OUTCOME_SALES' || objective === 'OFFSITE_CONVERSIONS') {
                    const pixelId = campaignArgs.pixel_id || campaignData.pixel_id ||
                        campaignArgs.adsets?.[0]?.promoted_object?.pixel_id ||
                        accountDefaults?.default_pixel_id;
                    if (!pixelId || (typeof pixelId === 'string' && !/^\d+$/.test(pixelId))) {
                        // Check if it's a name that can be resolved - allow names if we have defaults
                        if (!accountDefaults?.default_pixel_id) {
                            missing.push('pixel_id');
                        }
                    }
                }

                // Check for page_id
                const pageId = campaignArgs.page_id || campaignData.page_id || accountDefaults?.default_page_id;
                if (!pageId || (typeof pageId === 'string' && !/^\d+$/.test(pageId))) {
                    if (!accountDefaults?.default_page_id) {
                        missing.push('page_id');
                    }
                }

                // Check for geo_locations
                const targeting = campaignArgs.targeting || campaignData.targeting || campaignArgs.adsets?.[0]?.targeting;
                const hasGeo = targeting?.geo_locations?.countries?.length > 0 ||
                    targeting?.geo_locations?.cities?.length > 0 ||
                    targeting?.geo_locations?.regions?.length > 0;
                if (!hasGeo) {
                    missing.push('geo_locations (location targeting)');
                }

                // Check for budget
                if (!campaignData.budget || campaignData.budget <= 0) {
                    missing.push('budget');
                }

                console.log('🔒 [ChatContext] Validation result:', { isValid: missing.length === 0, missing });
                return { isValid: missing.length === 0, missing };
            };

            if (!hasCreativeHash) {
                // 🔒 VALIDATE REQUIRED FIELDS BEFORE OPENING WIZARD
                const validation = validateCampaignRequirements(args);

                if (!validation.isValid) {
                    console.error('❌ [ChatContext] Cannot open creative wizard - missing required fields:', validation.missing);

                    // Send message to AI asking for missing information
                    const errorMsg: Message = {
                        id: `validation-error-${Date.now()}`,
                        role: 'assistant',
                        content: `⚠️ **Missing Required Information**\n\nBefore we can proceed to creative selection, I still need:\n${validation.missing.map(f => `- **${f.replace(/_/g, ' ')}**`).join('\n')}\n\nPlease provide this information so I can complete your campaign setup.`
                    };
                    setMessages(prev => [...prev, errorMsg]);
                    return;
                }

                console.log('✅ [ChatContext] Validation passed!');

                // Store the proposal for later (will be used by applyCreativeAssignments)
                setPendingCampaignProposal(args);

                // Calculate how many creatives we need
                const structureString = args.structure || args.campaign?.structure || '1-1-1';
                const parts = structureString.split('-').map(Number);
                const numAdSets = isNaN(parts[1]) || parts[1] < 1 ? 1 : Math.min(parts[1], 50);
                const numAdsPerSet = isNaN(parts[2]) || parts[2] < 1 ? 1 : Math.min(parts[2], 50);
                const requiredCount = numAdSets * numAdsPerSet;

                console.log(`📊 [ChatContext] Structure needs ${requiredCount} creatives. Pre-selected: ${preSelectedCreatives.length}`);

                // 🧠 SMART WIZARD LOGIC: Skip wizard if we have enough pre-selected creatives
                if (preSelectedCreatives.length >= requiredCount) {
                    console.log('🚀 [ChatContext] Enough pre-selected creatives! Skipping wizard, direct creation...');

                    // Create creative assignments from pre-selected
                    const assignments: CreativeAssignment[] = [];
                    let creativeIndex = 0;
                    for (let setIdx = 0; setIdx < numAdSets; setIdx++) {
                        for (let adIdx = 0; adIdx < numAdsPerSet; adIdx++) {
                            const creative = preSelectedCreatives[creativeIndex % preSelectedCreatives.length];
                            assignments.push({
                                adId: `draft-ad-${setIdx}-${adIdx}`,
                                adSetId: `draft-adset-${setIdx}`,
                                creative: {
                                    id: creative.id,
                                    hash: creative.hash,
                                    url: creative.url || creative.thumbnail,
                                    type: creative.type || 'IMAGE',
                                    name: creative.name
                                }
                            });
                            creativeIndex++;
                        }
                    }

                    // Clear pre-selected creatives
                    setPreSelectedCreatives([]);

                    // Apply assignments directly (this will create the campaign)
                    applyCreativeAssignments(assignments);

                    const successMsg: Message = {
                        id: `creatives-auto-${Date.now()}`,
                        role: 'assistant',
                        content: `🎨 **Criativos Atribuídos**\n\nUsando ${Math.min(preSelectedCreatives.length, requiredCount)} criativo(s) selecionado(s) da biblioteca. Criando campanha...`
                    };
                    setMessages(prev => [...prev, successMsg]);
                    return;
                }

                // Not enough pre-selected - need to open wizard
                console.log('⚠️ [ChatContext] Need more creatives. Opening wizard...');

                // 🎨 BUILD WIZARD DATA AND OPEN IT AUTOMATICALLY
                const campaignData = args.campaign || args;

                // 🧠 SMART WIZARD CONSTRUCTION:
                // Always build exactly the number of Ad Sets requested in structure (numAdSets).
                // If AI provided fewer adsets than requested, reuse the first one's structure or placeholders.
                const wizardAdSets = Array.from({ length: numAdSets }, (_, adsetIdx) => {
                    const aiAdset = args.adsets?.[adsetIdx] || args.adsets?.[0] || {};

                    // Determine ads for this set
                    // If explicit adset exists and has ads, use them.
                    // Otherwise fallback to numAdsPerSet from structure string.
                    const hasExplicitAds = Array.isArray(aiAdset.ads) && aiAdset.ads.length > 0;

                    // 🔒 STRICT STRUCTURE ENFORCEMENT: Even if AI hallucinates 3 ads in array, if structure says Z=1, we clamp it using MIN.
                    const adsCount = hasExplicitAds ? Math.min(aiAdset.ads.length, Math.max(numAdsPerSet, 1)) : numAdsPerSet;

                    // 🔧 FIX: Gerar nome único para adset usando índice
                    // Se a IA forneceu nome duplicado (ex: "Conjunto 1" para todos), gerar nome único
                    let aiName = aiAdset.name || args.adsets?.[adsetIdx]?.name || '';
                    let uniqueName = aiName;

                    // Se não tem nome, ou o nome é genérico/duplicado, gerar nome único
                    if (!aiName || aiName.toLowerCase().includes('conjunto 1') || aiName.toLowerCase().includes('conjunto 2')) {
                        const audienceMode = aiAdset.targeting?.audience_mode === 'manual' ? 'Manual' : 'Adv+';
                        const genderHint = aiAdset.targeting?.genders?.includes(2) ? 'Feminino' :
                            aiAdset.targeting?.genders?.includes(1) ? 'Masculino' : '';
                        uniqueName = `CJ${adsetIdx + 1}${genderHint ? ' - ' + genderHint : ''} ${audienceMode}`;
                    }

                    return {
                        id: `draft-adset-${adsetIdx}`,
                        name: uniqueName,
                        ads: Array.from({ length: adsCount }, (_, adIdx) => ({
                            id: `draft-ad-${adsetIdx}-${adIdx}`,
                            name: (hasExplicitAds ? aiAdset.ads[adIdx]?.name : undefined) || `Anúncio ${adIdx + 1}`
                        }))
                    };
                });

                // Recalculate total required count based on the actual wizard structure
                const totalAdsInWizard = wizardAdSets.reduce((sum: number, set: any) => sum + set.ads.length, 0);
                console.log(`📊 [ChatContext] Wizard pronto com ${wizardAdSets.length} conjuntos e ${totalAdsInWizard} slots de criativos.`);

                // Add a message to inform the user
                const creativesMsg: Message = {
                    id: `creatives-wizard-${Date.now()}`,
                    role: 'assistant',
                    content: requiredCount === 1
                        ? `🎨 **Selecione o Criativo**\n\nAgora preciso que você escolha a imagem ou vídeo para o anúncio da sua campanha.\n\nO seletor vai abrir em instantes...`
                        : `🎨 **Selecione os Criativos**\n\nAgora preciso que você escolha as imagens/vídeos para os ${requiredCount} anúncios da sua campanha.\n\nO seletor vai abrir em instantes...`
                };
                setMessages(prev => [...prev, creativesMsg]);

                // Open wizard after a short delay so user sees the message
                // Use preSelectedCreatives if they were set from Library, otherwise wizard will fetch its own
                const storedCreatives = preSelectedCreatives.length > 0 ? preSelectedCreatives : [];
                if (preSelectedCreatives.length > 0) {
                    console.log('🎨 [ChatContext] Using pre-selected creatives from Library:', preSelectedCreatives.length);
                    setPreSelectedCreatives([]); // Clear after use
                }

                setTimeout(() => {
                    setCreativeWizardData({
                        campaignName: campaignData.campaignName || campaignData.name || 'Nova Campanha',
                        adSets: wizardAdSets,
                        creatives: storedCreatives // Use stored creatives or empty array
                    });
                }, 1000);

                return;
            }

            // Handle both old schema (structure.adsets) and new schema (args.campaign + args.adsets)
            const campaignData = args.campaign || args; // New schema has campaign object
            let adsetsData = args.adsets || args.structure?.adsets || campaignData.adsets || [];
            const timestamp = Date.now();

            // 🔧 STRUCTURE-FIRST APPROACH: Always parse structure string and merge AI data
            const structureString = args.structure || campaignData.structure || '1-1-1';

            // Log incoming targeting data for debugging
            console.log('📊 [ChatContext] Dados de targeting recebidos:', {
                'args.targeting': args.targeting,
                'campaignData.targeting': campaignData.targeting,
                'adsetsData from AI': adsetsData.length,
                'structureString': structureString
            });

            // Parse structure string (e.g., "1-3-3" = 1 campaign, 3 ad sets, 3 ads per set)
            let numAdSets = 1;
            let numAdsPerSet = 1;

            if (typeof structureString === 'string' && structureString.includes('-')) {
                console.log('🔄 [ChatContext] Interpretando structure string:', structureString);
                const parts = structureString.split('-').map(Number);
                numAdSets = isNaN(parts[1]) || parts[1] < 1 ? 1 : Math.min(parts[1], 50);
                numAdsPerSet = isNaN(parts[2]) || parts[2] < 1 ? 1 : Math.min(parts[2], 50);
            }

            console.log(`📐 [ChatContext] Estrutura esperada: ${numAdSets} conjuntos, ${numAdsPerSet} anúncios cada`);

            // Get default targeting from AI (either from top-level or first adset)
            const defaultTargeting = args.targeting || campaignData.targeting || adsetsData[0]?.targeting || { countries: ['BR'] };

            // Get default data from first AI adset/ad if available (for propagation)
            const firstAIAdset = adsetsData[0] || {};
            const firstAIAd = firstAIAdset.ads?.[0] || adsetsData.flatMap((a: any) => a.ads || []).find((ad: any) =>
                ad.copy?.primary_text || ad.copy?.headline || ad.destination_url
            ) || {};

            console.log('🎯 [ChatContext] Dados padrão para propagação:', {
                targeting: defaultTargeting,
                firstAdset: firstAIAdset.name,
                firstAd: firstAIAd.name,
                hasTexts: !!(firstAIAd.copy?.primary_text || firstAIAd.copy?.headline)
            });


            // 🔧 GENERATE SKELETON: Create the correct number of ad sets and ads
            const generatedAdsetsData = Array.from({ length: numAdSets }, (_, adsetIdx) => {
                // Get AI data for this adset index if available
                const aiAdset = adsetsData[adsetIdx] || {};

                // For targeting: use this adset's targeting, fall back to default
                // 🔧 FIX: Merge geo_locations from top-level if adset has empty geo_locations
                const aiTargeting = aiAdset.targeting || {};
                const hasValidGeo = aiTargeting.geo_locations &&
                    (aiTargeting.geo_locations.countries?.length > 0 ||
                        aiTargeting.geo_locations.cities?.length > 0 ||
                        aiTargeting.geo_locations.regions?.length > 0);

                // If adset has no valid geo, use the top-level default
                const rawTargeting = hasValidGeo
                    ? aiTargeting
                    : { ...aiTargeting, geo_locations: defaultTargeting.geo_locations };

                const adsetTargeting = normalizeTargeting(rawTargeting);

                // Generate ads for this adset
                const generatedAds = Array.from({ length: numAdsPerSet }, (_, adIdx) => {
                    // Get AI ad data: first try this specific slot, then first AI ad for propagation
                    const aiAd = aiAdset.ads?.[adIdx] || {};
                    const fallbackAd = firstAIAd;

                    //  Campaign-level copy as additional fallback
                    const campaignCopy = campaignData.copy || args.copy || {};

                    return {
                        name: aiAd.name || `Anúncio ${adIdx + 1}`,
                        copy: {
                            // 🔧 ROBUST FALLBACK: Check nested AND flat properties, plus synonyms (text, message), plus campaign-level copy
                            primary_text: aiAd.copy?.primary_text || aiAd.copy?.text || aiAd.copy?.message ||
                                aiAd.primary_text || aiAd.primaryText ||
                                fallbackAd.copy?.primary_text || fallbackAd.copy?.text || fallbackAd.copy?.message ||
                                fallbackAd.primary_text ||
                                campaignCopy.primary_text || campaignCopy.text || '',
                            headline: aiAd.copy?.headline || aiAd.headline ||
                                fallbackAd.copy?.headline || fallbackAd.headline ||
                                campaignCopy.headline || '',
                            description: aiAd.copy?.description || aiAd.description ||
                                fallbackAd.copy?.description || fallbackAd.description ||
                                campaignCopy.description || '',
                            cta_type: aiAd.copy?.cta_type || aiAd.cta_type ||
                                fallbackAd.copy?.cta_type || fallbackAd.cta_type ||
                                campaignCopy.cta_type || 'SHOP_NOW'
                        },
                        // 🔧 FALLBACK: Use default domain if provided and AI's is empty
                        destination_url: aiAd.destination_url || fallbackAd.destination_url || campaignData.destination_url || args.destination_url || accountDefaults?.default_domain || '',
                        page_id: aiAd.page_id || fallbackAd.page_id || campaignData.page_id || args.page_id || accountDefaults?.default_page_id || '',
                        page_name: aiAd.page_name || fallbackAd.page_name || accountDefaults?.default_page_name || '',
                        // 🔧 FALLBACK: Use default pixel if provided and AI's is empty
                        pixel_id: aiAd.pixel_id || fallbackAd.pixel_id || campaignData.pixel_id || args.pixel_id || aiAdset.promoted_object?.pixel_id || firstAIAdset.promoted_object?.pixel_id || accountDefaults?.default_pixel_id || '',
                        // 🔧 FALLBACK: Use default instagram if provided and AI's is empty
                        instagram_actor_id: aiAd.instagram_actor_id || fallbackAd.instagram_actor_id || campaignData.instagram_actor_id || args.instagram_actor_id || accountDefaults?.default_instagram_id || ''
                    };
                });

                // 🔧 FIX: Gerar nome único SEMPRE usando índice
                // Se a IA só forneceu 1 adset mas structure pede 3, gerar nomes únicos
                let finalAdsetName = aiAdset.name || '';
                const alreadyHasUniquePattern = /^CJ\d+/.test(finalAdsetName); // Já tem padrão CJ1, CJ2...

                if (!finalAdsetName || !alreadyHasUniquePattern) {
                    // Gerar nome único baseado no índice e targeting
                    const audienceMode = adsetTargeting.audience_mode === 'manual' ? 'Manual' : 'Adv+';
                    const genderHint = adsetTargeting.genders?.includes(2) ? 'Fem' :
                        adsetTargeting.genders?.includes(1) ? 'Masc' : '';
                    finalAdsetName = `CJ${adsetIdx + 1}${genderHint ? ' ' + genderHint : ''} ${audienceMode}`;
                }

                return {
                    name: finalAdsetName,
                    targeting: adsetTargeting,
                    // 🔧 FIX: Use accountDefaults for promoted_object if not provided by AI
                    promotedObject: (aiAdset.promoted_object || firstAIAdset.promoted_object) ? {
                        pixelId: (aiAdset.promoted_object || firstAIAdset.promoted_object).pixel_id || (aiAdset.promoted_object || firstAIAdset.promoted_object).pixelId,
                        customEventType: (aiAdset.promoted_object || firstAIAdset.promoted_object).custom_event_type || (aiAdset.promoted_object || firstAIAdset.promoted_object).customEventType || 'PURCHASE'
                    } : (accountDefaults?.default_pixel_id ? {
                        pixelId: accountDefaults.default_pixel_id,
                        customEventType: 'PURCHASE'
                    } : undefined),
                    daily_budget: aiAdset.daily_budget || aiAdset.budget || '',
                    ads: generatedAds,
                    // Advanced Fields Mapping
                    optimizationGoal: aiAdset.optimization_goal || defaultTargeting.optimization_goal || 'OFFSITE_CONVERSIONS',
                    attributionSpec: aiAdset.attribution_spec || defaultTargeting.attribution_spec,
                    conversionEvent: aiAdset.conversion_event || 'PURCHASE',
                    billingEvent: aiAdset.billing_event || 'IMPRESSIONS',
                    bidAmount: aiAdset.bid_amount,
                    startTime: aiAdset.start_time,
                    endTime: aiAdset.end_time
                };
            });

            // Replace adsetsData with our generated structure
            adsetsData = generatedAdsetsData;

            console.log(`✅ [ChatContext] Gerado ${adsetsData.length} conjuntos com ${adsetsData[0]?.ads?.length} anúncios cada`);
            console.log('📦 [ChatContext] Estrutura final:', adsetsData.map((a: any) => ({
                name: a.name,
                adsCount: a.ads?.length,
                hasCopy: !!(a.ads?.[0]?.copy?.primary_text)
            })));


            // 🔧 Mapear objetivo da IA (SALES) para formato do frontend (OUTCOME_SALES)
            const objectiveMap: Record<string, string> = {
                'SALES': 'OUTCOME_SALES',
                'LEADS': 'OUTCOME_LEADS',
                'TRAFFIC': 'OUTCOME_TRAFFIC',
                'ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
                'AWARENESS': 'OUTCOME_AWARENESS',
                'PRODUCT_CATALOG_SALES': 'PRODUCT_CATALOG_SALES', // Catalog campaigns keep this objective
                // Também aceitar formatos já corretos
                'OUTCOME_SALES': 'OUTCOME_SALES',
                'OUTCOME_LEADS': 'OUTCOME_LEADS',
                'OUTCOME_TRAFFIC': 'OUTCOME_TRAFFIC',
                'OUTCOME_ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
                'OUTCOME_AWARENESS': 'OUTCOME_AWARENESS'
            };

            // Check for catalog campaign
            const isAdvantageCatalog = args.advantageCatalog === true || !!args.productCatalogId;
            const rawObjective = isAdvantageCatalog
                ? 'PRODUCT_CATALOG_SALES'
                : (campaignData.objective || args.objective || 'SALES');
            const mappedObjective = objectiveMap[rawObjective] || 'OUTCOME_SALES';

            // Gerar UUID para o rascunho (compatível com banco)
            const draftId = crypto.randomUUID();

            // 🔧 Determinar CBO vs ABO baseado nos dados
            // Priorizar valor explícito da IA (budget_strategy), senão inferir

            // 🔴 DEBUG: Step-by-step budget_strategy tracing
            console.log('🔴 [ChatContext] BUDGET_STRATEGY RAW VALUES:', {
                'args.budget_strategy': args.budget_strategy,
                'campaignData.budget_strategy': campaignData.budget_strategy,
                'campaignData.budgetStrategy': campaignData.budgetStrategy,
                'args.budget': args.budget,
                'campaignData.budget': campaignData.budget,
                'campaignData.daily_budget': campaignData.daily_budget
            });

            let budgetStrategy = args.budget_strategy || campaignData.budget_strategy || campaignData.budgetStrategy;
            const hasAdsetBudgets = adsetsData.some((adset: any) => adset.daily_budget || adset.budget);

            console.log('🔴 [ChatContext] BUDGET_STRATEGY STEP 1:', {
                'initialBudgetStrategy': budgetStrategy,
                'hasAdsetBudgets': hasAdsetBudgets,
                'adsetsData.length': adsetsData.length,
                'adsetBudgets': adsetsData.map((a: any) => ({ name: a.name, daily_budget: a.daily_budget, budget: a.budget }))
            });

            if (!budgetStrategy) {
                // Inferir: Se adsets têm budgets, é ABO; caso contrário, CBO
                budgetStrategy = hasAdsetBudgets ? 'ABO' : 'CBO';
                console.log('🔴 [ChatContext] BUDGET_STRATEGY INFERRED (was empty):', budgetStrategy);
            } else {
                // 🔧 FIX: Respeitar budget_strategy explícito da IA
                budgetStrategy = budgetStrategy.toUpperCase() as 'CBO' | 'ABO';
                console.log('🔴 [ChatContext] BUDGET_STRATEGY EXPLICIT (from AI):', budgetStrategy);
            }

            console.log('📊 [ChatContext] Budget Strategy FINAL:', budgetStrategy, '| Explicit from AI:', !!(args.budget_strategy || campaignData.budget_strategy), '| HasAdsetBudgets:', hasAdsetBudgets);

            // 🔧 FIX: Se for ABO mas adsets não têm budgets, distribuir o budget da campanha
            if (budgetStrategy === 'ABO' && !hasAdsetBudgets) {
                const totalBudget = Number(campaignData.daily_budget || campaignData.budget || args.budget || 100);
                const perAdsetBudget = Math.round(totalBudget / adsetsData.length);
                console.log(`📊 [ChatContext] ABO: Distribuindo R$${totalBudget} em ${adsetsData.length} adsets (R$${perAdsetBudget} cada)`);
                adsetsData.forEach((adset: any) => {
                    if (!adset.daily_budget && !adset.budget) {
                        adset.daily_budget = perAdsetBudget;
                    }
                });
            }

            // Transform AI structure to DraftCampaign
            const draft: DraftCampaign = {
                id: draftId, // UUID para compatibilidade com banco
                name: campaignData.name || args.campaignName || 'Nova Campanha',
                objective: mappedObjective,
                budget: String(campaignData.daily_budget || campaignData.budget || args.budget || ''),
                dailyBudget: String(campaignData.daily_budget || campaignData.budget || args.budget || ''),
                status: 'DRAFT',
                createdAt: new Date(),
                // 🆕 Full Campaign Structure Fields
                buyingType: args.buying_type || campaignData.buying_type || 'AUCTION',
                bidStrategy: args.bid_strategy || campaignData.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
                budgetStrategy: budgetStrategy,
                startTime: parseRelativeDate(args.start_time || campaignData.start_time),
                specialAdCategories: args.special_ad_categories || campaignData.special_ad_categories || ['NONE'],
                // 🆕 Catalog Fields (Advantage+ Catalog)
                advantageCatalog: isAdvantageCatalog,
                productCatalogId: args.productCatalogId || '',
                productCatalogName: args.productCatalogName || '',
                productSetId: args.productSetId || '',
                productSetName: args.productSetName || '',
                adSets: (adsetsData || []).map((adset: any, adsetIndex: number) => {
                    // 🔧 FIX: Extract ads count from structure string (e.g., "1-3-2" = 2 ads per set)
                    const structureParts = (structureString || '1-1-1').split('-').map(Number);
                    const expectedAdsCount = structureParts[2] || 1;

                    // Get existing ads or create placeholders
                    const existingAds = adset.ads || [];
                    const hasAds = existingAds.length > 0;

                    // If no ads exist, create placeholder ads
                    const adsToUse = hasAds ? existingAds : Array.from({ length: expectedAdsCount }, (_, adIdx) => ({
                        name: `Anúncio ${adIdx + 1} (Pendente)`,
                        copy: {
                            primary_text: campaignData.copy?.primary_text || args.copy?.primary_text || '',
                            headline: campaignData.copy?.headline || args.copy?.headline || '',
                            description: campaignData.copy?.description || args.copy?.description || ''
                        },
                        destination_url: campaignData.destination_url || args.destination_url || '', // Fallback for URL too
                        status: 'PLACEHOLDER'
                    }));

                    console.log(`📦 [ChatContext] AdSet ${adsetIndex + 1}: ${adsToUse.length} ads (${hasAds ? 'from AI' : 'placeholder'})`);

                    // 🔧 FIX: Gerar nome único para adset usando índice
                    // Se a IA forneceu nome, usar; senão gerar baseado no índice
                    let uniqueAdsetName = adset.name;
                    if (!uniqueAdsetName || uniqueAdsetName.toLowerCase().includes('conjunto 1')) {
                        // IA não forneceu nome ou forneceu nome genérico duplicado
                        const audienceMode = adset.targeting?.audience_mode === 'manual' ? 'Manual' : 'Adv+';
                        uniqueAdsetName = `CJ${adsetIndex + 1} - Público ${audienceMode}`;
                    }

                    return {
                        id: `draft-adset-${draftId}-${adsetIndex}`,
                        name: uniqueAdsetName,
                        campaignId: draftId,
                        dailyBudget: String(adset.daily_budget || adset.dailyBudget || adset.budget || ''),
                        targeting: normalizeTargeting(adset.targeting || args.targeting || campaignData.targeting),
                        status: 'DRAFT' as const,
                        // 🔧 FIX: Map promoted_object - Priority: 1. AI args.pixel_id, 2. adset.promoted_object, 3. accountDefaults
                        promotedObject: (() => {
                            const pixelFromAI = args.pixel_id || campaignData.pixel_id;
                            const pixelFromAdset = adset.promoted_object?.pixel_id || adset.promoted_object?.pixelId ||
                                adset.promotedObject?.pixel_id || adset.promotedObject?.pixelId;
                            const pixelFromDefaults = accountDefaults?.default_pixel_id;

                            const finalPixelId = pixelFromAI || pixelFromAdset || pixelFromDefaults;

                            console.log(`🎯 [ChatContext] AdSet[${adsetIndex}] Pixel Resolution:`, {
                                pixelFromAI,
                                pixelFromAdset,
                                pixelFromDefaults,
                                finalPixelId
                            });

                            if (!finalPixelId) return undefined;

                            return {
                                pixelId: finalPixelId,
                                customEventType: adset.promoted_object?.custom_event_type ||
                                    adset.promotedObject?.customEventType ||
                                    'PURCHASE'
                            };
                        })(),

                        // 🆕 Advanced Fields Mapping
                        optimizationGoal: adset.optimization_goal || adset.optimizationGoal || 'OFFSITE_CONVERSIONS',
                        attributionSpec: adset.attribution_spec || adset.attributionSpec,
                        billingEvent: adset.billing_event || adset.billingEvent || 'IMPRESSIONS',
                        bidAmount: adset.bid_amount || adset.bidAmount,
                        startTime: parseRelativeDate(adset.start_time || adset.startTime),
                        endTime: adset.end_time || adset.endTime,

                        ads: adsToUse.map((ad: any, adIndex: number) => {
                            return {
                                id: `draft-ad-${draftId}-${adsetIndex}-${adIndex}`,
                                name: ad.name || `Anúncio ${adIndex + 1}`,
                                adSetId: `draft-adset-${draftId}-${adsetIndex}`,
                                primaryText: ad.copy?.primary_text || ad.primary_text || ad.primaryText || '',
                                headline: ad.copy?.headline || ad.headline || '',
                                description: ad.copy?.description || ad.description || '',
                                destinationUrl: ad.destination_url || ad.destinationUrl || accountDefaults?.default_domain || '',
                                pageId: ad.page_id || ad.pageId || accountDefaults?.default_page_id || '',
                                pageName: ad.page_name || ad.pageName || accountDefaults?.default_page_name || '',
                                // 🔧 FIX: Also track pixel_id at ad level for display purposes
                                pixelId: ad.pixel_id || adset.promoted_object?.pixel_id || adset.promotedObject?.pixel_id || accountDefaults?.default_pixel_id || '',
                                // 🆕 NEW FIELDS: ctaType and urlParameters
                                ctaType: ad.copy?.cta_type || ad.cta_type || ad.ctaType || 'SHOP_NOW',
                                urlParameters: ad.url_parameters || ad.urlParameters || '',
                                status: 'DRAFT' as const
                            };
                        })
                    };
                })
            };

            setDraftCampaign(draft);
            setActiveDraftCard(true);
            console.log('✅ [ChatContext] Rascunho criado:', draft);
            console.log('🔍 [ChatContext] PRIMEIRO AD COMPLETO:', JSON.stringify(draft.adSets?.[0]?.ads?.[0], null, 2));
            console.log('🔍 [ChatContext] COPY VALUES:', {
                primaryText: draft.adSets?.[0]?.ads?.[0]?.primaryText,
                headline: draft.adSets?.[0]?.ads?.[0]?.headline,
                description: draft.adSets?.[0]?.ads?.[0]?.description
            });

            // 💾 SALVAR RASCUNHO NO BANCO DE DADOS
            const saveDraftToDatabase = async () => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user || !selectedAccountId) {
                        console.warn('⚠️ [ChatContext] Não foi possível salvar rascunho: usuário ou conta não encontrados');
                        return;
                    }

                    // Usar upsert para atualizar se já existir ou criar novo
                    const { error: saveError } = await (supabase as any)
                        .from('campaign_drafts')
                        .upsert({
                            id: draft.id, // Usar ID do draft (draft-campaign-xxx ou UUID se já existir)
                            user_id: user.id,
                            account_id: selectedAccountId,
                            name: draft.name,
                            objective: draft.objective,
                            budget: draft.budget,
                            status: 'DRAFT',
                            draft_data: draft, // Salvar estrutura completa
                            created_at: draft.createdAt.toISOString(),
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });

                    if (saveError) {
                        console.error('❌ [ChatContext] Erro ao salvar rascunho:', saveError);
                    } else {
                        console.log('✅ [ChatContext] Rascunho salvo no banco de dados');
                    }
                } catch (error) {
                    console.error('❌ [ChatContext] Erro ao salvar rascunho:', error);
                }
            };

            // Salvar assincronamente (não bloquear o fluxo)
            saveDraftToDatabase();

            // Add confirmation message to chat (as a normal message, not a card)
            const totalAdSets = draft.adSets?.length || 0;
            const totalAds = draft.adSets?.reduce((acc, set) => acc + (set.ads?.length || 0), 0) || 0;

            // 🚀 DIRECT PUBLISH TO META: Skip editor, send directly to Meta API
            const publishDirectlyToMeta = async () => {
                try {
                    console.log('🚀🚀🚀 [ChatContext] PUBLISHING DIRECTLY TO META!');

                    // Build hierarchical structure for Meta API
                    const isCBO = budgetStrategy === 'CBO';

                    const hierarchicalAdSets = draft.adSets?.map(adSet => ({
                        name: adSet.name,
                        // For ABO, budget is at adset level
                        ...(isCBO ? {} : {
                            daily_budget: parseFloat(String(adSet.dailyBudget || draft.budget || '50'))
                        }),
                        status: 'PAUSED', // Start paused for safety
                        // 🔧 FIX: Use ACTUAL targeting from adSet, not hardcoded values
                        targeting: {
                            // Core targeting from AI
                            geo_locations: adSet.targeting?.geo_locations || { countries: adSet.targeting?.countries || ['BR'] },
                            age_min: adSet.targeting?.age_min || 18,
                            age_max: adSet.targeting?.age_max || 65,
                            genders: adSet.targeting?.genders, // 1=male, 2=female, [1,2]=all
                            interests: adSet.targeting?.interests, // Array of {id, name}
                            behaviors: adSet.targeting?.behaviors,
                            custom_audiences: adSet.targeting?.custom_audiences,
                            excluded_custom_audiences: adSet.targeting?.excluded_custom_audiences,
                            // Platform defaults
                            publisher_platforms: ['facebook', 'instagram'],
                            facebook_positions: ['feed'],
                            instagram_positions: ['stream']
                        },
                        optimization_goal: adSet.optimizationGoal || 'OFFSITE_CONVERSIONS',
                        billing_event: adSet.billingEvent || 'IMPRESSIONS',
                        bid_strategy: draft.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
                        promoted_object: adSet.promotedObject ? {
                            pixel_id: adSet.promotedObject.pixelId,
                            custom_event_type: adSet.promotedObject.customEventType || 'PURCHASE'
                        } : undefined,
                        ads: adSet.ads?.map(ad => ({
                            name: ad.name,
                            status: 'PAUSED',
                            page_id: ad.pageId,
                            creative_hash: ad.creativeHash,
                            destination_url: ad.destinationUrl,
                            copy: {
                                primary_text: ad.primaryText || '',
                                headline: ad.headline || '',
                                description: ad.description || '',
                                cta_type: ad.ctaType || 'SHOP_NOW'
                            }
                        })) || []
                    })) || [];

                    console.log('📦 [ChatContext] Payload para Meta:', {
                        accountId: selectedAccountId,
                        campaignName: draft.name,
                        budgetStrategy,
                        isCBO,
                        adSetsCount: hierarchicalAdSets.length,
                        firstAdSet: hierarchicalAdSets[0]
                    });

                    const { data, error } = await supabase.functions.invoke('create-meta-campaign', {
                        body: {
                            accountId: selectedAccountId,
                            name: draft.name,
                            mode: 'hierarchical',
                            campaign: {
                                name: draft.name,
                                objective: draft.objective || 'OUTCOME_SALES',
                                special_ad_categories: ['NONE'],
                                budgetStrategy: budgetStrategy, // 'ABO' or 'CBO'
                                // For CBO, budget is at campaign level
                                daily_budget: isCBO ? parseFloat(String(draft.budget || '50')) : undefined,
                                bid_strategy: draft.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
                                startTime: draft.startTime,
                                buyingType: draft.buyingType || 'AUCTION',
                                adSets: hierarchicalAdSets
                            }
                        }
                    });

                    console.log('📥 [ChatContext] Resposta do Meta:', { data, error });

                    if (error) {
                        console.error('❌ [ChatContext] ERRO ao publicar no Meta:', error);
                        const errorMsg: Message = {
                            id: `meta-error-${Date.now()}`,
                            role: 'assistant',
                            content: `❌ **Erro ao publicar no Meta:**\n\n${error.message || JSON.stringify(error)}`
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }

                    if (data?.error) {
                        console.error('❌ [ChatContext] ERRO retornado pelo Meta:', data.error);
                        const errorMsg: Message = {
                            id: `meta-error-${Date.now()}`,
                            role: 'assistant',
                            content: `❌ **Erro da API Meta:**\n\n${data.error}`
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }

                    const campaignId = data?.campaignId || data?.campaign_id;
                    console.log('✅✅✅ [ChatContext] CAMPANHA CRIADA NO META! ID:', campaignId);

                    const successMsg: Message = {
                        id: `meta-success-${Date.now()}`,
                        role: 'assistant',
                        content: `${t('copilot.published.title')}\n\n✅ ID: \`${campaignId}\`\n📊 ${totalAdSets} ${totalAdSets === 1 ? t('sidebar.adsets').slice(0, -1) : t('sidebar.adsets')}, ${totalAds} ${totalAds === 1 ? t('sidebar.ads').slice(0, -1) : t('sidebar.ads')}\n💰 ${t('copilot.published.strategy', { strategy: budgetStrategy })}`,
                    };
                    setMessages(prev => [...prev, successMsg]);

                } catch (err: any) {
                    console.error('❌ [ChatContext] Erro inesperado:', err);
                    const errorMsg: Message = {
                        id: `meta-error-${Date.now()}`,
                        role: 'assistant',
                        content: `❌ **Erro inesperado:**\n\n${err.message || String(err)}`
                    };
                    setMessages(prev => [...prev, errorMsg]);
                }
            };

            // First show the confirmation
            const confirmationMessage: Message = {
                id: `draft-confirmation-${Date.now()}`,
                role: 'assistant',
                content: `${t('copilot.campaign_created.title')}\n\n${t('copilot.campaign_created.desc', { name: draft.name, adsets: totalAdSets, ads: totalAds })}\n\n${t('copilot.campaign_created.publishing')}`,
                structuredData: {
                    type: 'campaign_created',
                    campaignName: draft.name,
                    totalAdSets,
                    totalAds,
                    draftId: draft.id
                }
            };
            setMessages(prev => [...prev, confirmationMessage]);

            // Then publish directly to Meta
            publishDirectlyToMeta();

            // Don't add function message to chat
            return;
        }

        // Handle updateDraftCard specially - update the draft object directly
        if (functionName === 'updateDraftCard') {
            console.log('✏️  [ChatContext] Recebido updateDraftCard:', args);

            // Update draftCampaign directly based on operation
            if (draftCampaign && args.operation) {
                const updatedDraft = { ...draftCampaign };

                // Handle update_adsets operation (for pixel_id, etc.)
                if (args.operation === 'update_adsets' || args.operation.startsWith('update_')) {
                    const fields = args.fields || {};
                    const adSetIndex = args.adSetIndex;

                    if (updatedDraft.adSets && updatedDraft.adSets.length > 0) {
                        // If adSetIndex is null/undefined, update all adsets
                        if (adSetIndex === null || adSetIndex === undefined) {
                            updatedDraft.adSets = updatedDraft.adSets.map(adset => {
                                const updatedAdset = { ...adset };

                                // Update promoted_object if pixel_id is provided
                                if (fields.promoted_object) {
                                    updatedAdset.promotedObject = {
                                        ...updatedAdset.promotedObject,
                                        ...fields.promoted_object
                                    };

                                    // 🔧 PIXEL: Se pixel_id foi atualizado no promotedObject, propagar para todos os ads deste adset
                                    if (fields.promoted_object.pixel_id && updatedAdset.ads && updatedAdset.ads.length > 0) {
                                        updatedAdset.ads = updatedAdset.ads.map(ad => ({
                                            ...ad,
                                            pixelId: fields.promoted_object.pixel_id
                                        }));
                                    }
                                }

                                // Update other fields
                                if (fields.budget) updatedAdset.dailyBudget = fields.budget;
                                if (fields.name) updatedAdset.name = fields.name;
                                if (fields.targeting) updatedAdset.targeting = { ...updatedAdset.targeting, ...normalizeTargeting(fields.targeting) };

                                return updatedAdset;
                            });
                        } else if (adSetIndex >= 0 && adSetIndex < updatedDraft.adSets.length) {
                            // Update specific adset
                            const adset = { ...updatedDraft.adSets[adSetIndex] };
                            if (fields.promoted_object) {
                                adset.promotedObject = {
                                    ...adset.promotedObject,
                                    ...fields.promoted_object
                                };

                                // 🔧 PIXEL: Se pixel_id foi atualizado no promotedObject, propagar para todos os ads deste adset
                                if (fields.promoted_object.pixel_id && adset.ads && adset.ads.length > 0) {
                                    adset.ads = adset.ads.map(ad => ({
                                        ...ad,
                                        pixelId: fields.promoted_object.pixel_id
                                    }));
                                }
                            }
                            if (fields.budget) adset.dailyBudget = fields.budget;
                            if (fields.name) adset.name = fields.name;
                            if (fields.targeting) adset.targeting = { ...adset.targeting, ...normalizeTargeting(fields.targeting) };
                            updatedDraft.adSets[adSetIndex] = adset;
                        }
                    }

                    // Handle update_ads operation (for page_id, creative_hash, destination_url, etc.)
                    if (args.operation === 'update_ads' || args.operation.startsWith('update_')) {
                        const adIndex = args.adIndex;

                        if (updatedDraft.adSets && updatedDraft.adSets.length > 0) {
                            updatedDraft.adSets = updatedDraft.adSets.map(adset => {
                                if (!adset.ads || adset.ads.length === 0) return adset;

                                const updatedAdset = { ...adset, ads: [...adset.ads] };

                                // 🔧 PIXEL: Se pixel_id for atualizado, também atualizar no promotedObject do adset
                                if (fields.pixel_id) {
                                    updatedAdset.promotedObject = {
                                        ...updatedAdset.promotedObject,
                                        pixelId: fields.pixel_id,
                                        customEventType: updatedAdset.promotedObject?.customEventType || 'PURCHASE'
                                    };
                                }

                                // If adIndex is null/undefined, update all ads in this adset
                                if (adIndex === null || adIndex === undefined) {
                                    updatedAdset.ads = updatedAdset.ads.map(ad => {
                                        const updatedAd = { ...ad };
                                        if (fields.page_id) updatedAd.pageId = fields.page_id;
                                        if (fields.creative_hash) updatedAd.creativeHash = fields.creative_hash;
                                        if (fields.destination_url) updatedAd.destinationUrl = fields.destination_url;
                                        if (fields.pixel_id) updatedAd.pixelId = fields.pixel_id;
                                        if (fields.url_parameters) updatedAd.urlParameters = fields.url_parameters;
                                        return updatedAd;
                                    });
                                } else if (adIndex >= 0 && adIndex < updatedAdset.ads.length) {
                                    // Update specific ad
                                    const ad = { ...updatedAdset.ads[adIndex] };
                                    if (fields.page_id) ad.pageId = fields.page_id;
                                    if (fields.creative_hash) ad.creativeHash = fields.creative_hash;
                                    if (fields.destination_url) ad.destinationUrl = fields.destination_url;
                                    if (fields.pixel_id) ad.pixelId = fields.pixel_id;
                                    if (fields.url_parameters) ad.urlParameters = fields.url_parameters;
                                    updatedAdset.ads[adIndex] = ad;
                                }

                                return updatedAdset;
                            });
                        }
                    }

                    console.log('✅ [ChatContext] Draft atualizado com sucesso:', updatedDraft);
                    setDraftCampaign(updatedDraft);
                }
            }

            setDraftCardUpdate({
                operation: args.operation,
                adSetIndex: args.adSetIndex,
                adIndex: args.adIndex,
                fields: args.fields || {},
                confirmationMessage: args.confirmationMessage
            });

            // Removed: Don't add confirmation message to chat
            // Only toast notification will appear
            return; // Don't add as function message (already handled)
        }

        // 🔍 INTEREST SELECTOR: Handle AI request for interest selection
        // This displays the interactive interest search widget to the user
        if (functionName === 'request_interest_selection') {
            console.log('🔍 [ChatContext] AI solicitou seleção de interesses:', args);

            const interestMessage: Message = {
                id: `interest-selector-${Date.now()}`,
                role: 'assistant',
                content: args.message || `🎯 Abri o seletor de interesses para sua busca por **"${args.suggested_query || args.query || ''}"**. Selecione os públicos ideais abaixo:`,
                structuredData: {
                    type: 'interest_selector',
                    initialQuery: args.suggested_query || args.query || '',
                    accountId: selectedAccountId || ''
                }
            };

            setMessages(prev => [...prev, interestMessage]);
            return; // Don't add processing message
        }

        // 🌍 LOCATION: Handled conversationally via searchMetaGeo - no widget needed
        // The request_location_selection tool has been deprecated in favor of conversational flow
        if (functionName === 'request_location_selection') {
            console.log('⚠️ [ChatContext] request_location_selection DEPRECATED - use searchMetaGeo conversationally');
            // Ignore this call - location should be handled conversationally
            return;
        }

        // 🔧 Funções que retornam structured_data não precisam de mensagem de processamento
        // Elas retornam diretamente os dados estruturados para dropdowns
        const structuredDataFunctions = [
            'getAccountPixels',
            'getAdIdentities',
            'getAccountCreatives',
            'searchMetaGeo',
            'searchMetaInterests',
            'getAccountCollections'
        ];
        if (structuredDataFunctions.includes(functionName)) {
            console.log(`📦 [ChatContext] Function ${functionName} retorna structured_data, não adicionando mensagem de processamento`);
            return; // Não adicionar mensagem de processamento, a resposta virá como structured_data
        }

        // 🔧 Para outras function calls, adicionar uma mensagem de processamento
        // 🔇 SILENT EXECUTION: Não mostrar mensagens de processamento
        // As funções são executadas em background e a resposta final é mostrada
        // Isso evita mensagens como "Processando getAccountPixels..." que confundem o usuário
        console.log(`🔇 [ChatContext] Executando ${functionName} silenciosamente (sem mensagem de processamento)`);

        // REMOVIDO: Não adicionar mais mensagens de processamento
        // O loading indicator já está visível através do isLoading state
    };

    // 🔗 Hook AI: Integrar com useLadsAI passando o handler de funções
    const { sendMessage: sendToAI, isLoading } = useLadsAI({
        onFunctionCall: handleFunctionCall
    });

    // 🛡️ TIMEOUT DETECTION: Detectar chat travado e oferecer recuperação
    useEffect(() => {
        if (isLoading) {
            // Iniciar timeout quando loading começar (45 segundos)
            loadingTimeoutRef.current = setTimeout(() => {
                console.warn('⚠️ [ChatContext] Timeout detectado - chat pode estar travado');

                // Adicionar mensagem de recuperação ao usuário
                const recoveryMessage: Message = {
                    id: `recovery-${Date.now()}`,
                    role: 'assistant',
                    content: `⚠️ **Parece que algo demorou mais que o esperado.**\n\nIsso pode acontecer por conexão lenta ou sobrecarga temporária. Você pode:\n\n1. **Aguardar mais alguns segundos** - às vezes a resposta chega\n2. **Tentar novamente** - reformule sua mensagem e envie de novo\n3. **Recarregar a página** - se o problema persistir\n\n_Não se preocupe, seu progresso na campanha foi salvo automaticamente._`
                };

                setMessages(prev => [...prev, recoveryMessage]);
            }, 45000);
        } else {
            // Limpar timeout quando loading terminar
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        }

        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, [isLoading]);

    const sendMessage = useCallback(async (content?: string) => {
        const messageContent = content || input;

        // Validation checks
        if (!messageContent.trim()) {
            console.log('[ChatContext] Empty message, ignoring');
            return;
        }

        if (isLoading) {
            console.log('[ChatContext] Already loading, ignoring duplicate request');
            return;
        }

        if (!selectedAccountId) {
            console.log('[ChatContext] No account selected');
            return;
        }

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: messageContent
        };

        // 🔍 INTEREST SELECTION: Parse and store selected interests from widget
        // Format: __INTEREST_SELECTION__[{id, name}, ...]__END__ user message
        if (messageContent.includes('__INTEREST_SELECTION__')) {
            try {
                const match = messageContent.match(/__INTEREST_SELECTION__(.+?)__END__/);
                if (match && match[1]) {
                    const selectedInterests = JSON.parse(match[1]);
                    console.log('🔍 [ChatContext] Interesses selecionados pelo usuário:', selectedInterests);

                    // Store interests for use in campaign creation
                    setPendingSelectedInterests(selectedInterests);

                    // Remove the technical markers from the message for display
                    userMessage.content = messageContent.replace(/__INTEREST_SELECTION__.+?__END__\s*/, '');
                }
            } catch (e) {
                console.error('❌ [ChatContext] Erro ao parsear interesses:', e);
            }
        }

        // 🌍 LOCATION SELECTION: Parse and store selected locations from widget
        // Format: __LOCATION_SELECTION__[{key, name, type}, ...]__END__ user message
        if (messageContent.includes('__LOCATION_SELECTION__')) {
            try {
                const match = messageContent.match(/__LOCATION_SELECTION__(.+?)__END__/);
                if (match && match[1]) {
                    const selectedLocations = JSON.parse(match[1]);
                    console.log('🌍 [ChatContext] Localizações selecionadas pelo usuário:', selectedLocations);

                    // Store locations for use in campaign creation
                    setPendingSelectedLocations(selectedLocations);

                    // Remove the technical markers from the message for display
                    userMessage.content = messageContent.replace(/__LOCATION_SELECTION__.+?__END__\s*/, '');
                }
            } catch (e) {
                console.error('❌ [ChatContext] Erro ao parsear localizações:', e);
            }
        }

        setMessages(prev => [...prev, userMessage]);
        if (!content) setInput(''); // Clear input only if sent from input state

        // Prepare optimized history (last 15 messages to save tokens)
        const MAX_HISTORY = 15;

        // 🧠 SMART CONTEXT MANAGEMENT (Golden Solution)
        // 1. Reset logic: Find the last time a campaign was successfully created
        let prunedMessages = [...messages];
        let lastSuccessIndex = -1;

        // Manual findLastIndex for compatibility
        for (let i = prunedMessages.length - 1; i >= 0; i--) {
            if (prunedMessages[i].structuredData?.type === 'campaign_created') {
                lastSuccessIndex = i;
                break;
            }
        }

        if (lastSuccessIndex !== -1) {
            console.log(`✂️ [ChatContext] Corte de Contexto: Campanha criada no índice ${lastSuccessIndex}. Ignorando histórico anterior.`);
            // Keep only messages AFTER the success event
            prunedMessages = prunedMessages.slice(lastSuccessIndex + 1);
        }

        // 2. Filter valid messages and apply Sliding Window
        const conversationHistory = prunedMessages
            .filter(msg => {
                // Keep users always
                if (msg.role === 'user') return true;
                // Keep assistants only if they have actual text content
                if (msg.role === 'assistant') {
                    return msg.content && msg.content.trim().length > 0;
                }
                return false;
            })
            .slice(-MAX_HISTORY)
            .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: (msg.content || '').substring(0, 1000) // Truncate to 1k chars to save context
            }));

        let finalConversationHistory = conversationHistory;

        // 🧪 DETECT RESET INTENT: Se o usuário quer uma nova campanha ou resetar
        // Isso garante que se ele já publicou uma, a próxima comece do zero
        const lowerContent = messageContent.toLowerCase();
        const isResetIntent =
            (lowerContent.includes('nova campanha') ||
                lowerContent.includes('novo anúncio') ||
                lowerContent.includes('reiniciar') ||
                lowerContent.includes('resetar') ||
                lowerContent.includes('criar campanha') ||
                lowerContent.includes('subir campanha') ||
                lowerContent.includes('fazer campanha')) &&
            !lowerContent.includes('ajustar') &&
            !lowerContent.includes('mudar') &&
            !lowerContent.includes('editar');

        if (isResetIntent && (activeDraftCard || draftCampaign)) {
            console.log('🔄 [ChatContext] Intent balance: Nova campanha detectada. Limpando histórico e rascunhos anteriores...');
            // Limpar estados específicos de draft/wizard para não herdar lixo
            setDraftCampaign(null);
            setActiveDraftCard(false);
            setCreativesProcessed(false);
            setCreativeWizardData(null);
            setPendingCampaignProposal(null);
            localStorage.removeItem('lads_active_draft');
            localStorage.removeItem('lads_draft_campaign');
            localStorage.removeItem('lads_creatives_processed');

            // 🔧 IMPORTANTE: Para a IA, começamos o histórico do zero com a nova mensagem
            // Isso previne que ela tente "ajustar" o rascunho anterior
            finalConversationHistory = [{
                role: 'system' as any, // Cast to avoid TS error if 'system' not in type (it should be handled by backend)
                content: 'SYSTEM NOTICE: User started a NEW campaign. Ignore previous conversation context. Focus ONLY on this new request.'
            }];
        }

        // Detect if there's an active Draft Card
        const hasDraftCard = messages.some(msg =>
            msg.role === 'function' &&
            msg.functionCall?.name === 'propose_campaign_structure'
        ) || activeDraftCard;

        console.log('📤 [ChatContext] Sending message...', {
            messageLength: messageContent.length,
            historyCount: finalConversationHistory.length,
            reset: isResetIntent,
            hasDraftCard
        });

        // Send to AI with robust error handling
        try {
            let response = await sendToAI(
                messageContent,
                finalConversationHistory,
                [],
                selectedAccountId,
                hasDraftCard,
                accountDefaults // 🆕 Pass defaults directly to AI
            );

            // Check if it's a function call marker (draft was created, message already added)
            if (response === '__FUNCTION_CALL__') {
                console.log('✅ [ChatContext] Function call processed');
                // Function calls already add their own messages, nothing more to do
                return;
            }

            // Check for null/empty response
            if (!response) {
                console.warn('[ChatContext] Empty response from AI');
                // 🔧 GARANTIR: Sempre ter uma resposta, mesmo que vazia
                const fallbackMessage: Message = {
                    id: `fallback-${Date.now()}`,
                    role: 'assistant',
                    content: '🤔 Não consegui processar sua solicitação. Pode reformular ou tentar novamente?'
                };
                setMessages(prev => [...prev, fallbackMessage]);
                return;
            }

            // 🌍 AUTO-LOCATION CAPTURE: If response contains __AUTO_LOCATION__ marker, extract and store
            if (response.includes('__AUTO_LOCATION__')) {
                try {
                    const locationMatch = response.match(/__AUTO_LOCATION__(.+?)__END__/);
                    if (locationMatch && locationMatch[1]) {
                        const locationData = JSON.parse(locationMatch[1]);
                        console.log('🌍 [ChatContext] Auto-captured location from searchMetaGeo:', locationData);

                        // Store in pendingSelectedLocations for campaign creation
                        setPendingSelectedLocations(prev => {
                            // Avoid duplicates by key
                            const exists = prev.some(l => l.key === locationData.key);
                            if (exists) return prev;
                            return [...prev, {
                                key: locationData.key,
                                name: locationData.name,
                                type: locationData.type || 'region'
                            }];
                        });

                        // Remove marker from response for display
                        response = response.replace(/\n*__AUTO_LOCATION__.+?__END__/, '');
                    }
                } catch (e) {
                    console.error('❌ [ChatContext] Error parsing auto-location:', e);
                }
            }

            // Check if response is structured data (for dropdowns)
            let aiMessage: Message;

            console.log('🔍 [ChatContext] Processing response, length:', response.length, 'starts with {:', response.trim().startsWith('{'));

            // First check if response starts with JSON marker
            const trimmedResponse = response.trim();
            if (trimmedResponse.startsWith('{')) {
                try {
                    const parsedResponse = JSON.parse(response);
                    console.log('✅ [ChatContext] Successfully parsed JSON, type:', parsedResponse.type);
                    if (parsedResponse.type === 'structured_data') {
                        console.log('📦 [ChatContext] Processando structured_data:', parsedResponse.dataType, parsedResponse.data?.length, 'items');

                        // 🎨 CREATIVES: Store and then check for pending campaign proposal
                        if (parsedResponse.dataType === 'creatives' && parsedResponse.data?.length > 0) {
                            console.log('🎨 [ChatContext] Creatives received:', parsedResponse.data.length, 'items');
                            setPreSelectedCreatives(parsedResponse.data);

                            // 🔧 FIX: After storing creatives, check if there's a pending campaign proposal
                            // If yes, trigger the wizard/campaign creation automatically
                            if (pendingCampaignProposal) {
                                console.log('🚀 [ChatContext] Found pending campaign proposal! Triggering wizard...');
                                // Re-trigger the campaign structure handling with stored creatives
                                setTimeout(() => {
                                    handleFunctionCall('propose_campaign_structure', pendingCampaignProposal);
                                }, 500);
                            } else {
                                console.log('⏳ [ChatContext] Creatives stored, waiting for propose_campaign_structure...');
                            }
                            return;
                        }


                        // 🔧 FIX: Removed silent execution - account_defaults now always provides feedback
                        // All structured_data responses should show a message to maintain conversation flow

                        // Create special message with structured data
                        aiMessage = {
                            id: `ai-${Date.now()}`,
                            role: 'assistant',
                            content: parsedResponse.message || 'Select an option:',
                            structuredData: {
                                type: parsedResponse.dataType,
                                data: parsedResponse.data || []
                            }
                        };
                        console.log('✅ [ChatContext] Created message with structuredData:', aiMessage.structuredData?.type);
                    } else {
                        console.log('⚠️ [ChatContext] JSON parsed but not structured_data, type:', parsedResponse.type);
                        aiMessage = {
                            id: `ai-${Date.now()}`,
                            role: 'assistant',
                            content: response
                        };
                    }
                } catch (parseError) {
                    console.error('❌ [ChatContext] Erro ao parsear JSON:', parseError, 'Response preview:', response.substring(0, 100));
                    // Not valid JSON, treat as normal text
                    aiMessage = {
                        id: `ai-${Date.now()}`,
                        role: 'assistant',
                        content: response
                    };
                }
            } else {
                console.log('📝 [ChatContext] Response is not JSON, treating as text');
                // Not JSON, treat as normal text
                aiMessage = {
                    id: `ai-${Date.now()}`,
                    role: 'assistant',
                    content: response
                };
            }

            // 🔇 SILENT EXECUTION: Filter technical text before displaying
            if (aiMessage.content) {
                aiMessage.content = filterTechnicalText(aiMessage.content);
            }

            setMessages(prev => [...prev, aiMessage]);
            console.log('✅ [ChatContext] AI response added to chat (filtered)');
        } catch (error) {
            console.error("❌ [CHAT CONTEXT] Critical Error:", error);

            // 🔧 GARANTIR: Sempre ter uma resposta de erro amigável
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: '❌ Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente ou use o botão "Reiniciar" para recomeçar.'
            };
            setMessages(prev => [...prev, errorMessage]);
        }
    }, [input, isLoading, messages, selectedAccountId, sendToAI, activeDraftCard]);

    const addMessage = useCallback((message: Message) => {
        setMessages(prev => [...prev, message]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setActiveDraftCard(false);
        setDraftCampaign(null);
        setCreativeWizardData(null);
        setCreativesProcessed(false);
        setPendingCampaignProposal(null);
        localStorage.removeItem('lads_chat_history');
        localStorage.removeItem('lads_active_draft');
        localStorage.removeItem('lads_draft_campaign');
        localStorage.removeItem('lads_creatives_processed');
        hasWelcomeMessageRef.current = false;
    }, []);

    // 🔄 FULL RESET: For error recovery or starting fresh
    // 🔧 Exported to be used by intent detection
    const fullReset = useCallback((keepWelcome = true) => {
        console.log('🔄 [ChatContext] Full reset of chat state...');
        setMessages([]);
        setInput('');
        setPendingFunctionCall(null);
        setDraftCardUpdate(null);
        setActiveDraftCard(false);
        setDraftCampaign(null);
        setCreativesProcessed(false); // Reset wizard flag
        setCreativeWizardData(null); // Close wizard if open
        setPendingCampaignProposal(null); // Clear pending proposal

        // Limpar todos os estados persistidos
        localStorage.removeItem('lads_chat_history');
        localStorage.removeItem('lads_active_draft');
        localStorage.removeItem('lads_draft_campaign');
        localStorage.removeItem('lads_creatives_processed');
        hasWelcomeMessageRef.current = false;

        if (keepWelcome) {
            // Re-inject welcome message after a short delay
            setTimeout(() => {
                if (currentAccountName) {
                    const welcomeMsg: Message = {
                        id: 'welcome',
                        role: 'assistant',
                        content: `Hi! I'm connected to **${currentAccountName}**. I can help create campaigns, analyze data, or adjust budgets. Where should we start?`
                    };
                    setMessages([welcomeMsg]);
                    hasWelcomeMessageRef.current = true;
                }
            }, 100);
        }
    }, [currentAccountName]);

    // Alias for the old name if needed
    const resetChat = fullReset;

    // 🎨 Apply creative assignments from wizard to draft campaign (or create new draft with creatives)
    const applyCreativeAssignments = useCallback((assignments: { adId: string; adSetId: string; creative: CreativeForWizard }[]) => {
        console.log('🎨 [ChatContext] Applying creative assignments:', assignments.length);
        console.log('📦 [ChatContext] Pending proposal exists:', !!pendingCampaignProposal);

        // CASE 1: We have a pending campaign proposal - create draft with creatives
        if (pendingCampaignProposal) {
            console.log('🔨 [ChatContext] Creating draft from pending proposal with creatives');

            const args = pendingCampaignProposal;
            const campaignData = args.campaign || args;
            const timestamp = Date.now();
            const structureString = args.structure || campaignData.structure || '1-1-1';
            const parts = structureString.split('-').map(Number);
            const numAdSets = isNaN(parts[1]) || parts[1] < 1 ? 1 : Math.min(parts[1], 10);
            const numAdsPerSet = isNaN(parts[2]) || parts[2] < 1 ? 1 : Math.min(parts[2], 10);

            const baseTargeting = args.targeting || campaignData.targeting || args.adsets?.[0]?.targeting || { countries: ['BR'] };

            // 🔍 INJECT SELECTED INTERESTS: If user selected interests via the widget, use them
            const defaultTargeting = {
                ...baseTargeting,
                // Prioritize user-selected interests over AI-provided ones
                interests: pendingSelectedInterests.length > 0 ? pendingSelectedInterests : baseTargeting.interests
            };

            // Clear pending interests after use
            if (pendingSelectedInterests.length > 0) {
                console.log('🔍 [ChatContext] Aplicando interesses selecionados pelo usuário:', pendingSelectedInterests);
                setPendingSelectedInterests([]);
            }

            // 🌍 INJECT SELECTED LOCATIONS: If user selected locations via the widget, use them
            if (pendingSelectedLocations.length > 0) {
                console.log('🌍 [ChatContext] Aplicando localizações selecionadas pelo usuário:', pendingSelectedLocations);

                // Convert to geo_locations format
                const cities = pendingSelectedLocations.filter(l => l.type === 'city').map(l => ({
                    key: l.key,
                    name: l.name,
                    radius: 40 // Default radius
                }));
                const regions = pendingSelectedLocations.filter(l => l.type === 'region').map(l => ({
                    key: l.key,
                    name: l.name
                }));

                if (cities.length > 0 || regions.length > 0) {
                    defaultTargeting.geo_locations = {
                        ...(cities.length > 0 ? { cities } : {}),
                        ...(regions.length > 0 ? { regions } : {})
                    };
                }

                setPendingSelectedLocations([]);
            }

            // 🧠 SMARTER TEMPLATE AD FINDING:
            // Don't just take the first ad of the first set. Find the first ad that has actual copy/creative data.
            // This ensures we have a valid template for replication.
            const allAds = (args.adsets || []).flatMap((set: any) => set.ads || []);
            const firstAIAd = allAds.find((ad: any) =>
                ad.copy?.primary_text || ad.copy?.headline || ad.copy?.description || ad.destination_url
            ) || args.adsets?.[0]?.ads?.[0] || {};

            // 🔧 FIX: CBO/ABO Logic - Use explicit budget_strategy FIRST
            const explicitBudgetStrategy = args.budget_strategy || campaignData.budget_strategy || campaignData.budgetStrategy;
            let isCBO: boolean;
            if (explicitBudgetStrategy) {
                isCBO = explicitBudgetStrategy.toUpperCase() === 'CBO';
            } else {
                // Fallback: If campaign budget exists, assume CBO
                isCBO = !!(campaignData.budget || campaignData.daily_budget);
            }
            const budgetStrategy = isCBO ? 'CBO' : 'ABO';
            console.log('📊 [ChatContext] Budget Strategy in applyCreativeAssignments:', {
                explicitBudgetStrategy,
                isCBO,
                budgetStrategy,
                'campaignData.budget': campaignData.budget
            });
            const campaignBudget = String(args.budget || campaignData.budget || campaignData.daily_budget || 50);
            console.log('💰 [ChatContext] Campaign Budget:', campaignBudget, '| args.budget:', args.budget);

            // 🔧 FIX: DISTRIBUTE CREATIVES ACROSS ADSETS SEQUENTIALLY
            // Creative 0 → AdSet 0, Creative 1 → AdSet 1, Creative 2 → AdSet 2, etc.
            // This ensures each adset gets a different creative when user selects multiple
            const totalCreatives = assignments.length;
            console.log('🎨 [ChatContext] Distributing', totalCreatives, 'creatives across', numAdSets, 'adsets');

            // Build ad sets with creatives applied
            // Use existing adsets from AI or generate new ones based on structure
            const generatedAdsetsData = Array.from({ length: numAdSets }, (_, adsetIdx) => {
                const aiAdset = args.adsets?.[adsetIdx] || args.adsets?.[0] || {};
                // 🔧 FIX: Merge interests from defaultTargeting (validated by lads-brain) with adset targeting
                // aiAdset.targeting may have incorrect IDs from AI; defaultTargeting has the CORRECTED ones
                const adsetTargeting = {
                    ...defaultTargeting,  // Start with validated campaign-level targeting (includes corrected interests)
                    ...aiAdset.targeting, // Adset-specific overrides (age, gender, etc.)
                    // 🔒 ALWAYS use interests from defaultTargeting (validated by lads-brain) if available
                    interests: defaultTargeting.interests || aiAdset.targeting?.interests
                };

                // Determine ads count for this set
                const hasExplicitAds = Array.isArray(aiAdset.ads) && aiAdset.ads.length > 0;
                // 🔒 STRICT STRUCTURE ENFORCEMENT: Clamp to numAdsPerSet (Z-value) to prevent 1-3-9 hallucination
                const adsCount = hasExplicitAds ? Math.min(aiAdset.ads.length, Math.max(numAdsPerSet, 1)) : numAdsPerSet;

                const generatedAds = Array.from({ length: adsCount }, (_, adIdx) => {
                    const aiAd = (hasExplicitAds ? aiAdset.ads[adIdx] : undefined) || {};
                    const fallbackAd = firstAIAd;

                    // 🔧 FIX: Distribute creatives using EXACT ID MATCH from Wizard
                    // Reconstruct the expected ID used in Wizard
                    const currentAdId = `draft-ad-${adsetIdx}-${adIdx}`;

                    // Find specific assignment for this slot
                    const assignment = assignments.find(a => a.adId === currentAdId);

                    // Fallback to sequential index ONLY if no specific assignment found (legacy support)
                    const globalAdIndex = adsetIdx * adsCount + adIdx;
                    const creativeFallbackIndex = globalAdIndex % Math.max(totalCreatives, 1);
                    const finalAssignment = assignment || assignments[creativeFallbackIndex];

                    console.log(`🎨 [ChatContext] Assigner: Slot ${currentAdId} -> Creative: ${finalAssignment?.creative?.name || 'fallback/none'}`);

                    return {
                        name: aiAd.name || `Anúncio ${adIdx + 1}`,
                        copy: {
                            // 🔧 FIX: Check per-ad copy THEN fallback to top-level campaign copy
                            primary_text: aiAd.copy?.primary_text || aiAd.copy?.text || aiAd.copy?.message ||
                                fallbackAd.copy?.primary_text || fallbackAd.copy?.text || fallbackAd.copy?.message ||
                                args.copy?.primary_text || campaignData.copy?.primary_text || '',
                            headline: aiAd.copy?.headline ||
                                fallbackAd.copy?.headline ||
                                args.copy?.headline || campaignData.copy?.headline || '',
                            // 🔧 FIX: Robust description mapping - check multiple locations including top-level
                            description: aiAd.copy?.description || aiAd.description || aiAd.copy?.feed_description ||
                                fallbackAd.copy?.description || fallbackAd.description ||
                                args.copy?.description || campaignData.copy?.description || '',
                            cta_type: aiAd.copy?.cta_type || fallbackAd.copy?.cta_type ||
                                args.copy?.cta_type || campaignData.copy?.cta_type || 'SHOP_NOW'
                        },
                        // 🔧 FIX: Add accountDefaults fallback for all critical fields
                        destination_url: aiAd.destination_url || fallbackAd.destination_url || campaignData.destination_url || accountDefaults?.default_domain || '',
                        page_id: aiAd.page_id || fallbackAd.page_id || campaignData.page_id || accountDefaults?.default_page_id || '',
                        page_name: aiAd.page_name || fallbackAd.page_name || accountDefaults?.default_page_name || '',
                        pixel_id: aiAd.pixel_id || fallbackAd.pixel_id || aiAdset.promoted_object?.pixel_id || accountDefaults?.default_pixel_id || '',
                        // 📸 FIX: Add instagram_actor_id with accountDefaults fallback
                        instagram_actor_id: aiAd.instagram_actor_id || fallbackAd.instagram_actor_id || campaignData.instagram_actor_id || accountDefaults?.default_instagram_id || '',
                        // 🎥 FIX: Use creative_type to distinguish video vs image
                        ...((() => {
                            const isVideo = (finalAssignment?.creative.type || '').toLowerCase() === 'video';
                            return {
                                creative_hash: isVideo ? undefined : (finalAssignment?.creative.hash || finalAssignment?.creative.id || ''),
                                video_id: isVideo ? (finalAssignment?.creative.id || '') : undefined
                            };
                        })()),
                        creative_name: finalAssignment?.creative.name || '',
                        creative_url: finalAssignment?.creative.url || '',
                        // 🖼️ FIX: Store thumbnail separately for video ads
                        thumbnail_url: finalAssignment?.creative.thumbnail || '',
                        creative_type: finalAssignment?.creative.type || 'image'
                    };
                });

                // 🔧 FIX: Gerar nome único SEMPRE usando índice
                let finalAdsetName = aiAdset.name || '';
                const alreadyHasUniquePattern = /^CJ\d+/.test(finalAdsetName);

                if (!finalAdsetName || !alreadyHasUniquePattern) {
                    const audienceMode = adsetTargeting.audience_mode === 'manual' ? 'Manual' : 'Adv+';
                    const genderHint = adsetTargeting.genders?.includes(2) ? 'Fem' :
                        adsetTargeting.genders?.includes(1) ? 'Masc' : '';
                    finalAdsetName = `CJ${adsetIdx + 1}${genderHint ? ' ' + genderHint : ''} ${audienceMode}`;
                }

                return {
                    name: finalAdsetName,
                    targeting: adsetTargeting,
                    // 🔧 FIX: Use accountDefaults for promoted_object if not provided by AI
                    promotedObject: (aiAdset.promoted_object || (args.adsets?.[0] || {}).promoted_object) ? {
                        pixelId: (aiAdset.promoted_object || (args.adsets?.[0] || {}).promoted_object).pixel_id || (aiAdset.promoted_object || (args.adsets?.[0] || {}).promoted_object).pixelId,
                        customEventType: (aiAdset.promoted_object || (args.adsets?.[0] || {}).promoted_object).custom_event_type || (aiAdset.promoted_object || (args.adsets?.[0] || {}).promoted_object).customEventType || 'PURCHASE'
                    } : (accountDefaults?.default_pixel_id ? {
                        pixelId: accountDefaults.default_pixel_id,
                        customEventType: 'PURCHASE'
                    } : undefined),
                    // 🔧 FIX: For ABO, use the full budget as per-adset budget (user says R$50 = R$50 per adset)
                    // Only divide if the AI explicitly set a budget_per_adset or daily_budget at adset level
                    daily_budget: isCBO ? '' : (aiAdset.daily_budget || aiAdset.budget || campaignBudget),
                    ads: generatedAds,
                    // Advanced Fields Mapping
                    optimizationGoal: aiAdset.optimization_goal || defaultTargeting.optimization_goal || 'OFFSITE_CONVERSIONS',
                    attributionSpec: aiAdset.attribution_spec || defaultTargeting.attribution_spec,
                    conversionEvent: aiAdset.conversion_event || 'PURCHASE',
                    billingEvent: aiAdset.billing_event || 'IMPRESSIONS',
                    bidAmount: aiAdset.bid_amount,
                    startTime: aiAdset.start_time,
                    endTime: aiAdset.end_time
                };
            });

            // Create the draft campaign
            // timestamp already defined above
            const firstAIAdset = args.adsets?.[0] || {}; // Define firstAIAdset helper
            const newDraft: DraftCampaign = {
                id: `draft-campaign-${timestamp}`,
                name: campaignData.campaignName || campaignData.name || 'Campanha de Vendas',
                objective: (campaignData.objective || 'OUTCOME_SALES').startsWith('OUTCOME_') ? campaignData.objective : `OUTCOME_${campaignData.objective || 'SALES'}`,
                budget: campaignBudget,
                // 🔧 FIX: Add advantageCampaignBudget flag for CBO campaigns
                advantageCampaignBudget: isCBO,
                dailyBudget: campaignBudget,
                startTime: parseRelativeDate(campaignData.start_time || firstAIAdset.start_time),
                specialAdCategories: campaignData.special_ad_categories || ['NONE'],
                status: 'DRAFT',
                createdAt: new Date(),
                // Map Campaign Level Advanced Fields
                bidStrategy: campaignData.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
                buyingType: campaignData.buying_type || 'AUCTION',
                budgetStrategy: isCBO ? 'CBO' : 'ABO',
                adSets: generatedAdsetsData.map((adset, i) => ({
                    id: `draft-adset-${timestamp}-${i}`,
                    name: adset.name,
                    campaignId: `draft-campaign-${timestamp}`,
                    dailyBudget: String(adset.daily_budget || ''),
                    targeting: adset.targeting,
                    status: 'DRAFT',
                    promotedObject: adset.promotedObject,
                    // Map AdSet Level Advanced Fields to Draft
                    optimizationGoal: adset.optimizationGoal,
                    attributionSpec: adset.attributionSpec,
                    conversionEvent: adset.conversionEvent,
                    billingEvent: adset.billingEvent,
                    bidAmount: adset.bidAmount,
                    startTime: adset.startTime,
                    endTime: adset.endTime,
                    ads: adset.ads.map((ad, j) => ({
                        id: `draft-ad-${timestamp}-${i}-${j}`,
                        name: ad.name,
                        adSetId: `draft-adset-${timestamp}-${i}`,
                        primaryText: ad.copy.primary_text,
                        headline: ad.copy.headline,
                        description: ad.copy.description || '',
                        destinationUrl: ad.destination_url || accountDefaults?.default_domain || '',
                        pageId: ad.page_id || accountDefaults?.default_page_id || '',
                        pageName: ad.page_name || accountDefaults?.default_page_name || '',
                        pixelId: ad.pixel_id || accountDefaults?.default_pixel_id || '',
                        // 📸 FIX: Include instagram in draft
                        instagramActorId: ad.instagram_actor_id || accountDefaults?.default_instagram_id || '',
                        // 🎥 FIX: Store either creative_hash (images) or video_id (videos) in creativeHash
                        // The creativeType field determines which API field to use when publishing
                        creativeHash: ad.creative_hash || ad.video_id,
                        creativeName: ad.creative_name,
                        creativeUrl: ad.creative_url,
                        // 🖼️ FIX: Store thumbnail URL separately for video ads
                        creativeThumbnail: ad.thumbnail_url,
                        creativeType: ad.creative_type,
                        ctaType: ad.copy.cta_type || 'SHOP_NOW',
                        status: 'DRAFT'
                    }))
                }))
            };

            setDraftCampaign(newDraft);
            setActiveDraftCard(true);
            setPendingCampaignProposal(null);
            setCreativeWizardData(null);
            setCreativesProcessed(true); // Prevent re-triggering

            // Add success message with campaign_created structure
            const totalAds = numAdSets * numAdsPerSet;
            const confirmMsg: Message = {
                id: `campaign-created-${timestamp}`,
                role: 'assistant',
                content: `✅ **Campanha criada!**\n\nEstruturei a campanha "${newDraft.name}" com ${numAdSets} conjunto(s) de anúncios e ${totalAds} anúncio(s).\n\n🚀 **Publicando automaticamente no Meta...**`,
                structuredData: {
                    type: 'campaign_created',
                    campaignName: newDraft.name,
                    totalAdSets: numAdSets,
                    totalAds: totalAds,
                    draftId: newDraft.id
                }
            };
            setMessages(prev => [...prev, confirmMsg]);

            console.log('✅ [ChatContext] Draft created with creatives from pending proposal');

            // 🚀 DIRECT PUBLISH TO META
            (async () => {
                try {
                    console.log('🚀🚀🚀 [ChatContext] PUBLISHING DIRECTLY TO META (from applyCreativeAssignments)!');

                    // Build hierarchical structure for Meta API
                    const hierarchicalAdSets = newDraft.adSets?.map(adSet => ({
                        name: adSet.name,
                        // For ABO, budget is at adset level
                        ...(isCBO ? {} : {
                            daily_budget: parseFloat(String(adSet.dailyBudget || campaignBudget))
                        }),
                        status: 'PAUSED',
                        // 🔧 FIX: Use ACTUAL targeting from adSet, not hardcoded values
                        targeting: {
                            // Core targeting from AI
                            geo_locations: adSet.targeting?.geo_locations || { countries: adSet.targeting?.countries || ['BR'] },
                            age_min: adSet.targeting?.age_min || 18,
                            age_max: adSet.targeting?.age_max || 65,
                            genders: adSet.targeting?.genders, // 1=male, 2=female, [1,2]=all
                            interests: adSet.targeting?.interests, // Array of {id, name}
                            behaviors: adSet.targeting?.behaviors,
                            custom_audiences: adSet.targeting?.custom_audiences,
                            excluded_custom_audiences: adSet.targeting?.excluded_custom_audiences,
                            // Platform defaults
                            publisher_platforms: ['facebook', 'instagram'],
                            facebook_positions: ['feed'],
                            instagram_positions: ['stream']
                        },
                        optimization_goal: adSet.optimizationGoal || 'OFFSITE_CONVERSIONS',
                        billing_event: adSet.billingEvent || 'IMPRESSIONS',
                        bid_strategy: newDraft.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
                        promoted_object: adSet.promotedObject ? {
                            pixel_id: adSet.promotedObject.pixelId,
                            custom_event_type: adSet.promotedObject.customEventType || 'PURCHASE'
                        } : undefined,
                        ads: adSet.ads?.map(ad => {
                            // 🎥 FIX: Use video_id for videos, creative_hash for images
                            const isVideo = ad.creativeType?.toLowerCase() === 'video';
                            return {
                                name: ad.name,
                                status: 'PAUSED',
                                page_id: ad.pageId,
                                // 📸 FIX: Include instagram_actor_id with specific fallback
                                instagram_actor_id: ad.instagramActorId || accountDefaults?.default_instagram_id || '',
                                creative_hash: isVideo ? undefined : ad.creativeHash,
                                video_id: isVideo ? ad.creativeHash : undefined, // creativeHash stores the ID for both types
                                // 🖼️ FIX: Include thumbnail_url for video ads (separate from video URL)
                                thumbnail_url: isVideo ? ad.creativeThumbnail : undefined,
                                destination_url: ad.destinationUrl,
                                copy: {
                                    primary_text: ad.primaryText || '',
                                    headline: ad.headline || '',
                                    description: ad.description || '',
                                    cta_type: ad.ctaType || 'SHOP_NOW'
                                }
                            };
                        }) || []
                    })) || [];

                    console.log('📦 [ChatContext] Payload para Meta:', {
                        accountId: selectedAccountId,
                        campaignName: newDraft.name,
                        budgetStrategy,
                        isCBO,
                        adSetsCount: hierarchicalAdSets.length,
                        firstAdSet: hierarchicalAdSets[0]
                    });

                    const { data, error } = await supabase.functions.invoke('create-meta-campaign', {
                        body: {
                            accountId: selectedAccountId,
                            name: newDraft.name,
                            mode: 'hierarchical',
                            instagram_actor_id: accountDefaults?.default_instagram_id, // 🌍 GLOBAL: Send default IG for backend fallback
                            campaign: {
                                name: newDraft.name,
                                objective: newDraft.objective || 'OUTCOME_SALES',
                                special_ad_categories: ['NONE'],
                                budgetStrategy: budgetStrategy,
                                daily_budget: isCBO ? parseFloat(campaignBudget) : undefined,
                                bid_strategy: newDraft.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
                                startTime: newDraft.startTime,
                                buyingType: newDraft.buyingType || 'AUCTION',
                                adSets: hierarchicalAdSets
                            }
                        }
                    });

                    console.log('📥 [ChatContext] Resposta do Meta:', { data, error });

                    if (error) {
                        console.error('❌ [ChatContext] ERRO ao publicar no Meta:', error);
                        const errorMsg: Message = {
                            id: `meta-error-${Date.now()}`,
                            role: 'assistant',
                            content: `❌ **Erro ao publicar no Meta:**\n\n${error.message || JSON.stringify(error)}`
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }

                    if (data?.error) {
                        console.error('❌ [ChatContext] ERRO retornado pelo Meta:', data.error);
                        const errorMsg: Message = {
                            id: `meta-error-${Date.now()}`,
                            role: 'assistant',
                            content: `❌ **Erro da API Meta:**\n\n${data.error}`
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }

                    const campaignId = data?.campaignId || data?.campaign_id;
                    console.log('✅✅✅ [ChatContext] CAMPANHA CRIADA NO META! ID:', campaignId);

                    const successMsg: Message = {
                        id: `meta-success-${Date.now()}`,
                        role: 'assistant',
                        content: `🎉 **Campanha publicada no Meta Ads!**\n\n✅ ID: \`${campaignId}\`\n📊 ${numAdSets} conjunto(s), ${totalAds} anúncio(s)\n💰 Estratégia: **${budgetStrategy}** (${isCBO ? 'Orçamento na Campanha' : 'Orçamento por Conjunto'})`
                    };
                    setMessages(prev => [...prev, successMsg]);

                } catch (err: any) {
                    console.error('❌ [ChatContext] Erro inesperado:', err);
                    const errorMsg: Message = {
                        id: `meta-error-${Date.now()}`,
                        role: 'assistant',
                        content: `❌ **Erro inesperado:**\n\n${err.message || String(err)}`
                    };
                    setMessages(prev => [...prev, errorMsg]);
                }
            })();

            return;
        }


        // CASE 2: No pending proposal - Create a minimal draft from wizard data
        if (!draftCampaign) {
            console.log('🔨 [ChatContext] No pending proposal or draft - creating minimal draft from wizard assignments');

            const timestamp = Date.now();

            // Group assignments by adSet
            const adSetMap = new Map<string, { adId: string; adSetId: string; creative: CreativeForWizard }[]>();
            assignments.forEach(a => {
                const existing = adSetMap.get(a.adSetId) || [];
                existing.push(a);
                adSetMap.set(a.adSetId, existing);
            });

            // Create ad sets from wizard assignments
            const adSets = Array.from(adSetMap.entries()).map(([adSetId, ads], i) => ({
                id: `draft-adset-${timestamp}-${i}`,
                name: `Conjunto ${i + 1}`,
                campaignId: `draft-campaign-${timestamp}`,
                dailyBudget: '50',
                targeting: { countries: ['BR'] },
                status: 'DRAFT' as const,
                ads: ads.map((a, j) => ({
                    id: `draft-ad-${timestamp}-${i}-${j}`,
                    name: `Anúncio ${j + 1}`,
                    adSetId: `draft-adset-${timestamp}-${i}`,
                    primaryText: '',
                    headline: '',
                    description: '',
                    destinationUrl: '',
                    pageId: '',
                    pageName: '',
                    pixelId: '',
                    creativeHash: a.creative.hash || a.creative.id,
                    creativeName: a.creative.name,
                    creativeUrl: a.creative.url,
                    creativeType: a.creative.type,
                    status: 'DRAFT' as const
                }))
            }));

            const newDraft: DraftCampaign = {
                id: `draft-campaign-${timestamp}`,
                name: 'Nova Campanha',
                objective: 'SALES',
                budget: '50',
                dailyBudget: '50',
                status: 'DRAFT',
                createdAt: new Date(),
                adSets
            };

            setDraftCampaign(newDraft);
            setActiveDraftCard(true);
            setCreativeWizardData(null);
            setCreativesProcessed(true); // Prevent re-triggering

            // Add success message
            const confirmMsg: Message = {
                id: `campaign-created-${timestamp}`,
                role: 'assistant',
                content: `✅ **Criativos selecionados!**\n\nCriei um rascunho de campanha com ${adSets.length} conjunto(s) e ${assignments.length} anúncio(s) com criativos atribuídos.\n\nClique no botão abaixo para revisar, preencher os detalhes e publicar.`,
                structuredData: {
                    type: 'campaign_created',
                    campaignName: newDraft.name,
                    totalAdSets: adSets.length,
                    totalAds: assignments.length,
                    draftId: newDraft.id
                }
            };
            setMessages(prev => [...prev, confirmMsg]);

            console.log('✅ [ChatContext] Minimal draft created from wizard assignments');
            return;
        }

        const updatedDraft = { ...draftCampaign };
        updatedDraft.adSets = updatedDraft.adSets.map(adSet => ({
            ...adSet,
            ads: adSet.ads.map(ad => {
                const assignment = assignments.find(a => a.adId === ad.id);
                if (assignment) {
                    return {
                        ...ad,
                        creativeHash: assignment.creative.hash || assignment.creative.id,
                        creativeName: assignment.creative.name,
                        creativeUrl: assignment.creative.url,
                        creativeType: assignment.creative.type
                    };
                }
                return ad;
            })
        }));

        setDraftCampaign(updatedDraft);
        setCreativeWizardData(null); // Close wizard
        setCreativesProcessed(true); // Prevent re-triggering

        // Add confirmation message to chat
        const confirmMsg: Message = {
            id: `creative-confirm-${Date.now()}`,
            role: 'assistant',
            content: `✅ **${assignments.length} criativos atribuídos com sucesso!** Todos os anúncios agora têm seus criativos definidos. Você pode revisar e ajustar no editor antes de publicar.`
        };
        setMessages(prev => [...prev, confirmMsg]);

        console.log('✅ [ChatContext] Creative assignments applied to existing draft');
    }, [draftCampaign, pendingCampaignProposal, accountDefaults]);

    return (
        <ChatContext.Provider value={{
            messages,
            isLoading,
            input,
            setInput,
            sendMessage,
            addMessage,
            clearMessages,
            resetChat,
            pendingFunctionCall,
            draftCardUpdate,
            consumeDraftUpdate,
            activeDraftCard,
            setActiveDraftCard,
            draftCampaign,
            setDraftCampaign,
            creativeWizardData,
            setCreativeWizardData,
            creativesProcessed,
            applyCreativeAssignments,
            refreshAccountDefaults: fetchAccountDetails,
            preSelectedCreatives,
            setPreSelectedCreatives
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}


// 🔧 Shared Helper function to normalize targeting from AI format to UI format
function normalizeTargeting(rawTargeting: any): any {
    if (!rawTargeting) return { geo_locations: { countries: ['BR'] } };

    const normalized: any = {};

    // Age range - preserve exact values from AI
    if (rawTargeting.age_min !== undefined) normalized.age_min = rawTargeting.age_min;
    if (rawTargeting.age_max !== undefined) normalized.age_max = rawTargeting.age_max;

    // Genders: AI sends [1], [2], or [1,2]
    if (rawTargeting.genders && Array.isArray(rawTargeting.genders)) {
        normalized.genders = rawTargeting.genders;
    }

    // Geo locations: AI may send multiple formats
    if (rawTargeting.geo_locations) {
        if (Array.isArray(rawTargeting.geo_locations)) {
            // Check if items have names (from AI text suggestions)
            const hasNames = rawTargeting.geo_locations.some((loc: any) =>
                typeof loc === 'object' && loc.name
            );

            if (hasNames) {
                // AI sent structured locations with names
                normalized.geo_locations = {
                    cities: rawTargeting.geo_locations.filter((loc: any) => loc.type === 'city').map((loc: any) => ({
                        key: loc.key || loc.id || String(loc.name).toLowerCase(),
                        name: loc.name,
                        radius: loc.radius || 40,
                        distance_unit: 'kilometer'
                    })),
                    regions: rawTargeting.geo_locations.filter((loc: any) => loc.type === 'region').map((loc: any) => ({
                        key: loc.key || loc.id,
                        name: loc.name
                    })),
                    countries: rawTargeting.geo_locations.filter((loc: any) => loc.type === 'country').map((loc: any) =>
                        loc.key || loc.code || loc.id
                    )
                };
                // Remove empty arrays
                if (normalized.geo_locations.cities?.length === 0) delete normalized.geo_locations.cities;
                if (normalized.geo_locations.regions?.length === 0) delete normalized.geo_locations.regions;
                if (normalized.geo_locations.countries?.length === 0) delete normalized.geo_locations.countries;
            } else {
                // Format: ["123456", "789012"] - assume cities (Meta geo keys)
                normalized.geo_locations = {
                    cities: rawTargeting.geo_locations.map((key: string) => ({
                        key: String(key),
                        radius: 40,
                        distance_unit: 'kilometer'
                    }))
                };
            }
        } else if (typeof rawTargeting.geo_locations === 'object') {
            // Already structured format - preserve it
            normalized.geo_locations = rawTargeting.geo_locations;
        }
    } else if (rawTargeting.countries && Array.isArray(rawTargeting.countries)) {
        // Simple countries format: ["BR", "US"]
        normalized.geo_locations = {
            countries: rawTargeting.countries
        };
    } else if (rawTargeting.location_text) {
        // AI sent a display name only (e.g., "Rio de Janeiro")
        const text = rawTargeting.location_text.toLowerCase();
        normalized.display_locations = [rawTargeting.location_text];

        // 🔧 CRITICAL: Try to guess structure if simple string
        if (text.includes('paulo')) {
            normalized.geo_locations = {
                regions: [{ key: '3074', name: 'São Paulo (estado)' }]
            };
        } else if (text.includes('rio de janeiro') || text.includes('rj')) {
            normalized.geo_locations = {
                regions: [{ key: '3073', name: 'Rio de Janeiro (estado)' }]
            };
        } else {
            normalized.geo_locations = { countries: ['BR'] }; // Fallback
        }
    } else {
        // Default to Brazil
        normalized.geo_locations = { countries: ['BR'] };
    }

    // Interests
    if (rawTargeting.interests && Array.isArray(rawTargeting.interests)) {
        normalized.interests = rawTargeting.interests.map((interest: any) => {
            if (typeof interest === 'string') return { id: interest, name: interest };
            return interest;
        });
        normalized.flexible_spec = [{
            interests: normalized.interests.map((i: any) => ({ id: i.id, name: i.name }))
        }];
    }

    // Behaviors
    if (rawTargeting.behaviors && Array.isArray(rawTargeting.behaviors)) {
        normalized.behaviors = rawTargeting.behaviors.map((behavior: any) => {
            if (typeof behavior === 'string') return { id: behavior, name: behavior };
            return behavior;
        });
    }

    if (rawTargeting.custom_audiences) normalized.custom_audiences = rawTargeting.custom_audiences;
    if (rawTargeting.location_types) normalized.location_types = rawTargeting.location_types;
    if (rawTargeting.rationale) normalized.rationale = rawTargeting.rationale;

    // 🆕 Audience Mode: Advantage+ vs Manual
    // If AI sends audience_mode or targeting_automation, preserve it
    if (rawTargeting.audience_mode) {
        normalized.audience_mode = rawTargeting.audience_mode;
        // Set targeting_automation flag based on mode
        normalized.targeting_automation = {
            advantage_audience: rawTargeting.audience_mode === 'advantage' ? 1 : 0
        };
    } else if (rawTargeting.targeting_automation !== undefined) {
        normalized.targeting_automation = rawTargeting.targeting_automation;
        normalized.audience_mode = rawTargeting.targeting_automation?.advantage_audience === 1 ? 'advantage' : 'manual';
    } else {
        // Default: assume Advantage+ if no interests/behaviors specified, Manual otherwise
        const hasDetailedTargeting = !!(rawTargeting.interests?.length || rawTargeting.behaviors?.length);
        normalized.audience_mode = hasDetailedTargeting ? 'advantage' : 'advantage'; // Default to advantage, let user change
        normalized.targeting_automation = { advantage_audience: 1 };
    }

    return normalized;
}
