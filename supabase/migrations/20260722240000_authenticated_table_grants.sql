-- PostgREST needs table-level GRANTs in addition to RLS policies.
-- Migrations create objects as postgres; without these, the API returns
-- "permission denied for table …" even when RLS would allow the row.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated, anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, anon;
