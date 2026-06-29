import { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLadsAI } from "@/hooks/useLadsAI";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChatMessageRenderer } from "@/components/ChatMessageRenderer";

import { ThinkingIndicator } from "@/components/ui/ThinkingIndicator";
import { CreativeSelectionWizard } from "@/components/ui/chat/CreativeSelectionWizard";

import { useChat } from "@/contexts/ChatContext";
import { useDashboard } from "@/contexts/DashboardContext";

// Interface Message removida pois agora vem do Context



export default function Chat() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { messages, input, setInput, sendMessage, isLoading, activeDraftCard, draftCampaign, resetChat, creativeWizardData, setCreativeWizardData, applyCreativeAssignments, setPreSelectedCreatives } = useChat();
  const { selectedAccountId, isLoading: isDashboardLoading } = useDashboard();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [campaignContext, setCampaignContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect logic removed to allow user to stay in chat
  // useEffect(() => {
  //   if (activeDraftCard) {
  //     navigate('/campaigns');
  //     toast({ title: "Edição de Rascunho", description: "Redirecionando para a tela de Campanhas para editar o rascunho." });
  //   }
  // }, [activeDraftCard]);

  // Auto-scroll when messages change or loading starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  // Estados locais removidos em favor do Context

  // Lógica de seleção de conta e boas-vindas removida (agora no Context)

  // Preencher input com mensagem da query string
  useEffect(() => {
    const messageParam = searchParams.get("message");
    if (messageParam) {
      setInput(decodeURIComponent(messageParam));
      // Limpar o parâmetro da URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const location = useLocation();

  useEffect(() => {
    // Carregar contexto das campanhas se existir
    const savedContext = localStorage.getItem('campaignContext');
    if (savedContext) {
      try {
        const context = JSON.parse(savedContext);
        setCampaignContext(context);

        // Adicionar mensagens anteriores do mini chat
        if (context.messages && context.messages.length > 0) {
          // Adicionar mensagem do usuário com dados formatados
          const userMessages = context.messages.filter((msg: any) => msg.role === 'user');
          if (userMessages.length > 0) {
            // setMessages removido - o contexto já deve ter as mensagens se persistido
            // Se necessário adicionar mensagens do contexto antigo, criar função no Context
            // Por enquanto, vamos assumir que o histórico persistido é suficiente ou que o usuário enviará a mensagem formatada

            // Se houver uma mensagem formatada, enviar automaticamente para a IA
            const formattedMessage = userMessages[0];
            if (formattedMessage.content.includes('DADOS PARA ANÁLISE')) {
              // Enviar automaticamente para análise via Context
              sendMessage(formattedMessage.content);
            }
          }
        }

        // Limpar contexto do localStorage
        localStorage.removeItem('campaignContext');
      } catch (error) {
        console.error('Error loading campaign context:', error);
      }
    }

    // Check for autoSend intent from SmartDock
    if (location.state?.autoSend) {
      const autoSendMessage = location.state.autoSend;
      console.log("🤖 [CHAT] Auto-sending message:", autoSendMessage);

      // Send the message
      sendMessage(autoSendMessage);

      // Clear the state to prevent re-sending on refresh
      window.history.replaceState({}, document.title);
    }

    // Check for selected creatives from Assets page
    if (location.state?.selectedCreatives) {
      const creatives = location.state.selectedCreatives;
      console.log("🎨 [CHAT] Received selected creatives from Library:", creatives);

      // Store creatives in context for smart wizard logic
      setPreSelectedCreatives(creatives);

      // Send user-friendly message to AI to start campaign flow
      const creativeNames = creatives.map((c: any) => c.name || 'Criativo').join(', ');
      const userMessage = creatives.length === 1
        ? `Quero criar uma campanha usando esse criativo: ${creativeNames}`
        : `Quero criar uma campanha usando esses ${creatives.length} criativos: ${creativeNames}`;

      sendMessage(userMessage);

      // Clear state to avoid re-sending on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setPreSelectedCreatives]);

  // 🔥 DEBUG: Verificar contexto de conta
  useEffect(() => {
    // Só mostrar aviso se NÃO estiver carregando e NÃO tiver conta
    if (!isDashboardLoading && !selectedAccountId) {
      console.warn("⚠️ [CHAT] Nenhuma conta de anúncios selecionada no contexto global!");
      toast({
        title: t('chat.toasts.attention', 'Attention'),
        description: t('chat.toasts.no_account_selected', 'No account selected. The chat may not work correctly.'),
        variant: "destructive",
      });
    } else if (selectedAccountId) {
      console.log("✅ [CHAT] Conta selecionada:", selectedAccountId);
    }
  }, [selectedAccountId, isDashboardLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage();
  };



  return (
    <div className="flex flex-col h-[calc(100dvh-6.5rem)] sm:h-[calc(100vh-8rem)] w-full max-w-full overflow-x-hidden box-border">
      {/* Page Title */}
      <div className="mb-2 sm:mb-6 w-full max-w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">Beacon AI</h1>
            {campaignContext && (
              <Badge variant="secondary" className="mb-1 sm:mb-2">
                {campaignContext.selectedItems.length} {campaignContext.entityType}
              </Badge>
            )}
          </div>
          {/* Reset Button - For error recovery */}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetChat}
            className="text-muted-foreground hover:text-foreground h-7 sm:h-9"
            title={t('chat.actions.reset_conversation', 'Reset conversation')}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t('chat.actions.reset', 'Reset')}</span>
          </Button>
        </div>
        <p className="text-xs sm:text-base text-muted-foreground">
          {t('chat.subtitle', 'Chat with AI to get insights and optimizations')}
        </p>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col backdrop-blur-sm bg-card/50 border-border/50 overflow-hidden w-full max-w-full box-border">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 space-y-2 sm:space-y-4">
          {messages.map((message, index) => {


            // Ocultar outras mensagens de função
            if (message.role === 'function') return null;

            return (
              <ChatMessageRenderer
                key={message.id || index}
                message={message}
                isLast={index === messages.length - 1}
                isLoading={isLoading}
              />
            );
          })}
          {isLoading && messages.length > 0 && (
            <div className="flex items-center py-2 px-4">
              <ThinkingIndicator lastUserMessage={messages[messages.length - 1]?.role === 'user' ? messages[messages.length - 1]?.content : undefined} />
            </div>
          )}

          {/* Draft Created Card removed - now shown as a normal message with button */}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 p-2 sm:p-4 bg-card/80 backdrop-blur-sm w-full max-w-full box-border">


          {/* Input Box */}
          <div className="flex items-center gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={selectedAccountId ? t('chat.placeholder.type_question', 'Type your question...') : t('chat.placeholder.select_account', 'Select an account to start...')}
              className="h-[40px] sm:h-[50px] min-h-[40px] sm:min-h-[50px] max-h-[120px] resize-none text-[16px] sm:text-base py-[8px] sm:py-[12px] flex-1"
              disabled={isLoading || !selectedAccountId}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !selectedAccountId}
              size="icon"
              className="h-[40px] w-[40px] sm:h-[50px] sm:w-[50px] bg-meta-gradient hover:opacity-90 hover:shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
          </div>
        </div>
      </Card >

      {/* Creative Selection Wizard - Rendered at Root Level for Full Screen */}
      {
        creativeWizardData && (
          <CreativeSelectionWizard
            campaignName={creativeWizardData.campaignName}
            adSets={creativeWizardData.adSets}
            creatives={creativeWizardData.creatives}
            onComplete={applyCreativeAssignments}
            onCancel={() => setCreativeWizardData(null)}
          />
        )
      }
    </div >
  );
}
