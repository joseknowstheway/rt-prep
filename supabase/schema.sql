-- RT Registry Prep: database schema
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Every table is protected by row-level security: a signed-in account can only
-- see and change rows whose user_id is its own.

-- One row per answered, incorrect or skipped question (study and exams).
create table if not exists public.attempts (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  qid         text not null,                          -- question id, e.g. "tp-3a9f2c"
  answered_at timestamptz not null,
  result      smallint not null check (result in (0, 1, 2)),  -- 0 incorrect, 1 correct, 2 skipped
  choice      smallint not null check (choice between -1 and 3), -- canonical option index, -1 = none
  source      text not null check (source in ('s', 'x')),      -- 's' study, 'x' exam
  created_at  timestamptz not null default now()
);
create index if not exists attempts_user_created_idx on public.attempts (user_id, created_at);
create index if not exists attempts_user_qid_idx     on public.attempts (user_id, qid);

-- One row per finished practice exam. "data" keeps the full answer sheet for review.
create table if not exists public.exams (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  timed      boolean not null,
  n          integer not null,
  correct    integer not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Small key/value state, currently the exam in progress ("active_exam").
create table if not exists public.app_state (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.attempts  enable row level security;
alter table public.exams     enable row level security;
alter table public.app_state enable row level security;

do $$
declare t text;
begin
  foreach t in array array['attempts', 'exams', 'app_state'] loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.attempts, public.exams, public.app_state to authenticated;

-- Handy views for exploring your own data in the SQL editor or Table Editor.
create or replace view public.question_accuracy with (security_invoker = true) as
select user_id,
       qid,
       count(*) filter (where result <> 2)                       as answered,
       count(*) filter (where result = 1)                        as correct,
       count(*) filter (where result = 2)                        as skipped,
       round(100.0 * count(*) filter (where result = 1)
             / nullif(count(*) filter (where result <> 2), 0), 1) as pct_correct,
       max(answered_at)                                          as last_seen
from public.attempts
group by user_id, qid;

grant select on public.question_accuracy to authenticated;
