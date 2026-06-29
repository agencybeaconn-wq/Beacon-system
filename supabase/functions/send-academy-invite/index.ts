/**
 * Send Academy Invite — Edge Function
 * Envia o link de convite do Lever Academy pra um email via Resend.
 * Body esperado: { invite_id: uuid } — busca o convite, gera link + email, envia.
 */

import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const getAcademyEmailHtml = (opts: {
  recipientName?: string | null;
  moduleTitle: string;
  moduleType: 'course' | 'mentoria';
  inviteLink: string;
  expiresAt?: string | null;
  customNote?: string | null;
}) => {
  const typeLabel = opts.moduleType === 'mentoria' ? '🎯 Mentoria' : '📚 Curso';
  const greeting = opts.recipientName ? `Olá, ${opts.recipientName}!` : 'Olá!';
  const expiryNote = opts.expiresAt
    ? `<p style="color: #666; font-size: 13px; margin-top: 24px;">⏰ Este link expira em <strong>${new Date(opts.expiresAt).toLocaleDateString('pt-BR')}</strong>.</p>`
    : '';
  const customNoteHtml = opts.customNote
    ? `<p style="color: #555; font-size: 14px; margin: 16px 0; padding: 12px; background: #f5f5f5; border-left: 3px solid #e11d2e; border-radius: 4px;"><em>${opts.customNote}</em></p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu acesso ao Beacon Academy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body, h1, h2, h3, p, a, span, div { font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 24px;">
    <div style="background: #0a0a0a; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://pub-741e79c7a4b84c228594bbc296d1fbdd.r2.dev/lever-system/Logos/LeverPng-Vermelho.png" alt="Lever" style="width: 160px; height: auto; margin: 0 auto 8px; display: block;" />
      <p style="color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; margin: 0; opacity: 0.8;">
        Academy
      </p>
    </div>
    <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; border: 1px solid #eee; border-top: none;">
      <p style="font-size: 13px; color: #e11d2e; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 8px;">
        ${typeLabel}
      </p>
      <h2 style="font-size: 24px; color: #0a0a0a; font-weight: 800; margin: 0 0 16px; letter-spacing: -0.02em; line-height: 1.2;">
        ${greeting}
      </h2>
      <p style="font-size: 16px; color: #333; line-height: 1.5; margin: 0 0 20px; font-weight: 400;">
        Você foi convidado pra acessar <strong>${opts.moduleTitle}</strong> no Beacon Academy.
      </p>
      ${customNoteHtml}
      <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 28px; font-weight: 400;">
        Clique no botão abaixo pra ativar seu acesso. Se ainda não tiver conta, é só criar uma na hora — o convite será ativado automaticamente.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${opts.inviteLink}"
           style="display: inline-block; background: #e11d2e; color: #fff; padding: 14px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px;">
          Acessar agora
        </a>
      </div>
      <p style="font-size: 12px; color: #999; margin: 24px 0 0; word-break: break-all; font-weight: 400;">
        Ou copie este link:<br/>
        <a href="${opts.inviteLink}" style="color: #e11d2e; text-decoration: none;">${opts.inviteLink}</a>
      </p>
      ${expiryNote}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 20px;" />
      <p style="font-size: 11px; color: #aaa; margin: 0; text-align: center; font-weight: 500;">
        Beacon Agency · educação prática em IA e desenvolvimento
      </p>
    </div>
  </div>
</body>
</html>`;
};

Deno.serve(instrument("send-academy-invite", async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Valida usuário (admin do Academy)
    const isServiceRole = !!SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY;
    if (!isServiceRole) {
      const supaAuth = createClient(SUPABASE_URL, ANON_KEY);
      const { data: { user }, error: authError } = await supaAuth.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Checa se é admin do Academy
      const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: student } = await supaAdmin
        .from('academy_students')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!student?.is_admin) {
        return new Response(JSON.stringify({ error: 'Acesso negado — só admin do Academy pode enviar convites' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { invite_id, override_email, override_link_base } = await req.json();
    if (!invite_id) {
      return new Response(JSON.stringify({ error: 'invite_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: invite, error: inviteErr } = await supaAdmin
      .from('academy_invites')
      .select('*, academy_modules(title, slug, type)')
      .eq('id', invite_id)
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: 'Convite não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientEmail = override_email || invite.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'Nenhum email destinatário (preencha no convite ou passe override_email)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const linkBase = (
      override_link_base
      || Deno.env.get('APP_PUBLIC_URL')
      || Deno.env.get('NEXT_PUBLIC_APP_URL')
      || 'https://leverag.digital'
    ).replace(/\/$/, '');
    const inviteLink = `${linkBase}/academy/convite/${invite.token}`;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada nos secrets do Supabase' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'Lever Academy <contato@leverag.digital>';
    const moduleTitle = invite.academy_modules?.title || 'Beacon Academy';
    const moduleType = (invite.academy_modules?.type || 'course') as 'course' | 'mentoria';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipientEmail],
        subject: `Seu acesso: ${moduleTitle}`,
        html: getAcademyEmailHtml({
          moduleTitle,
          moduleType,
          inviteLink,
          expiresAt: invite.expires_at,
          customNote: invite.note,
        }),
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json().catch(() => ({}));
      console.error('[send-academy-invite] Resend error:', errData);
      return new Response(JSON.stringify({ error: `Erro no Resend: ${errData.message || emailRes.statusText}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Marca email como enviado (atualiza registro — opcional)
    await supaAdmin
      .from('academy_invites')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', invite_id);

    return new Response(JSON.stringify({ success: true, sent_to: recipientEmail, link: inviteLink }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-academy-invite] Fatal:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));
