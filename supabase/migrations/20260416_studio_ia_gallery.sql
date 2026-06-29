-- Studio IA: tabela de imagens geradas + bucket de storage

-- Tabela principal
create table if not exists public.studio_ia_images (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.agency_clients(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  prompt       text not null,
  storage_path text not null,
  public_url   text not null,
  mime_type    text not null default 'image/png',
  model        text not null,
  aspect_ratio text not null default '1:1',
  created_at   timestamptz not null default now()
);

-- Índices para performance
create index if not exists studio_ia_images_client_id_idx on public.studio_ia_images(client_id);
create index if not exists studio_ia_images_workspace_id_idx on public.studio_ia_images(workspace_id);
create index if not exists studio_ia_images_created_at_idx on public.studio_ia_images(created_at desc);

-- RLS
alter table public.studio_ia_images enable row level security;

create policy "workspace members can read studio images"
  on public.studio_ia_images for select
  using (
    workspace_id in (
      select workspace_id from public.team_members
      where user_id = auth.uid()
    )
  );

create policy "workspace members can insert studio images"
  on public.studio_ia_images for insert
  with check (
    workspace_id in (
      select workspace_id from public.team_members
      where user_id = auth.uid()
    )
  );

create policy "workspace members can delete studio images"
  on public.studio_ia_images for delete
  using (
    workspace_id in (
      select workspace_id from public.team_members
      where user_id = auth.uid()
    )
  );

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-ia',
  'studio-ia',
  true,
  10485760, -- 10MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies
create policy "workspace members can upload studio images"
  on storage.objects for insert
  with check (bucket_id = 'studio-ia' and auth.role() = 'authenticated');

create policy "studio images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'studio-ia');

create policy "workspace members can delete studio images"
  on storage.objects for delete
  using (bucket_id = 'studio-ia' and auth.role() = 'authenticated');
