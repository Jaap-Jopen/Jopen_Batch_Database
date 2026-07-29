-- ============================================================================
-- batches-tabel voor Batch Creation
--
-- Dit is de EERSTE via de GitHub-integratie getrackte migratie. De tabel
-- bestond op productie al (handmatig aangemaakt via de SQL Editor in eerdere
-- sessies, in twee stappen: batches_tabel.sql + batches_tabel_fix.sql).
-- Dit bestand legt de huidige, gewenste eindtoestand vast en is volledig
-- idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS overal) -- dus veilig om
-- te draaien ongeacht wat er al staat, zonder data te verliezen of dubbel
-- aan te maken.
--
-- Aannames (zie ook eerdere sessie-aantekeningen):
-- - recipes.id is bigint
-- - gebruikers.id is uuid (matcht auth.users.id)
-- - is_editor_of_hoger() bestaat al als SECURITY DEFINER RLS-helper
-- ============================================================================

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  batchnummer integer not null,
  recipe_id bigint references recipes(id),
  naam text,
  aangemaakt_op timestamptz not null default now(),
  aangemaakt_door uuid references gebruikers(id)
);

alter table batches add column if not exists recipe_id bigint references recipes(id);
alter table batches add column if not exists naam text;
alter table batches add column if not exists aangemaakt_op timestamptz not null default now();
alter table batches add column if not exists aangemaakt_door uuid references gebruikers(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'batches_batchnummer_key'
  ) then
    alter table batches add constraint batches_batchnummer_key unique (batchnummer);
  end if;
end $$;

create index if not exists idx_batches_batchnummer on batches (batchnummer desc);
create index if not exists idx_batches_recipe_id on batches (recipe_id);

alter table batches enable row level security;

drop policy if exists "batches_select_authenticated" on batches;
create policy "batches_select_authenticated"
  on batches for select
  to authenticated
  using (true);

drop policy if exists "batches_insert_editor_of_hoger" on batches;
create policy "batches_insert_editor_of_hoger"
  on batches for insert
  to authenticated
  with check (is_editor_of_hoger());
