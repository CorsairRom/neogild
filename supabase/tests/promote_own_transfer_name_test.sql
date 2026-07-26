begin;
select plan(10);

-- User with profile name — single-sided own transfers infer as transfer pairs.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
values ('a9000000-0000-0000-0000-000000000001', 'own-name@example.com',
        crypt('password', gen_salt('bf')), now(), 'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000');

insert into profiles (id, name) values
  ('a9000000-0000-0000-0000-000000000001', 'Richard Alexis Romero Moore')
on conflict (id) do update set name = excluded.name;

insert into accounts (id, user_id, name, type, subtype, entity, on_budget, metadata) values
  ('a9200000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001',
   'Cuenta Corriente Banco de Chile', 'asset', 'debit', 'personal', true,
   '{"bank_account_numbers": ["1122334455"]}'),
  ('a9200000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000001',
   'CuentaRUT BancoEstado', 'asset', 'debit', 'personal', true,
   '{"bank_account_numbers": ["18202300"]}');

-- Outgoing to own name, no dest_hint → transfer pair (not expense)
insert into email_movements (user_id, gmail_message_id, source, amount, currency, counterparty, account_hint, dest_hint, email_date) values
  ('a9000000-0000-0000-0000-000000000001', 'on1', 'bancochile_transfer_out', 50000, 'CLP',
   'Richard Alexis Romero', '1122334455', null, '2026-06-15 10:00+00');

select is(
  promote_email_movements('a9000000-0000-0000-0000-000000000001', null),
  '{"promoted": 1, "skipped_existing": 0, "pending": 0, "errors": 0}'::jsonb,
  'single-sided own transfer_out promotes'
);

select is(
  (select type::text from transactions where metadata->>'gmail_message_id' = 'on1'),
  'transfer',
  'own-name transfer_out books as transfer, not expense'
);

select is(
  (select needs_review from transactions where metadata->>'gmail_message_id' = 'on1'),
  true,
  'inferred own transfer_out flags needs_review'
);

select is(
  (select count(*)::bigint from transactions
    where user_id = 'a9000000-0000-0000-0000-000000000001'
      and type = 'transfer' and abs(amount) = 50000),
  2::bigint,
  'own-name transfer_out creates out/in pair'
);

select is(
  (select metadata->>'own_transfer_inferred' from transactions where metadata->>'gmail_message_id' = 'on1'),
  'counterparty_name',
  'metadata records inference reason'
);

-- Incoming from own name, no prior out email → transfer pair (not income)
insert into email_movements (user_id, gmail_message_id, source, amount, currency, counterparty, account_hint, dest_hint, email_date) values
  ('a9000000-0000-0000-0000-000000000001', 'on2', 'bancoestado_transfer_in', 75000, 'CLP',
   'RICHARD ALEXIS ROMERO MOORE', '18202300', null, '2026-06-20 11:00+00');

select is(
  promote_email_movements('a9000000-0000-0000-0000-000000000001', null),
  '{"promoted": 1, "skipped_existing": 0, "pending": 0, "errors": 0}'::jsonb,
  'single-sided own transfer_in promotes'
);

select is(
  (select type::text from transactions where metadata->>'gmail_message_id' = 'on2'),
  'transfer',
  'own-name transfer_in books as transfer, not income'
);

select is(
  (select count(*)::bigint from transactions
    where user_id = 'a9000000-0000-0000-0000-000000000001'
      and type = 'income' and amount = 75000),
  0::bigint,
  'no phantom income for own-name transfer_in'
);

-- dest_hint to non-owned account still expense even when counterparty matches owner
insert into email_movements (user_id, gmail_message_id, source, amount, currency, counterparty, account_hint, dest_hint, email_date) values
  ('a9000000-0000-0000-0000-000000000001', 'on3', 'bancochile_transfer_out', 60000, 'CLP',
   'Richard Alexis Romero', '1122334455', '9988776655', '2026-06-21 09:00+00');

select is(
  (select promote_email_movements('a9000000-0000-0000-0000-000000000001', null)->>'promoted')::int,
  1,
  'transfer with non-owned dest_hint still promotes'
);

select is(
  (select type::text from transactions where metadata->>'gmail_message_id' = 'on3'),
  'expense',
  'non-owned dest_hint skips name inference and stays expense'
);

select * from finish();
rollback;
