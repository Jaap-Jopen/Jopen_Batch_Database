-- ============================================================================
-- batches-tabel voor Batch Creation
-- Plak dit in de Supabase SQL Editor en voer uit.
--
-- Aannames (even checken of dit klopt met je schema):
-- - recipes.id is het type dat recipe_id hieronder moet matchen (bigint/serial
--   of uuid) — pas de datatype-regel in recipe_id hieronder aan indien nodig.
-- - gebruikers.id is uuid (matcht auth.users.id), zoals overal elders gebruikt.
-- - Er bestaat al een is_editor_of_hoger() SECURITY DEFINER-functie (RLS-helper
--   uit eerdere sessies). Zo niet: vervang de policy-check hieronder door je
--   eigen rol-check.
-- ============================================================================

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  batchnummer integer not null unique,
  recipe_id bigint not null references recipes(id),
  naam text not null,
  aangemaakt_op timestamptz not null default now(),
  aangemaakt_door uuid references gebruikers(id)
);

create index if not exists idx_batches_batchnummer on batches (batchnummer desc);
create index if not exists idx_batches_recipe_id on batches (recipe_id);

alter table batches enable row level security;

-- Iedereen die is ingelogd mag de lijst zien (status-dashboard + Batch Creation-pagina)
drop policy if exists "batches_select_authenticated" on batches;
create policy "batches_select_authenticated"
  on batches for select
  to authenticated
  using (true);

-- Alleen editor/admin mag een nieuwe batch aanmaken
drop policy if exists "batches_insert_editor_of_hoger" on batches;
create policy "batches_insert_editor_of_hoger"
  on batches for insert
  to authenticated
  with check (is_editor_of_hoger());
