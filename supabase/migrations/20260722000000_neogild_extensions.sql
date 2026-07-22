-- Neogild MVP extensions: statement reconciliation, feedback learning,
-- categorization review flags. See ADR-009, ADR-011.

-- Extend email_movements.source for forwards and future sources
alter table email_movements drop constraint if exists email_movements_source_check;
alter table email_movements add constraint email_movements_source_check
  check (source in (
    'bancochile_tc', 'bancochile_pago', 'bancochile_transfer_out',
    'bancochile_transfer_in', 'bancochile_pago_tc',
    'bice_transfer_out', 'bice_transfer_in', 'bice_pago_tc',
    'mp_transfer_out', 'tenpo_transfer_in', 'bci_spa',
    'forward', 'manual', 'unknown'
  ));

-- Review workflow (ADR-004): low-confidence or income pending confirmation
alter table transactions
  add column if not exists needs_review boolean not null default false;

alter table transactions
  add column if not exists category_confidence numeric(4, 3);

create index if not exists idx_transactions_needs_review
  on transactions(user_id, date desc)
  where needs_review = true and category is null;

-- Feedback log for learning from corrections (ADR-009)
create table if not exists feedback_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  transaction_id uuid references transactions(id) on delete set null,
  field_corrected text not null check (field_corrected in (
    'category', 'scope', 'split_rule', 'visibility', 'amount', 'merchant'
  )),
  old_value text,
  new_value text,
  merchant text,
  amount bigint,
  context jsonb default '{}',
  reasoning text,
  user_reasoning text,
  used_in_training boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_user on feedback_log(user_id, created_at desc);
create index if not exists idx_feedback_training
  on feedback_log(user_id) where used_in_training = false;

alter table feedback_log enable row level security;

create policy "feedback_log_select" on feedback_log
  for select using ((select auth.uid()) = user_id);
create policy "feedback_log_insert" on feedback_log
  for insert with check ((select auth.uid()) = user_id);
create policy "feedback_log_update" on feedback_log
  for update using ((select auth.uid()) = user_id);

-- Statement entries for cartola reconciliation (ADR-011)
create table if not exists statement_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  account_id uuid references accounts(id),
  source text not null check (source in ('csv', 'xlsx', 'pdf')),
  statement_month date not null,
  entry_date date not null,
  description text not null,
  amount bigint not null,
  currency text not null default 'CLP' check (currency in ('CLP', 'USD')),
  entry_type text check (entry_type in ('charge', 'deposit')),
  balance_after bigint,
  status text not null default 'pending' check (status in (
    'pending', 'matched', 'new', 'mismatch_amount',
    'mismatch_missing', 'ignored'
  )),
  matched_transaction_id uuid references transactions(id) on delete set null,
  old_amount bigint,
  notes text,
  upload_fingerprint text,
  created_at timestamptz not null default now()
);

create index if not exists idx_statement_entries_user_month
  on statement_entries(user_id, statement_month);
create index if not exists idx_statement_entries_pending
  on statement_entries(user_id, status) where status in ('pending', 'mismatch_amount', 'mismatch_missing');

create unique index if not exists idx_statement_entries_dedup
  on statement_entries(user_id, account_id, entry_date, amount, description)
  where status != 'ignored';

alter table statement_entries enable row level security;

create policy "statement_entries_select" on statement_entries
  for select using ((select auth.uid()) = user_id);
create policy "statement_entries_insert" on statement_entries
  for insert with check ((select auth.uid()) = user_id);
create policy "statement_entries_update" on statement_entries
  for update using ((select auth.uid()) = user_id);
create policy "statement_entries_delete" on statement_entries
  for delete using ((select auth.uid()) = user_id);

-- Default categorization rules for new users (Chilean merchants)
create or replace function seed_default_categorization_rules(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  insert into categorization_rules (user_id, pattern, category, priority)
  select p_user_id, v.pattern, v.category, v.priority
  from (values
    ('LIDER', 'necesidad.super', 10),
    ('JUMBO', 'necesidad.super', 10),
    ('UNIMARC', 'necesidad.super', 10),
    ('TOTTUS', 'necesidad.super', 10),
    ('SANTA ISABEL', 'necesidad.super', 10),
    ('COPEC', 'necesidad.bencina', 10),
    ('SHELL', 'necesidad.bencina', 10),
    ('PEDIDOSYA', 'consumo.comida', 10),
    ('RAPPI', 'consumo.comida', 10),
    ('UBER EATS', 'consumo.comida', 10),
    ('UBER', 'necesidad.transporte', 8),
    ('NETFLIX', 'consumo.entretencion', 10),
    ('SPOTIFY', 'consumo.entretencion', 10),
    ('FARMACIA', 'necesidad.salud', 5),
    ('AHUMADA', 'necesidad.salud', 8),
    ('CRUZ VERDE', 'necesidad.salud', 8),
    ('ENTEL', 'necesidad.servicios', 10),
    ('MOVISTAR', 'necesidad.servicios', 10),
    ('WOM', 'necesidad.servicios', 10),
    ('VTR', 'necesidad.servicios', 10)
  ) as v(pattern, category, priority)
  where not exists (
    select 1 from categorization_rules r
    where r.user_id = p_user_id and r.pattern = v.pattern
  );
end;
$$;
