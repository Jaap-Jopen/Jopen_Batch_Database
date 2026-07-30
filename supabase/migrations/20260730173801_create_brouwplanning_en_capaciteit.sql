-- ============================================================================
-- Brouwplanning (Fase Geel) — geplande brouwsels + wekelijkse capaciteit
--
-- Vier vaste planninggroepen (geen aparte tabel, weinig kans op wijziging):
--   jk        — JK Brouwplan
--   wp_60hl   — WP 60HL Brouwplan   (recept-hl x brouwsels < 80)
--   wp_120hl  — WP 120HL Brouwplan  (80 <= hl < 140)
--   wp_320hl  — WP 320HL Brouwplan  (hl >= 140)
--
-- Capaciteit wordt per week ingesteld op TWEE niveaus, niet per plan_group:
--   'jk' — max brouwsels voor de jk-kolom
--   'wp' — max brouwsels voor de SOM van wp_60hl + wp_120hl + wp_320hl samen
-- (bewuste keuze, besproken met de gebruiker — er is geen HL-maximum, alleen
-- een brouwsel-maximum).
--
-- Aannames (net als bij batches.sql):
-- - recipes.id is bigint
-- - gebruikers.id is uuid (matcht auth.users.id)
-- - RLS staat voor nu open voor elke ingelogde gebruiker (geen rolonderscheid
--   in wat mag/niet mag — dat volgt later via een apart rollen-rechtenscherm).
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'brew_plan_group') then
    create type brew_plan_group as enum ('jk', 'wp_60hl', 'wp_120hl', 'wp_320hl');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Wekelijkse capaciteit (input door de brouwafdeling)
-- ---------------------------------------------------------------------------
create table if not exists brew_capacity (
  id uuid primary key default gen_random_uuid(),
  capacity_group text not null check (capacity_group in ('jk', 'wp')),
  iso_year int not null,
  week_number int not null check (week_number between 1 and 53),
  max_brouwsels numeric not null default 0,
  updated_by uuid references gebruikers(id),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brew_capacity_group_year_week_key'
  ) then
    alter table brew_capacity
      add constraint brew_capacity_group_year_week_key
      unique (capacity_group, iso_year, week_number);
  end if;
end $$;

create index if not exists idx_brew_capacity_year_week on brew_capacity (iso_year, week_number);

alter table brew_capacity enable row level security;

drop policy if exists "brew_capacity_select_authenticated" on brew_capacity;
create policy "brew_capacity_select_authenticated"
  on brew_capacity for select
  to authenticated
  using (true);

drop policy if exists "brew_capacity_all_authenticated" on brew_capacity;
create policy "brew_capacity_all_authenticated"
  on brew_capacity for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Geplande brouwsels
-- ---------------------------------------------------------------------------
create table if not exists brew_planning (
  id uuid primary key default gen_random_uuid(),
  plan_group brew_plan_group not null,
  iso_year int not null,
  week_number int not null check (week_number between 1 and 53),
  recipe_id bigint references recipes(id),
  aantal_brouwsels numeric not null default 1,
  hl numeric,                          -- = aantal_brouwsels x recept.brouwsel_hl, meegeschreven bij opslaan
  prio boolean not null default false,
  sort_order int not null default 0,
  notities text,
  aangemaakt_door uuid references gebruikers(id),
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

create index if not exists idx_brew_planning_year_week on brew_planning (iso_year, week_number);
create index if not exists idx_brew_planning_recipe on brew_planning (recipe_id);

alter table brew_planning enable row level security;

drop policy if exists "brew_planning_select_authenticated" on brew_planning;
create policy "brew_planning_select_authenticated"
  on brew_planning for select
  to authenticated
  using (true);

drop policy if exists "brew_planning_all_authenticated" on brew_planning;
create policy "brew_planning_all_authenticated"
  on brew_planning for all
  to authenticated
  using (true)
  with check (true);
