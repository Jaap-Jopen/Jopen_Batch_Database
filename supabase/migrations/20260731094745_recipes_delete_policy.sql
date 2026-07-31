-- ============================================================================
-- DELETE-policy op recipes
--
-- Tot nu toe bestond er geen manier om een recept echt te verwijderen (alleen
-- archiveren via status='gearchiveerd'). De nieuwe Delete-knop op de
-- receptkaart (naast Edit, alleen zichtbaar voor editor/admin) vereist een
-- expliciete RLS-policy, anders blokkeert RLS de DELETE standaard.
--
-- Let op (bewust geen automatische opruimactie hier): als een recept al
-- gebruikt is in batches, brew_planning of recipe_ingredients-achtige
-- tabellen, kan de DELETE alsnog stuklopen op een foreign-key-constraint
-- (afhankelijk van hoe die destijds is aangemaakt, van vóór deze migratiemap
-- bestond). In dat geval krijgt de gebruiker gewoon de Postgres-foutmelding
-- te zien in plaats van dat er stilzwijgend iets verkeerd gaat -- bewust geen
-- ON DELETE CASCADE toegevoegd zonder dat expliciet te bespreken.
-- ============================================================================

drop policy if exists "recipes_delete_editor_of_hoger" on recipes;
create policy "recipes_delete_editor_of_hoger"
  on recipes for delete
  to authenticated
  using (is_editor_of_hoger());
