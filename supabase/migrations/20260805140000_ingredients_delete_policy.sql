-- ============================================================================
-- DELETE-policy op ingredients
--
-- Zelfde reden en dezelfde aanpak als 20260731094745_recipes_delete_policy.sql:
-- er bestond nog geen manier om een ingrediënt echt te verwijderen. Nieuwe
-- Delete-knop op de ingrediëntkaart (naast Edit, alleen zichtbaar voor
-- editor/admin) vereist een expliciete RLS-policy.
--
-- Let op (zelfde kanttekening als bij recipes): geen ON DELETE CASCADE
-- toegevoegd. Als een ingrediënt nog in gebruik is in recipe_ingredients,
-- of als het een oudere, gearchiveerde versie is waar ingredient_revisies
-- nog naar verwijst, kan de DELETE stuklopen op een foreign-key-constraint.
-- De gebruiker krijgt dan gewoon de Postgres-foutmelding te zien in plaats
-- van dat er stilzwijgend iets verkeerd gaat.
-- ============================================================================

drop policy if exists "ingredients_delete_editor_of_hoger" on ingredients;
create policy "ingredients_delete_editor_of_hoger"
  on ingredients for delete
  to authenticated
  using (is_editor_of_hoger());
