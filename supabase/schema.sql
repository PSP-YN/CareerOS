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
