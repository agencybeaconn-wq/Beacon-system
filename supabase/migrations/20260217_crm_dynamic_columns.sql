-- Create CRM Kanban Columns table
create table if not exists public.crm_kanban_columns (
    id uuid not null default gen_random_uuid(),
    workspace_id uuid not null,
    title text not null,
    color text null,
    order_index integer not null default 0,
    created_at timestamp with time zone not null default now(),
    
    constraint crm_kanban_columns_pkey primary key (id),
    constraint crm_kanban_columns_workspace_id_fkey foreign key (workspace_id) references public.workspaces (id) on delete cascade
);

-- RLS for crm_kanban_columns
alter table public.crm_kanban_columns enable row level security;

create policy "Enable access for workspace members"
on public.crm_kanban_columns
for all
using (
  auth.uid() in (
    select user_id from team_members
    where team_members.workspace_id = crm_kanban_columns.workspace_id
    and team_members.status = 'active'
  )
  or
  exists (
    select 1 from workspaces
    where workspaces.id = crm_kanban_columns.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

-- Seed default columns for existing workspaces
insert into public.crm_kanban_columns (workspace_id, title, color, order_index)
select distinct workspace_id, 'Contato', 'bg-blue-500/20 border-blue-500/30 text-blue-400', 0 from public.crm_leads where workspace_id is not null
union all
select distinct workspace_id, 'Envio de Resposta', 'bg-amber-500/20 border-amber-500/30 text-amber-400', 1 from public.crm_leads where workspace_id is not null
union all
select distinct workspace_id, 'Follow Up', 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400', 2 from public.crm_leads where workspace_id is not null
union all
select distinct workspace_id, 'Fechamento', 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', 3 from public.crm_leads where workspace_id is not null;

-- Update crm_leads to use the new column_id if we want, but for now we can keep lead_status as text if we prefer.
-- However, since lead_status is an ENUM, it's restrictive. Let's add a migration to change lead_status to TEXT or add a new column.
-- We already have column_id as text. Let's use it.

-- Backfill column_id based on lead_status
-- This is tricky because we need to match the titles we just inserted.
update public.crm_leads l
set column_id = c.id::text
from public.crm_kanban_columns c
where l.workspace_id = c.workspace_id
and (
    (l.lead_status = 'contato' and c.title = 'Contato') or
    (l.lead_status = 'resposta' and c.title = 'Envio de Resposta') or
    (l.lead_status = 'follow_up' and c.title = 'Follow Up') or
    (l.lead_status = 'fechamento' and c.title = 'Fechamento')
);
