-- Allow service_role (load scripts / admin API) to manage accounts.
grant insert, update on accounts to service_role;
grant insert, update on profiles to service_role;
