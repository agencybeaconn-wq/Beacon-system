create type public.crm_lead_status as enum ('contato', 'resposta', 'follow_up', 'fechamento');

create table if not exists public.crm_leads (
    id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    workspace_id uuid null, -- Nullable for now to support non-workspace contexts if needed, but RLS will enforce
    name text not null,
    store_name text null,
    phone text null,
    email text null,
    lead_status public.crm_lead_status not null default 'contato',
    lead_score text null, -- keeping generic text for flexibility (e.g. "Quente", "Frio", "0-100")
    product_interest text null,
    observations text null,
    column_id text null, -- Added for visual column tracking if we want customizable columns later, but enum drives logic
    
    constraint crm_leads_pkey primary key (id),
    constraint crm_leads_workspace_id_fkey foreign key (workspace_id) references public.workspaces (id) on delete cascade
);

-- Indexes
create index if not exists crm_leads_workspace_id_idx on public.crm_leads (workspace_id);
create index if not exists crm_leads_status_idx on public.crm_leads (lead_status);

-- RLS
alter table public.crm_leads enable row level security;

create policy "Enable read access for authenticated users in same workspace"
on public.crm_leads
for select
using (
  auth.uid() in (
    select user_id from team_members
    where team_members.workspace_id = crm_leads.workspace_id
    and team_members.status = 'active'
  )
  or
  exists (
    select 1 from workspaces
    where workspaces.id = crm_leads.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Enable insert for authenticated users in same workspace"
on public.crm_leads
for insert
with check (
  auth.uid() in (
    select user_id from team_members
    where team_members.workspace_id = crm_leads.workspace_id
    and team_members.status = 'active'
  )
  or
  exists (
    select 1 from workspaces
    where workspaces.id = crm_leads.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Enable update for authenticated users in same workspace"
on public.crm_leads
for update
using (
  auth.uid() in (
    select user_id from team_members
    where team_members.workspace_id = crm_leads.workspace_id
    and team_members.status = 'active'
  )
  or
  exists (
    select 1 from workspaces
    where workspaces.id = crm_leads.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Enable delete for authenticated users in same workspace"
on public.crm_leads
for delete
using (
  auth.uid() in (
    select user_id from team_members
    where team_members.workspace_id = crm_leads.workspace_id
    and team_members.status = 'active'
  )
  or
  exists (
    select 1 from workspaces
    where workspaces.id = crm_leads.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);
