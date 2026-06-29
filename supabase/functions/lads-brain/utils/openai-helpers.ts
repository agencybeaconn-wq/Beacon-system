// OpenAI Helper Functions for Lads Brain
// @ts-nocheck
/**
 * Helper function para validar resposta da OpenAI e extrair message de forma segura
 */ export function getOpenAIMessage(data) {
  console.log('🔍 [LADS-BRAIN] OpenAI raw response keys:', data ? Object.keys(data) : 'null');
  if (data?.error) {
    console.error('❌ [LADS-BRAIN] OpenAI API Error:', JSON.stringify(data.error));
    return {
      message: null,
      error: data.error.message || 'OpenAI API error'
    };
  }
  if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    console.error('❌ [LADS-BRAIN] Resposta da OpenAI sem choices válidos:', JSON.stringify(data).substring(0, 500));
    return null;
  }
  const message = data.choices[0]?.message;
  if (!message) {
    console.error('❌ [LADS-BRAIN] choices[0].message é undefined. choices[0]:', JSON.stringify(data.choices[0]));
    return null;
  }
  console.log('✅ [LADS-BRAIN] OpenAI message extracted successfully. Has content:', !!message.content, 'Has tool_calls:', !!message.tool_calls);
  return {
    message,
    usage: data.usage
  };
}
/**
 * Helper function para validar tool_calls e extrair o primeiro de forma segura
 */ export function getFirstToolCall(message) {
  if (!message || !message.tool_calls || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
    return null;
  }
  const toolCall = message.tool_calls[0];
  if (!toolCall || !toolCall.function) {
    console.error('❌ [LADS-BRAIN] tool_calls[0] ou tool_calls[0].function é undefined');
    return null;
  }
  try {
    const args = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    return {
      name: toolCall.function.name,
      arguments: args
    };
  } catch (error) {
    console.error('❌ [LADS-BRAIN] Erro ao fazer parse dos argumentos da tool:', error);
    return null;
  }
}
/**
 * Retry Mechanism for OpenAI Calls
 * Tenta chamar a API da OpenAI com retries e backoff exponencial
 */ export async function callOpenAIWithRetry(openaiApiKey, payload, maxRetries = 3) {
  let lastError;
  for(let attempt = 0; attempt <= maxRetries; attempt++){
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return response;
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      const errorText = await response.clone().text();
      console.warn(`⚠️ [RETRY] OpenAI attempt ${attempt + 1}/${maxRetries + 1} failed (Status ${response.status}): ${errorText.substring(0, 100)}...`);
      if (attempt < maxRetries) {
        const baseDelay = response.status === 429 ? 3000 : 2000;
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ [RETRY] Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve)=>setTimeout(resolve, waitTime));
      }
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ [RETRY] Network error attempt ${attempt + 1}/${maxRetries + 1}: ${error}`);
      if (attempt < maxRetries) {
        const waitTime = 1000 * Math.pow(2, attempt);
        await new Promise((resolve)=>setTimeout(resolve, waitTime));
      }
    }
  }
  throw lastError || new Error("OpenAI API call failed after max retries");
}
