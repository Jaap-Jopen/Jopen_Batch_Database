-- ============================================================================
-- Admin mag batches verwijderen uit het Batch Creation-overzicht.
-- Additief/veilig: voegt alleen een DELETE-policy toe, verandert niets aan
-- bestaande data of policies.
-- ============================================================================

drop policy if exists "batches_delete_admin" on batches;
create policy "batches_delete_admin"
  on batches for delete
  to authenticated
  using (is_admin());
