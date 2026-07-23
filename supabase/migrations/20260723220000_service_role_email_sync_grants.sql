-- Server-side email sync uses service_role (API route + CLI).
-- Without INSERT/UPDATE on staging tables, parsed rows never land in email_movements.

grant insert, update, delete on email_movements to service_role;
grant insert, update, delete on sync_state to service_role;

-- Account matcher: also match last-4 suffix on full account numbers (BCH cargo cuenta).
create or replace function _match_account_by_hint(
  p_user_id uuid,
  p_hint text,
  p_currency text default null
) returns accounts as $$
  select a.* from accounts a
  where a.user_id = p_user_id
    and not a.is_archived
    and p_hint is not null
    and (
      a.metadata->'bank_account_numbers' ? p_hint
      or a.metadata->>'card_last4' = right(p_hint, 4)
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(a.metadata->'bank_account_numbers', '[]'::jsonb)) n
        where n = p_hint or right(n, 4) = right(p_hint, 4)
      )
    )
  order by (a.metadata->>'card_currency' = p_currency) desc nulls last, a.created_at
  limit 1;
$$ language sql stable;

revoke all on function _match_account_by_hint(uuid, text, text) from public, anon, authenticated;
