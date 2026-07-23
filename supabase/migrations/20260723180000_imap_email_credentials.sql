-- ADR-012: IMAP + App Password replaces Gmail OAuth refresh tokens

create table if not exists email_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  imap_user text not null,
  app_password text not null,
  imap_host text not null default 'imap.gmail.com',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table email_credentials enable row level security;

create policy "email_credentials_select" on email_credentials
  for select using ((select auth.uid()) = user_id);

create policy "email_credentials_delete" on email_credentials
  for delete using ((select auth.uid()) = user_id);

revoke all on email_credentials from authenticated;
grant select (user_id, imap_user, imap_host, connected_at, updated_at) on email_credentials to authenticated;
grant delete on email_credentials to authenticated;
grant all on email_credentials to service_role;

drop table if exists gmail_credentials;
