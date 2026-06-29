/**
 * useOnboardingAutoDetection — Auto-marca tasks de onboarding baseado no estado do sistema
 *
 * Detecta:
 * - Briefing existe para o cliente → marca 'acompanhar_briefing'
 * - Briefing com status 'completed' → marca 'briefing_validado'
 * - Shopify conectado → marca 'solicitar_acessos' (quando relevante)
 *
 * Regras:
 * - Só marca tasks com status 'pendente' (nunca sobrescreve manual)
 * - Usa ref para evitar re-trigger em re-renders
 * - Roda apenas uma vez por onboarding.id
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingFull } from '@/types/onboarding';

interface AutoDetectionParams {
  onboarding: OnboardingFull | null;
  clientId: string | null;
  clientData: any; // agency_clients row
  completeTask: (taskId: string) => Promise<void>;
}

export function useOnboardingAutoDetection({
  onboarding,
  clientId,
  clientData,
  completeTask,
}: AutoDetectionParams) {
  // Ref para rastrear qual "versão" do onboarding já foi processada (evita loops)
  // Usa id + contagem de fases como fingerprint para detectar recriações de tipo
  const processedRef = useRef<string | null>(null);

  const onboardingFingerprint = onboarding
    ? `${onboarding.id}_${onboarding.phases.length}_${onboarding.type}`
    : null;

  useEffect(() => {
    if (!onboarding || !clientId || !onboardingFingerprint) return;
    if (processedRef.current === onboardingFingerprint) return;

    const detect = async () => {
      const detectedTaskKeys = new Set<string>();

      try {
        // 1. Briefing — verificar se existe para o cliente
        const { data: briefing } = await (supabase as any)
          .from('briefings')
          .select('id, status')
          .eq('client_group_id', clientId)
          .limit(1)
          .maybeSingle();

        if (briefing) {
          detectedTaskKeys.add('acompanhar_briefing');
          detectedTaskKeys.add('enviar_briefing');
        }
        if (briefing?.status === 'completed') {
          // Briefing completo = toda a fase de briefing está resolvida
          detectedTaskKeys.add('briefing_validado');
          detectedTaskKeys.add('solicitar_faltantes');
          detectedTaskKeys.add('solicitar_acessos');
        }

        // 2. Shopify — verificar se está conectado
        if (clientData?.shopify_status === 'connected') {
          detectedTaskKeys.add('solicitar_acessos');
          detectedTaskKeys.add('instalar_tema');
        }

        // 3. WhatsApp — se grupo já foi criado no onboarding
        if (onboarding.whatsapp_group_created) {
          detectedTaskKeys.add('criar_grupo_whatsapp');
          detectedTaskKeys.add('adicionar_membros_grupo');
          detectedTaskKeys.add('adicionar_membros');
        }

        // 4. Portal — se acesso já foi concedido
        if (onboarding.portal_access_granted) {
          detectedTaskKeys.add('conceder_acesso_portal');
        }
      } catch (err) {
        console.error('[useOnboardingAutoDetection] Erro na detecção:', err);
        return; // Não marcar nada se houver erro
      }

      if (detectedTaskKeys.size === 0) {
        processedRef.current = onboardingFingerprint;
        return;
      }

      // Mapear task_keys para task IDs que estão 'pendente'
      const tasksToComplete: string[] = [];
      for (const phase of onboarding.phases) {
        for (const task of phase.tasks) {
          if (detectedTaskKeys.has(task.task_key) && task.status === 'pendente') {
            tasksToComplete.push(task.id);
          }
        }
      }

      // Marcar processado ANTES de completar (evita re-trigger)
      processedRef.current = onboardingFingerprint;

      // Completar tasks sequencialmente (evita race conditions)
      for (const taskId of tasksToComplete) {
        await completeTask(taskId);
      }
    };

    detect();
  }, [onboardingFingerprint, clientId, clientData?.shopify_status]);
}
