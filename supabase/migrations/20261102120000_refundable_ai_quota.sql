-- Reserve quota atomically and return the exact UTC usage date that was charged.
create or replace function public.reserve_careeros_ai_quota(
  p_user_id uuid,
  p_daily_limit integer default 2
) returns date
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  charged_date date := (now() at time zone 'utc')::date;
  new_count integer;
begin
  if p_user_id is null or p_daily_limit < 1 or p_daily_limit > 2 then
    return null;
  end if;

  insert into public.ai_usage_daily(user_id, usage_date, request_count)
  values (p_user_id, charged_date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = ai_usage_daily.request_count + 1
  where ai_usage_daily.request_count < p_daily_limit
  returning request_count into new_count;

  if new_count is null then
    return null;
  end if;
  return charged_date;
end;
$$;

-- Roll back one reservation after a provider/network/response failure.
-- The exact date returned by reserve is supplied so midnight UTC cannot refund the wrong day.
create or replace function public.release_careeros_ai_quota(
  p_user_id uuid,
  p_usage_date date
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  remaining_count integer;
begin
  if p_user_id is null or p_usage_date is null then
    return false;
  end if;

  update public.ai_usage_daily
     set request_count = request_count - 1
   where user_id = p_user_id
     and usage_date = p_usage_date
     and request_count > 0
   returning request_count into remaining_count;

  if remaining_count is null then
    return false;
  end if;

  if remaining_count = 0 then
    delete from public.ai_usage_daily
     where user_id = p_user_id
       and usage_date = p_usage_date
       and request_count = 0;
  end if;

  return true;
end;
$$;

revoke all on function public.reserve_careeros_ai_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_careeros_ai_quota(uuid, date) from public, anon, authenticated;
grant execute on function public.reserve_careeros_ai_quota(uuid, integer) to service_role;
grant execute on function public.release_careeros_ai_quota(uuid, date) to service_role;
