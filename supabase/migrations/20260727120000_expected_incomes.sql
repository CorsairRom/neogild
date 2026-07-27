-- Recurring expected incomes (salary, side gigs). Reference only — not ledger posts.
-- Confirmed by matching real income transactions (e.g. Heligrafics TEF).

create table expected_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  amount numeric not null check (amount > 0),
  match_pattern text,
  typical_day int check (typical_day is null or (typical_day >= 1 and typical_day <= 31)),
  -- labor_month: attribute to work period (match window spans into next calendar month)
  -- cash_month: must land inside the selected calendar month
  attribution text not null default 'labor_month'
    check (attribution in ('labor_month', 'cash_month')),
  account_id uuid references accounts(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expected_incomes_user_active_idx
  on expected_incomes (user_id, is_active, sort_order);

alter table expected_incomes enable row level security;

create policy "expected_incomes_select" on expected_incomes
  for select using ((select auth.uid()) = user_id);

create policy "expected_incomes_insert" on expected_incomes
  for insert with check ((select auth.uid()) = user_id);

create policy "expected_incomes_update" on expected_incomes
  for update using ((select auth.uid()) = user_id);

create policy "expected_incomes_delete" on expected_incomes
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on expected_incomes to authenticated;
grant select, insert, update, delete on expected_incomes to service_role;
