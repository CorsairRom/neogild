-- Broaden own-transfer pairing to legacy cartola rows without metadata.

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
        and (
          x.metadata->>'cartola_doc' = v_row.metadata->>'cartola_doc'
          or x.description like v_row.description || '%'
        )
    ) then
      continue;
    end if;

    update transactions
    set transfer_to = v_peer,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cartola_kind', 'tef_own')
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
      coalesce(v_row.metadata, '{}'::jsonb) || jsonb_build_object('cartola_kind', 'tef_own')
    );

    v_paired := v_paired + 1;
  end loop;

  perform rebuild_account_balances(v_uid);

  return jsonb_build_object('paired', v_paired);
end;
$$ language plpgsql security definer;
