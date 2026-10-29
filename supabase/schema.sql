-- My Todo: Supabase (Postgres) schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- ---------------------------------------------------------------- tables
create table if not exists public.categories (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  color      text,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table if not exists public.todos (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  is_done      boolean not null default false,
  due_date     date,
  category_id  bigint,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  -- (category_id, user_id) must match one category row, so a todo can only
  -- point at the same user's category. Deleting a category keeps the todo and
  -- clears only category_id (it becomes "uncategorized").
  foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete set null (category_id)
);

create index if not exists idx_todos_user_due   on public.todos (user_id, due_date);
create index if not exists idx_todos_category   on public.todos (category_id);

-- ------------------------------------------------------------------- RLS
alter table public.categories enable row level security;
alter table public.todos      enable row level security;

-- Only logged-in users get table privileges; anonymous visitors get none.
revoke all on public.categories, public.todos from anon;
grant select, insert, update, delete on public.categories, public.todos to authenticated;

-- Each user can read and change only their own rows.
drop policy if exists categories_select_own on public.categories;
drop policy if exists categories_insert_own on public.categories;
drop policy if exists categories_update_own on public.categories;
drop policy if exists categories_delete_own on public.categories;

create policy categories_select_own on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy categories_insert_own on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy categories_update_own on public.categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete_own on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists todos_select_own on public.todos;
drop policy if exists todos_insert_own on public.todos;
drop policy if exists todos_update_own on public.todos;
drop policy if exists todos_delete_own on public.todos;

create policy todos_select_own on public.todos
  for select to authenticated using (user_id = (select auth.uid()));
create policy todos_insert_own on public.todos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy todos_update_own on public.todos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy todos_delete_own on public.todos
  for delete to authenticated using (user_id = (select auth.uid()));
