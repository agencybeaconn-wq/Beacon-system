import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AcademyInvite {
  id: string;
  token: string;
  module_id: string;
  email: string | null;
  note: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Join opcional com module
  academy_modules?: { title: string; slug: string; type: string };
}

export interface RedeemResult {
  success: boolean;
  error: string | null;
  module_id: string | null;
  module_slug: string | null;
  module_title: string | null;
}

export function useAcademyInvites() {
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [loading, setLoading] = useState(false);

  const list = useCallback(async (moduleId?: string) => {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from('academy_invites')
        .select('*, academy_modules(title, slug, type)')
        .order('created_at', { ascending: false });
      if (moduleId) q = q.eq('module_id', moduleId);
      const { data, error } = await q;
      if (error) throw error;
      setInvites(data || []);
      return data || [];
    } catch (e: any) {
      toast.error('Erro ao listar convites: ' + e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (payload: {
    module_id: string;
    email?: string | null;
    note?: string | null;
    max_uses?: number | null;
    expires_at?: string | null;
  }) => {
    try {
      const { data, error } = await (supabase as any)
        .from('academy_invites')
        .insert({
          module_id: payload.module_id,
          email: payload.email ?? null,
          note: payload.note ?? null,
          max_uses: payload.max_uses ?? 1,
          expires_at: payload.expires_at ?? null,
        })
        .select('*, academy_modules(title, slug, type)')
        .single();
      if (error) throw error;
      toast.success('Convite criado');
      await list();
      return data as AcademyInvite;
    } catch (e: any) {
      toast.error('Erro ao criar convite: ' + e.message);
      throw e;
    }
  }, [list]);

  const revoke = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('academy_invites')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast.success('Convite desativado');
      await list();
    } catch (e: any) {
      toast.error('Erro ao desativar: ' + e.message);
    }
  }, [list]);

  const remove = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('academy_invites')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Convite removido');
      await list();
    } catch (e: any) {
      toast.error('Erro ao remover: ' + e.message);
    }
  }, [list]);

  const redeem = useCallback(async (token: string): Promise<RedeemResult> => {
    try {
      const { data, error } = await (supabase as any).rpc('redeem_academy_invite', { invite_token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as RedeemResult;
    } catch (e: any) {
      return { success: false, error: e.message, module_id: null, module_slug: null, module_title: null };
    }
  }, []);

  const buildLink = useCallback((token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/academy/convite/${token}`;
  }, []);

  const sendEmail = useCallback(async (invite: AcademyInvite, overrideEmail?: string): Promise<boolean> => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const isLocal = /localhost|127\.0\.0\.1/.test(origin);
      const { data, error } = await supabase.functions.invoke('send-academy-invite', {
        body: {
          invite_id: invite.id,
          override_email: overrideEmail || undefined,
          override_link_base: !isLocal && origin ? origin : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Email enviado pra ${(data as any)?.sent_to || 'destinatário'}`);
      return true;
    } catch (e: any) {
      toast.error('Erro ao enviar email: ' + e.message);
      return false;
    }
  }, []);

  const buildMailto = useCallback((invite: AcademyInvite) => {
    const link = buildLink(invite.token);
    const moduleTitle = invite.academy_modules?.title || 'Lever Academy';
    const subject = encodeURIComponent(`Seu acesso: ${moduleTitle}`);
    const body = encodeURIComponent(
      `Olá!\n\n` +
      `Você foi convidado pra ${invite.academy_modules?.type === 'mentoria' ? 'mentoria' : 'o curso'}: ${moduleTitle}.\n\n` +
      `Clica no link abaixo pra ativar seu acesso:\n${link}\n\n` +
      `Se ainda não tiver conta no Lever Academy, é só criar uma na hora do acesso — o convite ativa automaticamente.\n\n` +
      (invite.expires_at ? `⏰ Este link expira em ${new Date(invite.expires_at).toLocaleDateString('pt-BR')}.\n\n` : '') +
      `Qualquer dúvida, fala comigo.\n` +
      `Abraço!`
    );
    const to = invite.email ? encodeURIComponent(invite.email) : '';
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [buildLink]);

  return { invites, loading, list, create, revoke, remove, redeem, buildLink, buildMailto, sendEmail };
}
