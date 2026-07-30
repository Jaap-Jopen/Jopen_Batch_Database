-- ============================================================================
-- Wijzigingslog voor brouwplanning
--
-- Legt automatisch (via trigger, dus onafhankelijk van welk scherm de
-- wijziging deed) elke create/update/delete op brew_planning vast, inclusief
-- de volledige rij voor en na de wijziging. Dit is bedoeld om later te kunnen
-- uitlezen hoe vaak de planning nog op het laatste moment wordt aangepast
-- (bv. changed_at vergelijken met het geplande week_number), en om te zien
-- wie wanneer een brouwsel heeft doorgeschoven, prio heeft gezet, etc.
--
-- brew_planning_id heeft bewust GEEN foreign key/cascade: de historie moet
-- blijven bestaan ook nadat het onderliggende geplande brouwsel verwijderd is.
-- ============================================================================

create table if not exists brew_planning_geschiedenis (
  id uuid primary key default gen_random_uuid(),
  brew_planning_id uuid not null,
  actie text not null check (actie in ('created', 'updated', 'deleted')),
  voor jsonb,
  na jsonb,
  gewijzigd_door uuid references gebruikers(id),
  gewijzigd_op timestamptz not null default now()
);

create index if not exists idx_brew_planning_geschiedenis_planning_id
  on brew_planning_geschiedenis (brew_planning_id);
create index if not exists idx_brew_planning_geschiedenis_gewijzigd_op
  on brew_planning_geschiedenis (gewijzigd_op desc);

create or replace function log_brew_planning_wijziging()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    insert into brew_planning_geschiedenis (brew_planning_id, actie, na, gewijzigd_door)
    values (new.id, 'created', to_jsonb(new), auth.uid());
    return new;
  elsif (TG_OP = 'UPDATE') then
    insert into brew_planning_geschiedenis (brew_planning_id, actie, voor, na, gewijzigd_door)
    values (new.id, 'updated', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  elsif (TG_OP = 'DELETE') then
    insert into brew_planning_geschiedenis (brew_planning_id, actie, voor, gewijzigd_door)
    values (old.id, 'deleted', to_jsonb(old), auth.uid());
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_brew_planning_geschiedenis on brew_planning;
create trigger trg_brew_planning_geschiedenis
  after insert or update or delete on brew_planning
  for each row execute function log_brew_planning_wijziging();

-- Leesbare view zodat je niet telkens jsonb hoeft uit te pakken voor de
-- meest gevraagde velden.
create or replace view brew_planning_wijzigingen as
select
  h.id,
  h.brew_planning_id,
  h.actie,
  (h.voor->>'week_number')::int as week_voor,
  (h.na->>'week_number')::int as week_na,
  (h.voor->>'iso_year')::int as jaar_voor,
  (h.na->>'iso_year')::int as jaar_na,
  (h.na->>'aantal_brouwsels')::numeric as brouwsels_na,
  (h.na->>'prio')::boolean as prio_na,
  h.na->>'plan_group' as plan_group_na,
  h.gewijzigd_door,
  g.naam as gewijzigd_door_naam,
  h.gewijzigd_op
from brew_planning_geschiedenis h
left join gebruikers g on g.id = h.gewijzigd_door;

alter table brew_planning_geschiedenis enable row level security;

drop policy if exists "brew_planning_geschiedenis_select_authenticated" on brew_planning_geschiedenis;
create policy "brew_planning_geschiedenis_select_authenticated"
  on brew_planning_geschiedenis for select
  to authenticated
  using (true);

-- Bewust GEEN insert/update/delete policy: alleen de trigger-functie
-- (security definer) mag hierin schrijven, nooit rechtstreeks vanuit de app.
