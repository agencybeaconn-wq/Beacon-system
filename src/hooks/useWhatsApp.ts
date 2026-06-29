import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';

const EVOLUTION_API_URL = 'https://evo.jotabot.site';
const EVOLUTION_API_KEY = 'JotaBotEVO2025_API_Key_Definitiva';

export interface WhatsAppChat {
    id: string; // remoteJid
    name: string; // pushName or name
    avatar?: string; // profilePictureUrl 
    lastMessage: string; // text from last msg
    time: string; // formatted time
    timestamp: number;
    unread: number; // unreadCount
    online: boolean; // Just mock for now or from presence
}

export interface WhatsAppMessage {
    id: string;
    text: string;
    sender: 'me' | 'them';
    timestamp: string;
    status: 'sent' | 'delivered' | 'read' | 'pending';
    fromMe: boolean;
}

export function useWhatsApp() {
    const { workspaceId } = useDashboard();

    // State
    const [instanceName, setInstanceName] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoadingInstance, setIsLoadingInstance] = useState<boolean>(true);

    const [chats, setChats] = useState<WhatsAppChat[]>([]);
    const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);

    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

    // 1. Fetch valid instance name
    useEffect(() => {
        const fetchInstanceName = async () => {
            setIsLoadingInstance(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                let name = '';

                // Own connection
                const { data: ownConn } = await (supabase as any)
                    .from('whatsapp_connections')
                    .select('instance_name, status')
                    .eq('user_id', user.id)
                    .eq('status', 'connected')
                    .maybeSingle();

                if (ownConn?.instance_name) {
                    name = ownConn.instance_name;
                } else if (workspaceId) {
                    // Workspace owner's connection
                    const { data: ws } = await (supabase as any)
                        .from('workspaces')
                        .select('owner_id')
                        .eq('id', workspaceId)
                        .single();

                    if (ws?.owner_id && ws.owner_id !== user.id) {
                        const { data: ownerConn } = await (supabase as any)
                            .from('whatsapp_connections')
                            .select('instance_name, status')
                            .eq('user_id', ws.owner_id)
                            .eq('status', 'connected')
                            .maybeSingle();

                        if (ownerConn?.instance_name) {
                            name = ownerConn.instance_name;
                        }
                    }
                }

                if (name) {
                    setInstanceName(name);
                    setIsConnected(true);
                } else {
                    setIsConnected(false);
                }

            } catch (err) {
                console.error('[WhatsApp] Error fetching instance name:', err);
                setIsConnected(false);
            } finally {
                setIsLoadingInstance(false);
            }
        };

        fetchInstanceName();
    }, [workspaceId]);

    // Format chat timestamp safely
    const formatTime = (timestampMs: number) => {
        if (!timestampMs) return '';
        const d = new Date(timestampMs);
        if (isNaN(d.getTime())) return '';

        const today = new Date();
        if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    // 2. Fetch all chats
    const fetchChats = useCallback(async () => {
        if (!instanceName) return;
        setIsLoadingChats(true);
        try {
            const res = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instanceName}`, {
                method: 'POST',
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // Returns all chats
            });

            if (!res.ok) throw new Error(`Evolution API Error: ${res.status}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                const mappedChats: WhatsAppChat[] = data.map(chat => {
                    // Chat profile pictures usually require a separated endpoint in bailey-based APIs,
                    // but sometimes they come in the list or we use fallback.
                    const timestamp = (chat.conversationTimestamp || 0) * 1000;

                    // Extracts text from the last message (can be conversation, extendedTextMessage, etc)
                    let lastMessageText = '...';
                    const msgSnippet = chat.messages?.[0]?.message;
                    if (msgSnippet) {
                        if (msgSnippet.conversation) lastMessageText = msgSnippet.conversation;
                        else if (msgSnippet.extendedTextMessage?.text) lastMessageText = msgSnippet.extendedTextMessage.text;
                        else if (msgSnippet.imageMessage) lastMessageText = '📷 Foto';
                        else if (msgSnippet.audioMessage) lastMessageText = '🎵 Áudio';
                        else if (msgSnippet.videoMessage) lastMessageText = '🎥 Vídeo';
                        else if (msgSnippet.documentMessage) lastMessageText = '📄 Documento';
                    }

                    const chatId = chat.remoteJid || chat.jid || (chat.id && chat.id.includes('@') ? chat.id : null) || chat.id;
                    const safeName = chat.name || chat.pushName || (chatId ? String(chatId).split('@')[0] : 'Unknown');

                    return {
                        id: chatId,
                        name: safeName,
                        avatar: chat.profilePictureUrl || undefined,
                        lastMessage: lastMessageText,
                        time: formatTime(timestamp),
                        timestamp: timestamp,
                        unread: chat.unreadCount || 0,
                        online: false // Mocked
                    };
                });

                if (mappedChats.length > 0) {
                    console.log("[WhatsApp] Sample mapped chat ID:", mappedChats[0].id);
                    console.log("[WhatsApp] Sample raw chat from API:", data[0]);
                }

                // Sort by most recent
                mappedChats.sort((a, b) => b.timestamp - a.timestamp);
                setChats(mappedChats);
            }
        } catch (err) {
            console.error('[WhatsApp] Error fetching chats:', err);
        } finally {
            setIsLoadingChats(false);
        }
    }, [instanceName]);

    // 3. Fetch messages for a specific chat
    const fetchMessages = useCallback(async (remoteJid: string) => {
        if (!instanceName || !remoteJid) return;
        setIsLoadingMessages(true);
        setSelectedChatId(remoteJid);

        try {
            const res = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                method: 'POST',
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                },
                // Evolution V2 often requires the nested 'where' clause
                body: JSON.stringify({ where: { remoteJid } })
            });

            if (!res.ok) throw new Error(`Evolution API Error: ${res.status}`);
            const data = await res.json();

            console.log("[WhatsApp] Raw messages from API:", data);

            // Sometimes the array is direct, sometimes inside .messages
            const rawMsgs = Array.isArray(data) ? data : (data.messages || []);

            if (rawMsgs && rawMsgs.length > 0) {
                const mappedMessages: WhatsAppMessage[] = rawMsgs.map((m: any) => {
                    const fromMe = m.key?.fromMe || m.fromMe || false;
                    const timestampMs = (m.messageTimestamp || m.timestamp || 0) * 1000;

                    let text = '';
                    if (m.message?.conversation) text = m.message.conversation;
                    else if (m.message?.extendedTextMessage?.text) text = m.message.extendedTextMessage.text;
                    else if (m.message?.imageMessage) text = '📷 Foto';
                    else if (m.message?.audioMessage) text = '🎵 Áudio';
                    else if (m.message?.videoMessage) text = '🎥 Vídeo';
                    else if (m.message?.documentMessage) text = '📄 Documento';
                    else if (m.text) text = m.text; // Fallback structure
                    else text = 'Mensagem não suportada';

                    // Parse Status
                    let status: WhatsAppMessage['status'] = 'sent';
                    if (m.status === 'ERROR') status = 'pending';
                    else if (m.status === 'PENDING') status = 'pending';
                    else if (m.status === 'SERVER_ACK') status = 'sent';
                    else if (m.status === 'DELIVERY_ACK') status = 'delivered';
                    else if (m.status === 'READ') status = 'read';
                    else if (fromMe) status = 'delivered'; // Fallback for me

                    return {
                        id: m.key?.id || m.id || String(Math.random()),
                        text,
                        sender: fromMe ? 'me' : 'them',
                        fromMe,
                        timestamp: formatTime(timestampMs),
                        rawTimestamp: timestampMs, // for sorting safely
                        status
                    };
                }).filter((m: any) => m.text); // filter out empty

                mappedMessages.sort((a: any, b: any) => a.rawTimestamp - b.rawTimestamp);
                setMessages(mappedMessages);
            } else {
                setMessages([]);
            }
        } catch (err) {
            console.error('[WhatsApp] Error fetching messages:', err);
            setMessages([]);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [instanceName]);

    // 4. Send Message
    const sendMessage = useCallback(async (remoteJid: string, text: string) => {
        if (!instanceName || !remoteJid || !text.trim()) return false;

        // Optimistic UI update
        const tempId = 'temp-' + Date.now();
        const newMessage: WhatsAppMessage = {
            id: tempId,
            text,
            sender: 'me',
            fromMe: true,
            timestamp: formatTime(Date.now()),
            status: 'pending'
        };

        setMessages(prev => [...prev, newMessage]);

        try {
            const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: remoteJid,
                    text: text
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to send text message. Status: ${res.status}. Body: ${errText}`);
            }

            // Wait a moment and refetch this chat to update status / id
            setTimeout(() => {
                fetchMessages(remoteJid);
                // Also update chats list to bubble this to top
                fetchChats();
            }, 2000);

            return true;
        } catch (err) {
            console.error('[WhatsApp] Send error:', err);
            // Revert status to error/failed
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, text: m.text + ' (Erro ao enviar)' } : m));
            return false;
        }
    }, [instanceName, fetchMessages, fetchChats]);

    // Initial load
    useEffect(() => {
        if (isConnected) {
            fetchChats();
        }
    }, [isConnected, fetchChats]);

    return {
        instanceName,
        isConnected,
        isLoadingInstance,
        chats,
        isLoadingChats,
        selectedChatId,
        messages,
        isLoadingMessages,
        fetchChats,
        fetchMessages,
        sendMessage
    };
}
