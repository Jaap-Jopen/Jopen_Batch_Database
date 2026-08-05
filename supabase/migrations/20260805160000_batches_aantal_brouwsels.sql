-- ============================================================================
-- Aantal brouwsels op batches
--
-- De batchrapport-generatiescripts (batchrapport-vullen.js,
-- generate-batchrapport.js) schrijven al langer `bundel.batch.aantal_brouwsels`
-- naar Recept-voorblad!G7 (en Brouwen!F8 rekent daar via een live formule
-- weer mee verder) -- maar de kolom zelf bestond nog niet op `batches` en er
-- was ook geen invoerveld op de Batch Creation-pagina. Dit legt dat alsnog
-- vast; batchcreation.html is in dezelfde sessie aangepast om dit veld
-- daadwerkelijk in te vullen en mee te sturen bij het aanmaken van een batch.
-- ============================================================================

alter table batches add column if not exists aantal_brouwsels integer;
