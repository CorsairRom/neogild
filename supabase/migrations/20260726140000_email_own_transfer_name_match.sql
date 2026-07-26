-- Email promote v6: infer own-account transfers when counterparty matches profile name.
-- Mirrors cartola tef_own logic for single-sided bank emails (no dest_hint, no mirror).

create or replace function _profile_or_inferred_owner_name(p_user_id uuid)
returns text
language sql
stable
as $$
  with profile_name as (
    select nullif(trim(name), '') as n
    from profiles
    where id = p_user_id
  ),
  tef_names as (
    select upper(regexp_replace(m[1], '\s+', ' ', 'g')) as n
    from transactions t,
         regexp_match(t.description, '^TEF (?:DE|A)\s+(.+)', 'i') as m
    where t.user_id = p_user_id
    group by 1
    having count(*) >= 2
    order by count(*) desc
    limit 1
  )
  select coalesce((select n from profile_name), (select n from tef_names));
$$;

revoke all on function _profile_or_inferred_owner_name(uuid) from public, anon, authenticated;

create or replace function _counterparty_matches_owner_strict(
  p_user_id uuid,
  p_counterparty text
) returns boolean
language sql
stable
as $$
  with norm as (
    select
      translate(lower(coalesce(p_counterparty, '')), 'áéíóúñ', 'aeioun') as cp,
      translate(lower(coalesce(
        _profile_or_inferred_owner_name(p_user_id), '')), 'áéíóúñ', 'aeioun') as owner
  ),
  words as (
    select w from norm, unnest(string_to_array(norm.owner, ' ')) as w
    where length(w) >= 3
  )
  select case
    when (select cp from norm) = '' then false
    when (select count(*) from words) < 2 then false
    else (
      select count(*) >= least(2, (select count(*) from words))
      from words, norm
      where position(words.w in norm.cp) > 0
    )
  end;
$$;

revoke all on function _counterparty_matches_owner_strict(uuid, text) from public, anon, authenticated;

create or replace function _book_email_own_transfer_pair(
  p_user_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount bigint,
  p_date date,
  p_out_meta jsonb,
  p_in_meta jsonb default '{}'::jsonb,
  p_needs_review boolean default true
) returns jsonb
language plpgsql
as $$
declare
  v_from accounts;
  v_to accounts;
  v_tx_out transactions;
  v_tx_in transactions;
begin
  select * into strict v_from from accounts where id = p_from_account_id;
  select * into strict v_to from accounts where id = p_to_account_id;

  insert into transactions (
    user_id, account_id, type, amount, description, category, entity, date,
    transfer_to, needs_review, metadata
  ) values (
    p_user_id, p_from_account_id, 'transfer', -p_amount,
    'Transferencia -> ' || v_to.name, null, v_from.entity, p_date,
    p_to_account_id, p_needs_review, p_out_meta
  ) returning * into v_tx_out;

  insert into transactions (
    user_id, account_id, type, amount, description, category, entity, date,
    transfer_to, needs_review, metadata
  ) values (
    p_user_id, p_to_account_id, 'transfer', p_amount,
    'Transferencia <- ' || v_from.name, null, v_to.entity, p_date,
    p_from_account_id, p_needs_review, p_in_meta
  ) returning * into v_tx_in;

  perform _update_account_balance(p_from_account_id, -p_amount);
  perform _update_account_balance(p_to_account_id, p_amount);

  return jsonb_build_object('out_tx_id', v_tx_out.id, 'in_tx_id', v_tx_in.id);
end;
$$;

revoke all on function _book_email_own_transfer_pair(uuid, uuid, uuid, bigint, date, jsonb, jsonb, boolean)
  from public, anon, authenticated;

create or replace function promote_email_movements(
  p_user_id uuid default null,
  p_usd_rate numeric default null
) returns jsonb as $$
declare
  v_uid uuid := (select auth.uid());
  v_row email_movements;
  v_account accounts;
  v_dest accounts;
  v_mirror email_movements;
  v_existing_tx_id uuid;
  v_category text;
  v_amount bigint;
  v_meta jsonb;
  v_in_meta jsonb;
  v_tx transactions;
  v_tx_in transactions;
  v_bank_keyword text;
  v_spa_accounts int;
  v_pair jsonb;
  v_promoted int := 0;
  v_skipped int := 0;
  v_pending int := 0;
  v_errors int := 0;
begin
  if v_uid is not null then
    p_user_id := v_uid;
  elsif p_user_id is null then
    raise exception 'p_user_id is required when called without a user JWT'
      using errcode = '22023';
  end if;

  for v_row in
    select * from email_movements
    where user_id = p_user_id and status = 'pending'
    order by (source not like '%transfer_out'), email_date, created_at
  loop
    begin
      select * into v_row from email_movements where id = v_row.id;
      if v_row.status <> 'pending' then
        continue;
      end if;

      select t.id into v_existing_tx_id from transactions t
      where t.user_id = p_user_id
        and (
          t.metadata->>'gmail_message_id' = v_row.gmail_message_id
          or (v_row.bank_tx_id is not null and t.metadata->>'bank_tx_id' = v_row.bank_tx_id)
        )
      limit 1;
      if v_existing_tx_id is not null then
        update email_movements
        set status = 'promoted', transaction_id = v_existing_tx_id
        where id = v_row.id;
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if v_row.amount is null then
        raise exception 'missing amount';
      end if;

      v_amount := v_row.amount;
      v_meta := jsonb_build_object(
        'gmail_message_id', v_row.gmail_message_id,
        'source', v_row.source
      );
      if v_row.bank_tx_id is not null then
        v_meta := v_meta || jsonb_build_object('bank_tx_id', v_row.bank_tx_id);
      end if;
      if v_row.currency = 'USD' then
        if p_usd_rate is null or p_usd_rate <= 0 then
          v_pending := v_pending + 1;
          continue;
        end if;
        v_amount := round(v_row.amount * p_usd_rate / 100)::bigint;
        v_meta := v_meta || jsonb_build_object(
          'fx_estimated', true,
          'original_usd_cents', v_row.amount,
          'usd_rate', p_usd_rate
        );
      end if;

      v_account := _match_account_by_hint(p_user_id, v_row.account_hint, v_row.currency);
      if v_account.id is null then
        raise exception 'no account matches hint "%"', coalesce(v_row.account_hint, '');
      end if;

      v_bank_keyword := case
        when v_row.source like 'bancochile%' then 'chile'
        when v_row.source like 'bice%' then 'bice'
        when v_row.source like 'mp_%' then 'mercado'
        when v_row.source like 'tenpo%' then 'tenpo'
        when v_row.source like 'bci%' then 'bci'
        when v_row.source like 'bancoestado%' then 'estado'
        when v_row.source like 'bancofalabella%' then 'falabella'
      end;

      if v_row.source in (
        'bancochile_tc', 'bancochile_cargo_cuenta', 'bancochile_pago', 'bancoestado_debito'
      ) then
        select r.category into v_category from categorization_rules r
        where r.user_id = p_user_id
          and position(upper(r.pattern) in upper(coalesce(v_row.merchant, v_row.counterparty, ''))) > 0
        order by r.priority desc, r.created_at asc
        limit 1;

        insert into transactions (user_id, account_id, type, amount, description, category, entity, date, metadata)
        values (p_user_id, v_account.id, 'expense', v_amount,
                coalesce(v_row.merchant, v_row.counterparty, 'Compra'),
                v_category, v_account.entity, coalesce(v_row.email_date::date, current_date), v_meta)
        returning * into v_tx;
        perform _update_account_balance(v_account.id, -v_amount);

      elsif v_row.source = 'bci_spa' then
        if v_account.entity = 'spa' then
          insert into transactions (user_id, account_id, type, amount, description, category, entity, date, metadata)
          values (p_user_id, v_account.id, 'income', v_amount,
                  coalesce(v_row.counterparty, 'Transferencia recibida'),
                  null, 'spa', coalesce(v_row.email_date::date, current_date), v_meta)
          returning * into v_tx;
          perform _update_account_balance(v_account.id, v_amount);
        else
          select count(*) into v_spa_accounts from accounts a
          where a.user_id = p_user_id and not a.is_archived
            and a.entity = 'spa' and a.subtype in ('debit', 'cash');
          if v_spa_accounts > 1 then
            raise exception 'multiple SpA accounts: cannot infer BCI origin account';
          end if;
          select a.* into v_dest from accounts a
          where a.user_id = p_user_id and not a.is_archived
            and a.entity = 'spa' and a.subtype in ('debit', 'cash')
          limit 1;
          if v_dest.id is null then
            raise exception 'no SpA account found for outgoing BCI transfer';
          end if;

          insert into transactions (user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata)
          values (p_user_id, v_dest.id, 'transfer', -v_amount,
                  'Transferencia SpA -> ' || v_account.name, null,
                  'spa', coalesce(v_row.email_date::date, current_date), v_account.id, v_meta)
          returning * into v_tx;
          insert into transactions (user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata)
          values (p_user_id, v_account.id, 'transfer', v_amount,
                  'Transferencia <- ' || v_dest.name || ' [spa]', null,
                  v_account.entity, coalesce(v_row.email_date::date, current_date), v_dest.id, '{}'::jsonb)
          returning * into v_tx_in;
          perform _update_account_balance(v_dest.id, -v_amount);
          perform _update_account_balance(v_account.id, v_amount);
        end if;

      elsif v_row.source like '%transfer_in' then
        if _counterparty_is_owner(p_user_id, v_row.counterparty) then
          select t.id into v_existing_tx_id from transactions t
          where t.user_id = p_user_id
            and t.account_id = v_account.id
            and t.type = 'transfer'
            and t.amount = v_amount
            and t.date between coalesce(v_row.email_date::date, current_date) - 1
                           and coalesce(v_row.email_date::date, current_date) + 1
          order by t.created_at desc
          limit 1;
          if v_existing_tx_id is not null then
            update email_movements
            set status = 'promoted', transaction_id = v_existing_tx_id
            where id = v_row.id;
            v_skipped := v_skipped + 1;
            continue;
          end if;
        end if;

        v_dest := null;
        if v_row.dest_hint is null
           and _counterparty_matches_owner_strict(p_user_id, v_row.counterparty) then
          select a.* into v_dest from accounts a
          where a.id = _pick_peer_account(p_user_id, v_account.id);
        end if;

        if v_dest.id is not null then
          v_meta := v_meta || jsonb_build_object('own_transfer_inferred', 'counterparty_name');

          select t.id into v_existing_tx_id from transactions t
          where t.user_id = p_user_id
            and t.account_id = v_dest.id
            and t.type = 'transfer'
            and t.amount = -v_amount
            and t.date between coalesce(v_row.email_date::date, current_date) - 1
                           and coalesce(v_row.email_date::date, current_date) + 1
          order by t.created_at desc
          limit 1;

          if v_existing_tx_id is not null then
            insert into transactions (
              user_id, account_id, type, amount, description, category, entity, date,
              transfer_to, needs_review, metadata
            ) values (
              p_user_id, v_account.id, 'transfer', v_amount,
              'Transferencia <- ' || v_dest.name, null,
              v_account.entity, coalesce(v_row.email_date::date, current_date),
              v_dest.id, true, v_meta
            ) returning * into v_tx;
            perform _update_account_balance(v_account.id, v_amount);
          else
            v_pair := _book_email_own_transfer_pair(
              p_user_id, v_dest.id, v_account.id, v_amount,
              coalesce(v_row.email_date::date, current_date),
              '{}'::jsonb, v_meta, true
            );
            select * into v_tx from transactions where id = (v_pair->>'in_tx_id')::uuid;
          end if;
        else
          insert into transactions (user_id, account_id, type, amount, description, category, entity, date, metadata)
          values (p_user_id, v_account.id, 'income', v_amount,
                  coalesce(v_row.counterparty, 'Transferencia recibida'),
                  null, v_account.entity, coalesce(v_row.email_date::date, current_date), v_meta)
          returning * into v_tx;
          perform _update_account_balance(v_account.id, v_amount);
        end if;

      elsif v_row.source like '%transfer_out' then
        if v_row.counterparty is not null
           and (v_row.counterparty ilike '%fintual%' or v_row.counterparty ilike '%fintoc%') then
          select a.* into v_dest from accounts a
          where a.user_id = p_user_id and not a.is_archived
            and lower(a.name) like '%fintual%'
          limit 1;
          if v_dest.id is null then
            raise exception 'no Fintual account found for savings transfer';
          end if;

          insert into transactions (user_id, account_id, type, amount, description, category, entity, date, metadata)
          values (p_user_id, v_account.id, 'expense', v_amount,
                  'Ahorro -> ' || v_dest.name, 'ahorro.inversion',
                  v_account.entity, coalesce(v_row.email_date::date, current_date), v_meta)
          returning * into v_tx;
          perform _update_account_balance(v_account.id, -v_amount);
          perform _update_account_balance(v_dest.id, v_amount);

        else
          v_dest := null;
          if v_row.dest_hint is not null then
            v_dest := _match_account_by_hint(p_user_id, v_row.dest_hint, v_row.currency);
          end if;
          if v_dest.id = v_account.id then
            v_dest := null;
          end if;

          if v_dest.id is not null then
            select m.* into v_mirror from email_movements m
            where m.user_id = p_user_id and m.status = 'pending'
              and m.id <> v_row.id
              and m.source like '%transfer_in'
              and m.amount = v_row.amount
              and abs(extract(epoch from (m.email_date - v_row.email_date))) <= 86400
              and (_match_account_by_hint(p_user_id, m.account_hint, m.currency)).id = v_dest.id
              and _counterparty_is_owner(p_user_id, m.counterparty)
            order by m.email_date
            limit 1;

            v_in_meta := case
              when v_mirror.id is not null then jsonb_build_object(
                'gmail_message_id', v_mirror.gmail_message_id, 'source', v_mirror.source)
              else '{}'::jsonb
            end;

            insert into transactions (user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata)
            values (p_user_id, v_account.id, 'transfer', -v_amount,
                    'Transferencia -> ' || v_dest.name, null,
                    v_account.entity, coalesce(v_row.email_date::date, current_date), v_dest.id, v_meta)
            returning * into v_tx;
            insert into transactions (user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata)
            values (p_user_id, v_dest.id, 'transfer', v_amount,
                    'Transferencia <- ' || v_account.name, null,
                    v_dest.entity, coalesce(v_row.email_date::date, current_date), v_account.id, v_in_meta)
            returning * into v_tx_in;
            perform _update_account_balance(v_account.id, -v_amount);
            perform _update_account_balance(v_dest.id, v_amount);

            if v_mirror.id is not null then
              update email_movements
              set status = 'promoted', transaction_id = v_tx_in.id
              where id = v_mirror.id;
              v_promoted := v_promoted + 1;
            end if;

          elsif v_row.dest_hint is null
             and _counterparty_matches_owner_strict(p_user_id, v_row.counterparty) then
            select a.* into v_dest from accounts a
            where a.id = _pick_peer_account(p_user_id, v_account.id);

            if v_dest.id is not null then
              v_meta := v_meta || jsonb_build_object('own_transfer_inferred', 'counterparty_name');
              v_pair := _book_email_own_transfer_pair(
                p_user_id, v_account.id, v_dest.id, v_amount,
                coalesce(v_row.email_date::date, current_date),
                v_meta, '{}'::jsonb, true
              );
              select * into v_tx from transactions where id = (v_pair->>'out_tx_id')::uuid;
            else
              select r.category into v_category from categorization_rules r
              where r.user_id = p_user_id
                and position(upper(r.pattern) in upper(coalesce(v_row.merchant, v_row.counterparty, ''))) > 0
              order by r.priority desc, r.created_at asc
              limit 1;

              insert into transactions (user_id, account_id, type, amount, description, category, entity, date, metadata)
              values (p_user_id, v_account.id, 'expense', v_amount,
                      coalesce(v_row.counterparty, 'Transferencia enviada'),
                      v_category, v_account.entity, coalesce(v_row.email_date::date, current_date), v_meta)
              returning * into v_tx;
              perform _update_account_balance(v_account.id, -v_amount);
            end if;

          else
            select r.category into v_category from categorization_rules r
            where r.user_id = p_user_id
              and position(upper(r.pattern) in upper(coalesce(v_row.merchant, v_row.counterparty, ''))) > 0
            order by r.priority desc, r.created_at asc
            limit 1;

            insert into transactions (user_id, account_id, type, amount, description, category, entity, date, metadata)
            values (p_user_id, v_account.id, 'expense', v_amount,
                    coalesce(v_row.counterparty, 'Transferencia enviada'),
                    v_category, v_account.entity, coalesce(v_row.email_date::date, current_date), v_meta)
            returning * into v_tx;
            perform _update_account_balance(v_account.id, -v_amount);
          end if;
        end if;

      elsif v_row.source like '%pago_tc' then
        v_account := _match_account_by_hint(
          p_user_id, v_row.account_hint,
          case when v_row.counterparty ilike '%internacional%' then 'USD' else 'CLP' end
        );
        if v_account.id is null then
          raise exception 'no account matches hint "%"', coalesce(v_row.account_hint, '');
        end if;
        if v_account.subtype = 'credit_card' then
          v_dest := v_account;
          select a.* into v_account from accounts a
          where a.user_id = p_user_id and not a.is_archived
            and a.subtype in ('debit', 'cash')
            and lower(a.name) like '%' || v_bank_keyword || '%'
          limit 1;
          if v_account.id is null then
            raise exception 'no debit account found for TC payment (bank %)', v_bank_keyword;
          end if;
        else
          select a.* into v_dest from accounts a
          where a.user_id = p_user_id and not a.is_archived
            and a.subtype = 'credit_card'
            and lower(a.name) like '%' || v_bank_keyword || '%'
          limit 1;
          if v_dest.id is null then
            raise exception 'no credit card account found for TC payment (bank %)', v_bank_keyword;
          end if;
        end if;

        insert into transactions (user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata)
        values (p_user_id, v_account.id, 'transfer', -v_amount,
                'Pago TC -> ' || v_dest.name, null,
                v_account.entity, coalesce(v_row.email_date::date, current_date), v_dest.id, v_meta)
        returning * into v_tx;
        insert into transactions (user_id, account_id, type, amount, description, category, entity, date, transfer_to, metadata)
        values (p_user_id, v_dest.id, 'transfer', v_amount,
                'Pago TC <- ' || v_account.name, null,
                v_dest.entity, coalesce(v_row.email_date::date, current_date), v_account.id, '{}'::jsonb)
        returning * into v_tx_in;
        perform _update_account_balance(v_account.id, -v_amount);
        perform _update_account_balance(v_dest.id, v_amount);

      else
        raise exception 'unhandled source %', v_row.source;
      end if;

      update email_movements
      set status = 'promoted', transaction_id = v_tx.id
      where id = v_row.id;
      v_promoted := v_promoted + 1;

    exception when others then
      update email_movements
      set status = 'error', error_detail = SQLERRM
      where id = v_row.id;
      v_errors := v_errors + 1;
    end;
  end loop;

  return jsonb_build_object(
    'promoted', v_promoted,
    'skipped_existing', v_skipped,
    'pending', v_pending,
    'errors', v_errors
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function promote_email_movements(uuid, numeric) from public, anon;
grant execute on function promote_email_movements(uuid, numeric) to authenticated, service_role;
