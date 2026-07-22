-- Allow service_role (admin API) to read schema for health checks and server jobs
grant usage on schema public to service_role;
grant select on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select on tables to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
