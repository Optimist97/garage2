-- Garage 2 — schéma Supabase (à coller dans SQL Editor). Postgres + RLS.
-- Chaque ligne liée à auth.users.id via user_id.

-- Extensions utiles
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============ TABLES ============
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zone text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  photo_url text,
  condition text not null default 'bon' check (condition in ('neuf','bon','moyen','hs')),
  quantity integer,
  is_consumable boolean not null default false,
  threshold integer,
  location_id uuid references public.locations(id) on delete set null,
  notes text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  date date not null,
  action text not null,
  note text not null default '',
  reminder_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  to_who text not null,
  since date not null,
  returned boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ============ INDEX ============
create index if not exists items_user_idx on public.items(user_id);
create index if not exists items_cat_idx on public.items(user_id, category);
create index if not exists items_name_trgm on public.items using gin (name gin_trgm_ops);
create index if not exists logs_item_idx on public.maintenance_logs(item_id);
create index if not exists loans_item_idx on public.loans(item_id);

-- updated_at auto
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_items_touch on public.items;
create trigger trg_items_touch before update on public.items
for each row execute function public.touch_updated_at();

-- ============ RLS ============
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.loans enable row level security;

-- Politique générique : l'utilisateur ne voit/modifie que ses lignes.
-- À répéter pour les 4 tables :
drop policy if exists "own_all" on public.locations;
create policy "own_all" on public.locations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_all" on public.items;
create policy "own_all" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_all" on public.maintenance_logs;
create policy "own_all" on public.maintenance_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_all" on public.loans;
create policy "own_all" on public.loans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ STORAGE (photos privées) ============
-- Dans Dashboard > Storage : créez un bucket privé nommé "photos".
-- Puis exécutez :
insert into storage.buckets (id, name, public) values ('photos','photos', false)
on conflict (id) do nothing;

drop policy if exists "photos_own" on storage.objects;
create policy "photos_own" on storage.objects for all
using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
-- Convention : uploadez vers "photos/<user_id>/<item_id>.jpg".
-- Note : le MVP stocke la photo compressée en dataURL si Storage non configuré ;
-- passez à l'upload Storage quand le volume grandit (voir README).
