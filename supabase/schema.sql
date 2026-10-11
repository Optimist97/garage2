-- Garage 2: schema initial ou re-jouable, vérifié pour PostgreSQL 17.
-- Les données de chaque table sont privées au compte Supabase Auth propriétaire.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zone text not null check (length(trim(zone)) > 0),
  label text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null,
  -- legacy column retained for compatibility; current app ignores it
  condition text not null default 'bon' check (condition in ('neuf','bon','moyen','hs')),
  quantity integer check (quantity is null or quantity >= 0),
  is_consumable boolean not null default false,
  threshold integer check (threshold is null or threshold >= 0),
  location_id uuid,
  notes text not null default '',
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  price numeric(12,2) check (price is null or price >= 0),
  bought_at date,
  unit text not null default '',
  -- Les installations historiques peuvent encore avoir warranty_months ; le client ne l'utilise plus.
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  date date not null,
  action text not null check (length(trim(action)) > 0),
  note text not null default '',
  reminder_date date,
  repeat text not null default '' check (repeat in ('','1','3','6','12')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  to_who text not null,
  since date not null,
  returned boolean not null default false,
  note text not null default '',
  due date,
  kind text not null default 'pret' check (kind in ('pret','ailleurs','reparation')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
-- Migration sûre de l'ancien nom loans vers moves.
do $$ begin
  if to_regclass('public.loans') is not null and to_regclass('public.moves') is null then
    alter table public.loans rename to moves;
  end if;
end $$;
alter table public.moves add column if not exists due date;
alter table public.moves add column if not exists kind text;
update public.moves set kind = 'pret' where kind is null or kind not in ('pret','ailleurs','reparation');
alter table public.moves alter column kind set default 'pret';
alter table public.moves alter column kind set not null;
alter table public.moves drop constraint if exists moves_kind_check;
alter table public.moves drop constraint if exists loans_item_id_fkey;
alter table public.moves add constraint moves_kind_check check (kind in ('pret','ailleurs','reparation'));

alter table public.items add column if not exists price numeric(12,2);
alter table public.items add column if not exists bought_at date;
alter table public.items add column if not exists unit text not null default '';
alter table public.maintenance_logs add column if not exists repeat text not null default '';
alter table public.locations add column if not exists is_demo boolean not null default false;
alter table public.items add column if not exists is_demo boolean not null default false;
alter table public.maintenance_logs add column if not exists is_demo boolean not null default false;
alter table public.moves add column if not exists is_demo boolean not null default false;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status text not null default 'encours' check (status in ('idee','encours','pause','termine')),
  notes text not null default '',
  -- legacy column retained for compatibility; current app ignores it
  budget numeric(12,2) check (budget is null or budget >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  label text not null check (length(trim(label)) > 0),
  done boolean not null default false,
  qty integer check (qty is null or qty >= 0),
  unit text not null default '',
  item_id uuid,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);
alter table public.projects add column if not exists is_demo boolean not null default false;
alter table public.project_tasks add column if not exists is_demo boolean not null default false;

-- Notes rapides synchronisées entre les appareils de l'utilisateur.
create table if not exists public.quick_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  body text not null check (char_length(trim(body)) > 0 and octet_length(body) <= 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Empêche de rattacher un objet, une tâche ou un historique à un autre compte.
create unique index if not exists locations_owner_id_uidx on public.locations(user_id, id);
create unique index if not exists items_owner_id_uidx on public.items(user_id, id);
create unique index if not exists projects_owner_id_uidx on public.projects(user_id, id);
create unique index if not exists quick_notes_owner_id_uidx on public.quick_notes(user_id, id);
alter table public.items drop constraint if exists items_location_id_fkey;
alter table public.items drop constraint if exists items_location_owner_fkey;
alter table public.items add constraint items_location_owner_fkey
  foreign key (user_id, location_id) references public.locations(user_id, id) on delete set null (location_id);
alter table public.maintenance_logs drop constraint if exists maintenance_logs_item_id_fkey;
alter table public.maintenance_logs drop constraint if exists maintenance_logs_item_owner_fkey;
alter table public.maintenance_logs add constraint maintenance_logs_item_owner_fkey
  foreign key (user_id, item_id) references public.items(user_id, id) on delete cascade;
alter table public.moves drop constraint if exists moves_item_id_fkey;
alter table public.moves drop constraint if exists moves_item_owner_fkey;
alter table public.moves add constraint moves_item_owner_fkey
  foreign key (user_id, item_id) references public.items(user_id, id) on delete cascade;
alter table public.project_tasks drop constraint if exists project_tasks_project_id_fkey;
alter table public.project_tasks drop constraint if exists project_tasks_project_owner_fkey;
alter table public.project_tasks add constraint project_tasks_project_owner_fkey
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade;
alter table public.project_tasks drop constraint if exists project_tasks_item_id_fkey;
alter table public.project_tasks drop constraint if exists project_tasks_item_owner_fkey;
alter table public.project_tasks add constraint project_tasks_item_owner_fkey
  foreign key (user_id, item_id) references public.items(user_id, id) on delete set null (item_id);

-- Indexes couvrant les filtres de l'application, les liens FK et les prédicats RLS.
create index if not exists items_owner_category_updated_idx on public.items(user_id, category, updated_at desc);
create index if not exists items_owner_location_idx on public.items(user_id, location_id);
create index if not exists items_name_trgm_idx on public.items using gin (name gin_trgm_ops);
create index if not exists logs_owner_item_date_idx on public.maintenance_logs(user_id, item_id, date desc);
create index if not exists logs_owner_reminder_idx on public.maintenance_logs(user_id, reminder_date) where reminder_date is not null;
create index if not exists moves_owner_return_due_idx on public.moves(user_id, returned, due);
create index if not exists moves_owner_item_idx on public.moves(user_id, item_id);
create index if not exists projects_owner_status_updated_idx on public.projects(user_id, status, updated_at desc);
create index if not exists tasks_owner_project_done_idx on public.project_tasks(user_id, project_id, done);
create index if not exists tasks_owner_item_idx on public.project_tasks(user_id, item_id) where item_id is not null;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_items_touch on public.items;
create trigger trg_items_touch before update on public.items for each row execute function public.touch_updated_at();
drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects for each row execute function public.touch_updated_at();
drop trigger if exists trg_quick_notes_touch on public.quick_notes;
create trigger trg_quick_notes_touch before update on public.quick_notes for each row execute function public.touch_updated_at();

-- L'API Data ne reçoit aucun droit anonyme ; l'utilisateur connecté reste limité par RLS.
revoke all on table public.locations, public.items, public.maintenance_logs, public.moves, public.projects, public.project_tasks, public.quick_notes from anon, public, authenticated;
grant select, insert, update, delete on table public.locations, public.items, public.maintenance_logs, public.moves, public.projects, public.project_tasks, public.quick_notes to authenticated;
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.moves enable row level security;
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.quick_notes enable row level security;

drop policy if exists own_all on public.locations;
create policy own_all on public.locations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_all on public.items;
create policy own_all on public.items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_all on public.maintenance_logs;
create policy own_all on public.maintenance_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_all on public.moves;
create policy own_all on public.moves for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_all on public.projects;
create policy own_all on public.projects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_all on public.project_tasks;
create policy own_all on public.project_tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_all on public.quick_notes;
create policy own_all on public.quick_notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Synchronisation instantanée entre appareils ; RLS s'applique aussi aux événements Realtime.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['locations','items','maintenance_logs','moves','projects','project_tasks','quick_notes'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

-- Les anciens champs de photo restent inertes pour ne pas casser une migration de schéma existante.
-- Le client n'envoie plus de fichiers et n'utilise pas Supabase Storage.
