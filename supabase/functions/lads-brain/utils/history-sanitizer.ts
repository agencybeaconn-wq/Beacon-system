// Conversation History Sanitizer for Lads Brain
// @ts-nocheck
/**
 * Sanitize conversation history for OpenAI API
 * - Removes orphan tool_calls without responses
 * - Removes orphan tool responses without calls
 * - Converts 'function' role to 'tool' role (OpenAI v1.0+)
 */ export function sanitizeConversationHistory(rawHistory) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
    return [];
  }
  console.log(`🧹 [SANITIZER] Iniciando limpeza de ${rawHistory.length} mensagens...`);
  // Step 1: Convert 'function' → 'tool' and normalize structure
  const normalized = rawHistory.filter((msg)=>msg !== null && typeof msg === 'object').map((msg)=>{
    if (msg.role === 'function') {
      return {
        role: 'tool',
        tool_call_id: msg.name || msg.tool_call_id || 'unknown',
        content: msg.content || ''
      };
    }
    return msg;
  });
  // Step 2: Build map of expected vs responded tool_call_ids
  const expectedToolCallIds = new Set();
  const respondedToolCallIds = new Set();
  normalized.forEach((msg)=>{
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      msg.tool_calls.forEach((tc)=>{
        if (tc.id) expectedToolCallIds.add(tc.id);
      });
    }
    if (msg.role === 'tool' && msg.tool_call_id) {
      respondedToolCallIds.add(msg.tool_call_id);
    }
  });
  // Step 3: Identify orphan IDs
  const orphanedCallIds = new Set([
    ...expectedToolCallIds
  ].filter((id)=>!respondedToolCallIds.has(id)));
  const orphanedResponseIds = new Set([
    ...respondedToolCallIds
  ].filter((id)=>!expectedToolCallIds.has(id)));
  if (orphanedCallIds.size > 0) {
    console.warn(`⚠️ [SANITIZER] Tool Calls órfãos detectados (sem resposta): [${Array.from(orphanedCallIds).join(', ')}]`);
  }
  if (orphanedResponseIds.size > 0) {
    console.warn(`⚠️ [SANITIZER] Tool Responses órfãs detectadas (sem chamada): [${Array.from(orphanedResponseIds).join(', ')}]`);
  }
  // Step 4: Remove orphan messages
  const cleaned = normalized.filter((msg, index)=>{
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const hasOrphanedCall = msg.tool_calls.some((tc)=>orphanedCallIds.has(tc.id));
      if (hasOrphanedCall) {
        console.warn(`🗑️ [SANITIZER] Removendo assistant message com tool_call órfão: índice ${index}`);
        return false;
      }
    }
    if (msg.role === 'tool' && orphanedResponseIds.has(msg.tool_call_id)) {
      console.warn(`🗑️ [SANITIZER] Removendo tool response órfã: tool_call_id=${msg.tool_call_id}`);
      return false;
    }
    return true;
  });
  console.log(`✅ [SANITIZER] Limpeza concluída: ${rawHistory.length} → ${cleaned.length} mensagens`);
  return cleaned;
}
/**
 * Truncate conversation history to prevent token overflow
 * Keeps first 2 messages (context) + last N messages
 */ export function truncateHistory(history, maxMessages = 20) {
  if (!Array.isArray(history) || history.length <= maxMessages) {
    return history;
  }
  const contextMessages = history.slice(0, 2);
  const recentMessages = history.slice(-(maxMessages - 2));
  console.log(`📋 [TRUNCATE] History truncated: ${history.length} → ${contextMessages.length + recentMessages.length} messages`);
  return [
    ...contextMessages,
    ...recentMessages
  ];
}
/**
 * Compress large tool response content to reduce payload size
 * NOTE: We do NOT compress tool_calls arguments as that would create invalid JSON
 */ export function compressToolCallContent(history) {
  return history.map((msg)=>{
    if (msg.role === 'tool' && msg.content && msg.content.length > 1500) {
      console.log(`🗜️ [COMPRESS] Compressing tool response: ${msg.content.length} → 800 chars`);
      return {
        ...msg,
        content: msg.content.substring(0, 800) + '\n... [RESPONSE TRUNCATED FOR CONTEXT WINDOW]'
      };
    }
    return msg;
  });
}
/**
 * Process conversation history through all sanitization steps
 */ export function processConversationHistory(rawHistory, maxMessages = 25) {
  let history = sanitizeConversationHistory(rawHistory);
  history = truncateHistory(history, maxMessages);
  history = compressToolCallContent(history);
  return history;
}
