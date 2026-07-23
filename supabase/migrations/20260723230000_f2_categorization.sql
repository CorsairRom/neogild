-- F2: categorization — user corrections clear review flag; service batch classify for LLM.

create or replace function set_transaction_category(
  p_transaction_id uuid,
  p_category text
) returns jsonb as $$
declare
  v_uid uuid := (select auth.uid());
  v_old transactions;
  v_new transactions;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_old from transactions
  where id = p_transaction_id and user_id = v_uid;
  if not found then
    raise exception 'Transaction % not found or not owned by caller', p_transaction_id
      using errcode = '42501';
  end if;

  if p_category is null then
    raise exception 'Category is required';
  end if;

  if not exists (
    select 1 from categories
    where id = p_category and (user_id is null or user_id = v_uid)
  ) then
    raise exception 'Category "%" does not exist', p_category;
  end if;

  update transactions
  set
    category = p_category,
    needs_review = false,
    category_confidence = 1.0
  where id = p_transaction_id
  returning * into v_new;

  insert into audit_log (table_name, record_id, operation, old_row, new_row, user_id)
  values ('transactions', p_transaction_id::text, 'UPDATE',
          to_jsonb(v_old), to_jsonb(v_new), v_uid);

  return to_jsonb(v_new);
end;
$$ language plpgsql security definer set search_path = public;

-- Batch classify (LLM pipeline via service_role). Income always needs_review.
create or replace function classify_transaction(
  p_user_id uuid,
  p_transaction_id uuid,
  p_category text,
  p_confidence numeric default null,
  p_needs_review boolean default false
) returns jsonb as $$
declare
  v_old transactions;
  v_new transactions;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  select * into v_old from transactions
  where id = p_transaction_id and user_id = p_user_id;
  if not found then
    raise exception 'Transaction % not found for user', p_transaction_id
      using errcode = '42501';
  end if;

  if p_category is null then
    raise exception 'Category is required';
  end if;

  if not exists (
    select 1 from categories
    where id = p_category and (user_id is null or user_id = p_user_id)
  ) then
    raise exception 'Category "%" does not exist', p_category;
  end if;

  update transactions
  set
    category = p_category,
    category_confidence = p_confidence,
    needs_review = case
      when v_old.type = 'income' then true
      else coalesce(p_needs_review, false)
    end
  where id = p_transaction_id
  returning * into v_new;

  return to_jsonb(v_new);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function classify_transaction(uuid, uuid, text, numeric, boolean) from public, anon;
grant execute on function classify_transaction(uuid, uuid, text, numeric, boolean) to service_role;
