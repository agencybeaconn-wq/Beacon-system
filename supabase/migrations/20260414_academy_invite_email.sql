-- Adiciona campo email ao convite pra registrar pra quem foi enviado
ALTER TABLE academy_invites
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN academy_invites.email IS
'Email de quem vai receber o convite (opcional — só pra registro; não envia email automaticamente)';

CREATE INDEX IF NOT EXISTS idx_academy_invites_email ON academy_invites(email);
