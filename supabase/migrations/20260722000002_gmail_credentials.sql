-- Per-user Gmail OAuth credentials (single-user MVP, multi-user ready)
create table if not exists gmail_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  email_address text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table gmail_credentials enable row level security;

create policy "gmail_credentials_select" on gmail_credentials
  for select using ((select auth.uid()) = user_id);
create policy "gmail_credentials_delete" on gmail_credentials
  for delete using ((select auth.uid()) = user_id);

-- Inserts/updates via service role only (OAuth callback)
grant select, delete on gmail_credentials to authenticated;
grant all on gmail_credentials to service_role;

-- Allow 'unknown' source in email_movements (already in neogild_extensions; ensure constraint)
-- Forward detection uses bank source when parseable; 'unknown' for stubs only.
