import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FunctionCallResponse {
  type: 'function_call';
  function: string;
  arguments: any;
}

interface TextResponse {
  type: 'text';
  response: string;
}

type AIResponse = FunctionCallResponse | TextResponse;

interface UseLadsAIOptions {
  onSuccess?: (response: string) => void;
  onError?: (error: string) => void;
  onFunctionCall?: (functionName: string, args: any) => void;
}

// Configuration for better reliability
const MIN_REQUEST_INTERVAL = 1000; // Reduced to 1 second for faster follow-ups
const MAX_RETRIES = 3; // Increased retries
const RETRY_DELAY = 1000; // 1 second base delay
const REQUEST_TIMEOUT = 120000; // 120 seconds timeout (2 minutes)

export function useLadsAI(options?: UseLadsAIOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Rate limiting refs
  const lastRequestTime = useRef<number>(0);
  const requestCount = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper: Sleep function for retry delays
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: Make the actual API call with retry logic and timeout
  const makeAPICall = async (
    message: string,
    conversationHistory: Message[],
    campaignData: any[],
    accountId: string | null,
    activeDraftCard: boolean,
    accountDefaults: any, // 🆕 Defaults injection
    retryCount = 0
  ): Promise<any> => {
    const attemptLabel = retryCount > 0 ? ` (tentativa ${retryCount + 1}/${MAX_RETRIES + 1})` : '';
    console.log(`🚀 [useLadsAI] Enviando requisição${attemptLabel}...`);

    // Get User's Preferred AI Language
    const aiLanguage = localStorage.getItem('lads_ai_language') || 'pt-BR';

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT);
      });

      // Race between the API call and timeout
      const apiPromise = supabase.functions.invoke('lads-brain', {
        body: {
          message: message.trim(),
          campaignData: campaignData,
          conversationHistory: conversationHistory,
          accountId: accountId,
          activeDraftCard: activeDraftCard,
          accountDefaults: accountDefaults, // 🆕 Pass defaults to backend
          aiLanguage: aiLanguage
        }
      });

      const result = await Promise.race([apiPromise, timeoutPromise]) as any;

      // Check for empty data (Edge Function might have cold start issues)
      if (!result || (!result.data && !result.error)) {
        console.warn('[useLadsAI] Resposta vazia/inválida, tentando novamente...');
        if (retryCount < MAX_RETRIES) {
          await sleep(RETRY_DELAY);
          return makeAPICall(message, conversationHistory, campaignData, accountId, activeDraftCard, accountDefaults, retryCount + 1);
        }
        throw new Error('Resposta vazia do servidor após várias tentativas.');
      }

      // Check for rate limiting (429) or server errors (5xx)
      if (result.error) {
        const status = result.error.status || 0;
        const isRetryable = status === 429 || status >= 500 || status === 0;

        if (isRetryable && retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(1.5, retryCount); // Exponential backoff
          console.warn(`[useLadsAI] Erro ${status}, aguardando ${Math.round(delay / 1000)}s antes de retry...`);
          await sleep(delay);
          return makeAPICall(message, conversationHistory, campaignData, accountId, activeDraftCard, accountDefaults, retryCount + 1);
        }
        throw result.error;
      }

      console.log('✅ [useLadsAI] Resposta recebida com sucesso');
      return result;
    } catch (error: any) {
      // Handle timeout
      if (error.message === 'TIMEOUT') {
        console.warn('[useLadsAI] Requisição excedeu timeout');
        if (retryCount < MAX_RETRIES) {
          console.log('[useLadsAI] Tentando novamente após timeout...');
          return makeAPICall(message, conversationHistory, campaignData, accountId, activeDraftCard, accountDefaults, retryCount + 1);
        }
        throw new Error('A requisição demorou muito. O servidor pode estar ocupado. Tente novamente.');
      }

      // Retry on network errors
      if (retryCount < MAX_RETRIES && (error.name === 'TypeError' || error.message?.includes('fetch'))) {
        console.warn(`[useLadsAI] Erro de rede, tentando novamente...`);
        await sleep(RETRY_DELAY);
        return makeAPICall(message, conversationHistory, campaignData, accountId, activeDraftCard, accountDefaults, retryCount + 1);
      }
      throw error;
    }
  };

  const sendMessage = async (
    message: string,
    conversationHistory: Message[] = [],
    campaignData: any[] = [],
    accountId?: string | null,
    activeDraftCard?: boolean,
    accountDefaults?: any // 🆕 Optional parameter
  ): Promise<string | null> => {
    if (!message.trim()) {
      return null;
    }

    // 🔒 RATE LIMITING: Check if we're sending requests too fast
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && lastRequestTime.current > 0) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[useLadsAI] Rate limiting: aguardando ${waitTime}ms...`);
      // Wait silently without showing toast (faster experience)
      await sleep(waitTime);
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      console.log('[useLadsAI] Cancelando requisição anterior...');
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Update request tracking
    lastRequestTime.current = Date.now();
    requestCount.current++;

    setIsLoading(true);

    try {
      // Se accountId não foi fornecido, tentar obter do localStorage ou Supabase
      let finalAccountId = accountId;

      if (!finalAccountId) {
        const savedAccountId = localStorage.getItem('selectedAccountId');
        if (savedAccountId) {
          finalAccountId = savedAccountId;
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: accounts } = await supabase
              .from('ad_accounts')
              .select('id')
              .eq('user_id', user.id)
              .eq('status', 'ACTIVE')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (accounts && accounts.length > 0) {
              finalAccountId = accounts[0].id;
              localStorage.setItem('selectedAccountId', finalAccountId);
            }
          }
        }
      }

      // Make API call with retry logic
      const result = await makeAPICall(
        message,
        conversationHistory,
        campaignData,
        finalAccountId || null,
        activeDraftCard || false,
        accountDefaults || null // 🆕 Pass to internal function
      );

      const data = result.data;
      const error = result.error;

      console.log('📥 [useLadsAI] Raw response from Edge Function:', {
        hasData: !!data,
        hasError: !!error,
        dataType: data?.type,
        dataTypeValue: data?.type,
        dataKeys: data ? Object.keys(data) : [],
        fullData: data ? JSON.stringify(data).substring(0, 1000) : 'no data' // First 1000 chars for debugging
      });

      // CRITICAL: Check if response is structured_data BEFORE any other processing
      if (data?.type === 'structured_data') {
        console.log('🎯 [useLadsAI] FOUND structured_data! Returning directly:', {
          dataType: data.dataType,
          dataLength: data.data?.length,
          message: data.message
        });
        const structuredResponse = JSON.stringify({
          type: 'structured_data',
          dataType: data.dataType,
          data: data.data,
          message: data.message
        });
        if (options?.onSuccess) {
          options.onSuccess(structuredResponse);
        }
        return structuredResponse;
      }

      // Verificar se há erro HTTP (4xx, 5xx)
      if (error) {
        console.error('[useLadsAI] Erro da Edge Function:', error);

        // Specific handling for rate limiting
        if (error.status === 429) {
          throw new Error('Muitas requisições. Por favor, aguarde alguns segundos e tente novamente.');
        }

        throw new Error(error.message || `Erro do servidor: ${error.status || 'Desconhecido'}`);
      }

      // Verificar se a resposta está vazia ou inválida
      if (!data) {
        console.error('[useLadsAI] Resposta vazia do servidor');
        throw new Error('O servidor não retornou dados. Por favor, tente novamente.');
      }

      // Verificar se há erro na resposta de dados
      // A Edge Function agora sempre retorna status 200 com type: 'text' e response contendo a mensagem
      if (data?.error && !data?.response) {
        const errorMessage = data.error;
        console.error('[useLadsAI] Erro na resposta (sem response):', errorMessage);

        if (options?.onError) {
          options.onError(errorMessage);
        }

        return `⚠️ ${errorMessage}`;
      }

      // Se tem error mas também tem response, usar o response (que já contém mensagem user-friendly)
      if (data?.error && data?.response) {
        console.warn('[useLadsAI] Resposta com erro estruturado:', data.error);
        // A response já contém a mensagem amigável, retorná-la diretamente
        return data.response;
      }

      // Check if it's a function call
      if (data.type === 'function_call') {
        if (options?.onFunctionCall) {
          options.onFunctionCall(data.function, data.arguments);
        }
        return '__FUNCTION_CALL__';
      }

      // Check if it's structured data (for dropdowns) - PRIORITY CHECK
      console.log('🔍 [useLadsAI] Checking response type:', data.type, 'Keys:', Object.keys(data));
      if (data.type === 'structured_data') {
        console.log('📦 [useLadsAI] Detected structured_data:', data.dataType, data.data?.length);
        // Return special marker that will be handled by ChatContext
        const structuredResponse = JSON.stringify({
          type: 'structured_data',
          dataType: data.dataType,
          data: data.data,
          message: data.message
        });
        console.log('📦 [useLadsAI] Returning structured response (first 200 chars):', structuredResponse.substring(0, 200));
        return structuredResponse;
      }

      // Normal text response
      const responseText = data.response || data.content || null;
      console.log('📝 [useLadsAI] Returning text response (first 100 chars):', responseText?.substring(0, 100));

      // 🌍 FIX: Include auto-selected location if present (from searchMetaGeo)
      if (data._autoSelectedLocation) {
        console.log('🌍 [useLadsAI] Location auto-selected:', data._autoSelectedLocation);
        // Append location data as JSON marker for ChatContext to capture
        const locationMarker = `\n\n__AUTO_LOCATION__${JSON.stringify(data._autoSelectedLocation)}__END__`;
        return (responseText || '') + locationMarker;
      }

      if (!responseText) {
        console.warn('[useLadsAI] Resposta sem conteúdo, verificando se há função:', data);

        // Se não há resposta mas também não é erro, pode ser um edge case
        // Retornar uma mensagem útil em vez de erro
        const fallbackMessage = '🔄 Processando sua solicitação... Se não houver resposta em alguns segundos, tente enviar novamente.';

        if (options?.onSuccess) {
          options.onSuccess(fallbackMessage);
        }

        return fallbackMessage;
      }

      if (options?.onSuccess) {
        options.onSuccess(responseText);
      }

      return responseText;

    } catch (error: any) {
      console.error('[useLadsAI] Erro geral:', error);

      // Check if request was aborted (user sent another message)
      if (error.name === 'AbortError') {
        console.log('[useLadsAI] Requisição cancelada pelo usuário');
        return null;
      }

      const errorMessage = error instanceof Error
        ? error.message
        : 'Não foi possível enviar a mensagem. Tente novamente.';

      // Simplified error message for users
      let userFriendlyMessage: string;

      if (errorMessage.includes('429') || errorMessage.includes('Muitas requisições')) {
        userFriendlyMessage = '⏳ Muitas requisições. Aguarde alguns segundos e tente novamente.';
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        userFriendlyMessage = '🔌 Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage = '⏱️ A requisição demorou muito. Por favor, tente novamente.';
      } else {
        userFriendlyMessage = `❌ Erro ao processar: ${errorMessage}`;
      }

      toast({
        title: "Erro",
        description: userFriendlyMessage,
        variant: "destructive",
      });

      if (options?.onError) {
        options.onError(errorMessage);
      }

      return userFriendlyMessage;

    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return {
    sendMessage,
    isLoading
  };
}

