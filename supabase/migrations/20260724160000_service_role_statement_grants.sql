-- service_role inserts for cartola import and sync staging
grant insert, update, delete on statement_entries to service_role;
grant insert, update, delete on transactions to service_role;
