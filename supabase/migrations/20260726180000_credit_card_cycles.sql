-- Billing cycles for credit cards (CMR / TC).
-- Source of truth for facturado / pagado / pendiente; updated from the card
-- statement and from bank/email payment matches.

create type credit_card_cycle_status as enum (
  'open',
  'partial',
  'paid',
  'overdue'
);

create table credit_card_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  billing_date date not null,
  period_from date,
  period_to date,
  pay_until date,
  total_due numeric not null,
  minimum_due numeric,
  previous_billed numeric,
  previous_paid numeric,
  cupo_total numeric,
  cupo_utilizado numeric,
  cupo_disponible numeric,
  status credit_card_cycle_status not null default 'open',
  paid_amount numeric not null default 0,
  paid_at date,
  bank_transaction_id uuid references transactions(id) on delete set null,
  cmr_payment_transaction_id uuid references transactions(id) on delete set null,
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, billing_date)
);

create index credit_card_cycles_account_billing_idx
  on credit_card_cycles (account_id, billing_date desc);

create index credit_card_cycles_user_status_idx
  on credit_card_cycles (user_id, status);

alter table credit_card_cycles enable row level security;

create policy "credit_card_cycles_select" on credit_card_cycles
  for select using ((select auth.uid()) = user_id);

create policy "credit_card_cycles_insert" on credit_card_cycles
  for insert with check ((select auth.uid()) = user_id);

create policy "credit_card_cycles_update" on credit_card_cycles
  for update using ((select auth.uid()) = user_id);

grant select, insert, update, delete on credit_card_cycles to authenticated;
grant select, insert, update, delete on credit_card_cycles to service_role;

create or replace function match_credit_card_cycle_payment(
  p_user_id uuid,
  p_amount numeric,
  p_date date,
  p_bank_transaction_id uuid default null,
  p_cmr_payment_transaction_id uuid default null,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_cycle credit_card_cycles%rowtype;
  v_status credit_card_cycle_status;
begin
  if v_uid is null then
    raise exception 'user id required';
  end if;

  select c.* into v_cycle
  from credit_card_cycles c
  where c.user_id = v_uid
    and (p_account_id is null or c.account_id = p_account_id)
    and c.status in ('open', 'partial')
    and abs(c.total_due - p_amount) <= 2
    and p_date between (c.billing_date - 5)
                   and (coalesce(c.pay_until, c.billing_date + 35) + 5)
  order by
    abs(c.total_due - p_amount),
    abs(coalesce(c.pay_until, c.billing_date) - p_date)
  limit 1;

  if v_cycle.id is null then
    return jsonb_build_object('matched', false);
  end if;

  if p_amount + 2 >= v_cycle.total_due then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  update credit_card_cycles
  set
    paid_amount = greatest(paid_amount, p_amount),
    paid_at = coalesce(paid_at, p_date),
    status = v_status,
    bank_transaction_id = coalesce(p_bank_transaction_id, bank_transaction_id),
    cmr_payment_transaction_id = coalesce(p_cmr_payment_transaction_id, cmr_payment_transaction_id),
    updated_at = now()
  where id = v_cycle.id
  returning * into v_cycle;

  return jsonb_build_object(
    'matched', true,
    'cycle_id', v_cycle.id,
    'billing_date', v_cycle.billing_date,
    'status', v_cycle.status,
    'paid_amount', v_cycle.paid_amount,
    'total_due', v_cycle.total_due
  );
end;
$$;

grant execute on function match_credit_card_cycle_payment(uuid, numeric, date, uuid, uuid, uuid)
  to authenticated, service_role;

-- When a positive transfer lands on a credit card (cartola pair or email pago_tc),
-- try to settle the matching open cycle by amount/date.
create or replace function _credit_card_cycle_on_inbound_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtype text;
begin
  if NEW.type is distinct from 'transfer' or NEW.amount <= 0 then
    return NEW;
  end if;

  select a.subtype::text into v_subtype
  from accounts a
  where a.id = NEW.account_id;

  if v_subtype = 'credit_card' then
    perform match_credit_card_cycle_payment(
      NEW.user_id,
      NEW.amount,
      NEW.date,
      null,
      NEW.id,
      NEW.account_id
    );
  end if;

  return NEW;
end;
$$;

create trigger credit_card_cycle_on_inbound_payment
  after insert on transactions
  for each row
  execute function _credit_card_cycle_on_inbound_payment();
