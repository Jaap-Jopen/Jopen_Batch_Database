-- ============================================================================
-- Eenheden -- beheerbare lijst via Settings
--
-- Eerste stap richting het vervangen van het vrije tekstveld "Unit" op
-- receptregels (recipe_ingredients.eenheid) door een vaste keuzelijst. Deze
-- migratie legt alleen de beheerbare lijst zelf vast (via settings.html);
-- het omzetten van recipe_ingredients.eenheid naar een verwijzing hiernaar
-- volgt in een latere sessie.
-- ============================================================================

create table if not exists eenheden (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text,
  sort_order int not null default 0,
  aangemaakt_op timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eenheden_code_key'
  ) then
    alter table eenheden add constraint eenheden_code_key unique (code);
  end if;
end $$;

alter table eenheden enable row level security;

drop policy if exists "eenheden_select_authenticated" on eenheden;
create policy "eenheden_select_authenticated"
  on eenheden for select
  to authenticated
  using (true);

drop policy if exists "eenheden_all_admin" on eenheden;
create policy "eenheden_all_admin"
  on eenheden for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Eenmalige startlijst met de eenheden die nu al in gebruik zijn/waarschijnlijk
-- nodig zijn. Idempotent: bestaande codes worden overgeslagen.
insert into eenheden (code, label, sort_order)
select * from (values
  ('kg', 'Kilogram', 1),
  ('g', 'Gram', 2),
  ('l', 'Liter', 3),
  ('ml', 'Milliliter', 4),
  ('stuks', 'Pieces', 5)
) as v(code, label, sort_order)
where not exists (select 1 from eenheden e where e.code = v.code);
