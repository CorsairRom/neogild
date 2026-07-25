-- Track the last imported cartola's closing balance so we can surface
-- a reconciliation delta against the ledger-derived account.balance.

alter table accounts
  add column last_statement_balance bigint,
  add column last_statement_date date;
