-- CareerOS user workspace storage
-- Run in Supabase Dashboard > SQL Editor.
-- All user data is isolated by auth.uid() using Row Level Security.

create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_workspaces_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.user_workspaces enable row level security;

drop policy if exists "Users can read their own workspace" on public.user_workspaces;
create policy "Users can read their own workspace"
  on public.user_workspaces for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own workspace" on public.user_workspaces;
create policy "Users can create their own workspace"
  on public.user_workspaces for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own workspace" on public.user_workspaces;
create policy "Users can update their own workspace"
  on public.user_workspaces for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_workspaces to authenticated;
revoke all on public.user_workspaces from anon;

create index if not exists user_workspaces_updated_at_idx
  on public.user_workspaces (updated_at desc);

comment on table public.user_workspaces is
  'Private per-user CareerOS workspace payload. RLS restricts access to the owning auth user.';


-- Server-enforced Gemini quota. The browser cannot read or modify this table.
create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);
alter table public.ai_usage_daily enable row level security;
drop policy if exists "No direct user access to AI usage counters" on public.ai_usage_daily;
create policy "No direct user access to AI usage counters"
  on public.ai_usage_daily
  for all
  to anon, authenticated
  using (false)
  with check (false);
revoke all on public.ai_usage_daily from anon, authenticated;

create or replace function public.consume_careeros_ai_quota(
  p_user_id uuid,
  p_daily_limit integer default 10
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_count integer;
begin
  if p_user_id is null or p_daily_limit < 1 or p_daily_limit > 1000 then
    return false;
  end if;
  insert into public.ai_usage_daily(user_id, usage_date, request_count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = ai_usage_daily.request_count + 1
  where ai_usage_daily.request_count < p_daily_limit
  returning request_count into new_count;
  return new_count is not null;
end;
$$;

revoke all on function public.consume_careeros_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_careeros_ai_quota(uuid, integer) to service_role;


-- Subscription metadata. Only the server-side service role may write it.
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_subscription_id text not null unique,
  plan text not null check (plan in ('pro', 'career_plus')),
  status text not null check (status in ('authenticated','active','halted','cancelled','completed','paused','pending','expired')),
  current_start timestamptz,
  current_end timestamptz,
  cancel_at_cycle_end boolean not null default false,
  cancellation_requested_at timestamptz,
  provider_event_created_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.subscriptions to authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, updated_at desc);

alter table public.subscriptions
  add column if not exists provider_event_created_at bigint not null default 0;

-- Apply only newer provider events so delayed webhook deliveries cannot roll back subscription state.
create or replace function public.upsert_careeros_subscription(
  p_user_id uuid,
  p_razorpay_subscription_id text,
  p_plan text,
  p_status text,
  p_current_start timestamptz,
  p_current_end timestamptz,
  p_event_created_at bigint
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $
declare
  did_update boolean := false;
begin
  if p_user_id is null
     or p_razorpay_subscription_id is null
     or p_razorpay_subscription_id = ''
     or p_plan not in ('pro','career_plus')
     or p_status not in ('authenticated','active','halted','cancelled','completed','paused','pending','expired')
     or p_event_created_at is null
     or p_event_created_at < 0 then
    return false;
  end if;

  insert into public.subscriptions (
    user_id, razorpay_subscription_id, plan, status,
    current_start, current_end, provider_event_created_at,
    cancel_at_cycle_end, cancellation_requested_at, updated_at
  ) values (
    p_user_id, p_razorpay_subscription_id, p_plan, p_status,
    p_current_start, p_current_end, p_event_created_at,
    false, null, now()
  )
  on conflict (razorpay_subscription_id) do update set
    user_id = excluded.user_id,
    plan = excluded.plan,
    status = excluded.status,
    current_start = excluded.current_start,
    current_end = excluded.current_end,
    provider_event_created_at = excluded.provider_event_created_at,
    cancel_at_cycle_end = case
      when excluded.status = 'cancelled' then false
      else public.subscriptions.cancel_at_cycle_end
    end,
    cancellation_requested_at = case
      when excluded.status = 'cancelled' then null
      else public.subscriptions.cancellation_requested_at
    end,
    updated_at = now()
  where excluded.provider_event_created_at > public.subscriptions.provider_event_created_at
  returning true into did_update;

  return coalesce(did_update, false);
end;
$;

revoke all on function public.upsert_careeros_subscription(uuid,text,text,text,timestamptz,timestamptz,bigint) from public, anon, authenticated;
grant execute on function public.upsert_careeros_subscription(uuid,text,text,text,timestamptz,timestamptz,bigint) to service_role;

-- Subscription cancellation scheduling metadata for self-service billing management.
alter table public.subscriptions add column if not exists cancel_at_cycle_end boolean not null default false;
alter table public.subscriptions add column if not exists cancellation_requested_at timestamptz;
