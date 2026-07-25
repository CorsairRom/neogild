-- Per-account ledger: import lines with balance updates and own-transfer pairing.

create or replace function _pick_peer_account(p_user_id uuid, p_account_id uuid)
returns uuid as $$
  select a.id
  from accounts a
  where a.user_id = p_user_id
    and a.id <> p_account_id
    and not a.is_archived
    and a.entity = 'personal'
    and a.subtype in ('debit', 'cash')
  order by a.created_at
  limit 1;
$$ language sql stable;

create or replace function rebuild_account_balances(p_user_id uuid default null)
returns jsonb as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_updated int := 0;
begin
  if v_uid is null then
    raise exception 'user id required';
  end if;

  update accounts a
  set balance = coalesce((
    select sum(
      case
        when t.type in ('income', 'refund') then t.amount
        when t.type = 'expense' then -t.amount
        when t.type = 'transfer' then t.amount
        when t.type = 'adjustment' then t.amount
        when t.type = 'debt_payment' then -abs(t.amount)
        else 0
      end
    )
    from transactions t
    where t.account_id = a.id
  ), 0),
  updated_at = now()
  where a.user_id = v_uid
    and not a.is_archived;

  get diagnostics v_updated = row_count;

  return jsonb_build_object('accounts_updated', v_updated);
end;
$$ language plpgsql security definer;

create or replace function pair_cartola_own_transfers(p_user_id uuid default null)
returns jsonb as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_row transactions;
  v_peer uuid;
  v_paired int := 0;
begin
  if v_uid is null then
    raise exception 'user id required';
  end if;

  for v_row in
    select t.*
    from transactions t
    where t.user_id = v_uid
      and t.type = 'transfer'
      and t.transfer_to is null
      and t.amount > 0
      and (
        t.metadata->>'cartola_kind' = 'tef_own'
        or t.description ~* '^TEF (DE|A)\s+'
      )
  loop
    v_peer := _pick_peer_account(v_uid, v_row.account_id);
    if v_peer is null then
      continue;
    end if;

    if exists (
      select 1 from transactions x
      where x.user_id = v_uid
        and x.account_id = v_peer
        and x.type = 'transfer'
        and x.date = v_row.date
        and x.amount = -v_row.amount
        and x.metadata->>'cartola_doc' = v_row.metadata->>'cartola_doc'
    ) then
      continue;
    end if;

    update transactions
    set transfer_to = v_peer
    where id = v_row.id;

    insert into transactions (
      user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata
    ) values (
      v_uid,
      v_peer,
      'transfer',
      -v_row.amount,
      v_row.description || ' (salida)',
      null,
      'personal',
      v_row.date,
      v_row.account_id,
      v_row.metadata
    );

    v_paired := v_paired + 1;
  end loop;

  perform rebuild_account_balances(v_uid);

  return jsonb_build_object('paired', v_paired);
end;
$$ language plpgsql security definer;

create or replace function import_ledger_line(
  p_user_id uuid,
  p_account_id uuid,
  p_date date,
  p_description text,
  p_amount bigint,
  p_tx_type transaction_type,
  p_category text default null,
  p_needs_review boolean default false,
  p_metadata jsonb default '{}'::jsonb,
  p_cartola_kind text default null,
  p_is_deposit boolean default false
) returns jsonb as $$
declare
  v_account accounts;
  v_peer uuid;
  v_tx transactions;
  v_tx_peer transactions;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into strict v_account
  from accounts
  where id = p_account_id and user_id = p_user_id and not is_archived;

  if p_cartola_kind = 'tef_own' then
    v_peer := _pick_peer_account(p_user_id, p_account_id);
    if v_peer is null then
      raise exception 'no peer account for own-account transfer';
    end if;

    if p_is_deposit then
      v_tx := _insert_transaction(
        p_user_id, p_account_id, 'transfer', p_amount, null, p_description,
        v_account.entity, p_date, null, v_peer
      );
      v_tx_peer := _insert_transaction(
        p_user_id, v_peer, 'transfer', -p_amount, null, p_description || ' (salida)',
        'personal', p_date, null, p_account_id
      );
      perform _update_account_balance(p_account_id, p_amount);
      perform _update_account_balance(v_peer, -p_amount);
    else
      v_tx := _insert_transaction(
        p_user_id, p_account_id, 'transfer', -p_amount, null, p_description,
        v_account.entity, p_date, null, v_peer
      );
      v_tx_peer := _insert_transaction(
        p_user_id, v_peer, 'transfer', p_amount, null, p_description || ' (entrada)',
        'personal', p_date, null, p_account_id
      );
      perform _update_account_balance(p_account_id, -p_amount);
      perform _update_account_balance(v_peer, p_amount);
    end if;

    return jsonb_build_object(
      'transaction_id', v_tx.id,
      'peer_transaction_id', v_tx_peer.id,
      'paired', true
    );
  end if;

  v_tx := _insert_transaction(
    p_user_id,
    p_account_id,
    p_tx_type,
    p_amount,
    p_category,
    p_description,
    v_account.entity,
    p_date,
    null,
    null
  );

  update transactions
  set needs_review = p_needs_review,
      metadata = v_meta
  where id = v_tx.id;

  if p_tx_type = 'income' then
    perform _update_account_balance(p_account_id, p_amount);
  elsif p_tx_type = 'expense' then
    perform _update_account_balance(p_account_id, -p_amount);
  elsif p_tx_type = 'refund' then
    perform _update_account_balance(p_account_id, p_amount);
  end if;

  return jsonb_build_object('transaction_id', v_tx.id, 'paired', false);
end;
$$ language plpgsql security definer;

grant execute on function rebuild_account_balances(uuid) to authenticated, service_role;
grant execute on function pair_cartola_own_transfers(uuid) to authenticated, service_role;
grant execute on function import_ledger_line(uuid, uuid, date, text, bigint, transaction_type, text, boolean, jsonb, text, boolean) to service_role;
