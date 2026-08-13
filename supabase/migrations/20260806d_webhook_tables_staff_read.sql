-- Módulo Apps Mobile — E1: painel de saúde do vínculo lê webhook_events e
-- webhook_subscriptions. As tabelas só tinham policy de service_role; staff
-- ganha leitura no mesmo padrão do módulo (workspace via agency_clients).

create policy webhook_events_staff_read on public.webhook_events
  for select using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );

create policy webhook_subscriptions_staff_read on public.webhook_subscriptions
  for select using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );
