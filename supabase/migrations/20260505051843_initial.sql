-- supabase/migrations/0001_init.sql

create extension if not exists "pgcrypto";

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,             -- e.g. "FLIP-4X9K"
  players     jsonb not null default '[]',      -- [{id, name}]
  rounds      jsonb not null default '[]',      -- [{id, scores: {pid: pts}}]
  wip_scores  jsonb not null default '{}',      -- {pid: pts} — live as-you-type
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Short readable join code generator (6 alphanum chars, prefix "FLIP-")
create or replace function generate_game_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I ambiguity
  code  text := '';
  i     int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return 'FLIP-' || code;
end;
$$;

-- Auto-generate code on insert if not provided
create or replace function set_game_code()
returns trigger language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    loop
      new.code := generate_game_code();
      exit when not exists (select 1 from public.games where code = new.code);
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_game_code
  before insert on public.games
  for each row execute function set_game_code();

-- Auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_games_updated_at
  before update on public.games
  for each row execute function touch_updated_at();

-- RLS: public read, public write (no auth for MVP — anyone with code can join)
alter table public.games enable row level security;

create policy "anyone can read games"
  on public.games for select using (true);

create policy "anyone can insert games"
  on public.games for insert with check (true);

create policy "anyone can update games"
  on public.games for update using (true);

-- Realtime: enable on games table
alter publication supabase_realtime add table public.games;