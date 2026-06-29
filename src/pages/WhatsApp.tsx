import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    MoreVertical,
    MessageSquare,
    Phone,
    Video,
    Paperclip,
    Smile,
    Send,
    CheckCheck,
    Clock,
    UserCircle2,
    Filter,
    Loader2,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function WhatsApp() {
    const {
        isConnected,
        isLoadingInstance,
        chats,
        isLoadingChats,
        selectedChatId,
        messages,
        isLoadingMessages,
        fetchMessages,
        sendMessage
    } = useWhatsApp();

    const [searchQuery, setSearchQuery] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const activeChat = chats.find(c => c.id === selectedChatId);

    const handleChatSelect = (chatId: string) => {
        fetchMessages(chatId);
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedChatId) return;
        const txt = newMessage;
        setNewMessage(""); // Clear input immediately
        const success = await sendMessage(selectedChatId, txt);
        if (!success) {
            toast.error("Erro ao enviar mensagem");
        }
    };

    if (isLoadingInstance) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center m-2 border rounded-xl bg-card">
                <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                    <p>Conectando ao WhatsApp...</p>
                </div>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center m-2 border rounded-xl bg-card">
                <div className="flex flex-col items-center text-center max-w-md p-8">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">WhatsApp Desconectado</h2>
                    <p className="text-muted-foreground mb-6">
                        Para visualizar suas conversas, você precisa conectar seu aparelho ao sistema.
                    </p>
                    <Button asChild className="bg-[#00E676] hover:bg-[#00C853] text-black font-semibold">
                        <Link to="/connections">Conectar WhatsApp</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const filteredChats = chats.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-background border rounded-xl shadow-lg m-2">
            {/* Sidebar de Conversas */}
            <div className="w-[350px] flex flex-col border-r bg-card/50">
                {/* Header Sidebar */}
                <div className="p-4 flex items-center justify-between border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/20">
                            <AvatarFallback>WA</AvatarFallback>
                        </Avatar>
                        <h2 className="font-bold text-lg">Conversas</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar contato ou mensagem"
                            className="pl-10 bg-muted/50 border-none focus-visible:ring-1"
                        />
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                            <Filter className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Chats List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoadingChats ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm">
                            Nenhuma conversa encontrada.
                        </div>
                    ) : (
                        filteredChats.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => handleChatSelect(chat.id)}
                                className={cn(
                                    "flex items-center gap-3 p-4 cursor-pointer transition-colors relative",
                                    selectedChatId === chat.id
                                        ? "bg-primary/10"
                                        : "hover:bg-muted/50"
                                )}
                            >
                                <div className="relative">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={chat.avatar} />
                                        <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {chat.online && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <h4 className="font-semibold text-sm truncate pr-2">{chat.name}</h4>
                                        <span className="text-[10px] text-muted-foreground">{chat.time}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground truncate italic">
                                            {chat.lastMessage}
                                        </p>
                                        {chat.unread > 0 && (
                                            <Badge className="h-5 min-w-[20px] flex items-center justify-center p-0 rounded-full bg-primary text-[10px]">
                                                {chat.unread}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {selectedChatId === chat.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Janela de Chat Aberta */}
            <div className="flex-1 flex flex-col bg-[#0b0e11] dark:bg-[#0b0e11] bg-opacity-[0.02]" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/630/wallpaper-whatsapp-dark-background.jpg")', backgroundBlendMode: 'overlay', backgroundSize: 'cover' }}>
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-3 border-b flex items-center justify-between bg-card">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={activeChat?.avatar} />
                                    <AvatarFallback>{activeChat?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-bold text-sm">{activeChat?.name}</h3>
                                    <p className="text-[10px] text-muted-foreground">
                                        {activeChat?.id.replace('@s.whatsapp.net', '')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                                    <Video className="w-5 h-5 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                                    <Phone className="w-5 h-5 text-muted-foreground" />
                                </Button>
                                <Separator orientation="vertical" className="h-6 mx-1" />
                                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                                    <Search className="w-5 h-5 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {isLoadingMessages ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : messages.length > 0 ? (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex flex-col max-w-[70%] group",
                                            msg.sender === 'me' ? "ml-auto items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "px-4 py-2 shadow-sm text-sm relative",
                                                msg.sender === 'me'
                                                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
                                                    : "bg-card border rounded-2xl rounded-tl-none"
                                            )}
                                        >
                                            {msg.text}
                                            <div className={cn(
                                                "flex items-center gap-1 mt-1 justify-end",
                                                msg.sender === 'me' ? "text-primary-foreground/70" : "text-muted-foreground"
                                            )}>
                                                <span className="text-[9px] uppercase font-medium">{msg.timestamp}</span>
                                                {msg.sender === 'me' && (
                                                    <CheckCheck className={cn(
                                                        "w-3 h-3 outline-none",
                                                        msg.status === 'read' ? "text-blue-300" : "",
                                                        msg.status === 'pending' ? "opacity-50" : ""
                                                    )} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-50">
                                    <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                                    <h3 className="text-xl font-bold">Nenhuma mensagem aqui</h3>
                                    <p className="max-w-xs text-sm mt-2">
                                        Envie uma mensagem para iniciar a conversa.
                                    </p>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input Container */}
                        <div className="p-4 bg-muted/30 border-t backdrop-blur-md">
                            <div className="max-w-4xl mx-auto flex items-center gap-3">
                                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 text-muted-foreground">
                                    <Smile className="w-6 h-6" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 text-muted-foreground">
                                    <Paperclip className="w-5 h-5" />
                                </Button>
                                <div className="flex-1 relative">
                                    <Input
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Digite uma mensagem"
                                        className="bg-background/80 border-none h-11 px-4 rounded-xl focus-visible:ring-1"
                                    />
                                </div>
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim()}
                                    size="icon"
                                    className="rounded-full h-11 w-11 shrink-0 bg-primary hover:scale-105 transition-transform disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-50">
                        <UserCircle2 className="w-20 h-20 mb-4" />
                        <h3 className="text-xl font-bold">WhatsApp Beacon</h3>
                        <p className="max-w-xs text-sm mt-2">
                            Selecione uma conversa ao lado para começar a enviar mensagens.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Separator({ orientation, className }: { orientation: 'horizontal' | 'vertical', className?: string }) {
    return <div className={cn(orientation === 'vertical' ? 'w-[1px] h-full' : 'h-[1px] w-full', 'bg-border', className)} />;
}
