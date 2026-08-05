-- ============================================================================
-- Laatst ingelogd-tijdstip voor gebruikers
--
-- Doel: op het gebruikersscherm (gebruikers.html) zien wanneer iemand voor
-- het laatst is ingelogd. Supabase Auth houdt dit zelf bij op
-- auth.users.last_sign_in_at, maar dat is alleen met de service_role key
-- leesbaar (niet vanuit de browser met de sessie van een ingelogde
-- gebruiker) -- vandaar een eigen kolom op de publieke gebruikers-tabel,
-- bijgewerkt door de gebruiker zelf op het moment van inloggen.
--
-- zet_laatst_ingelogd() is SECURITY DEFINER zodat een gebruiker zijn eigen
-- laatst_ingelogd-tijdstip kan wegschrijven zonder dat daarvoor een brede
-- UPDATE-policy op de hele gebruikers-tabel nodig is. De functie werkt
-- alleen de rij van auth.uid() zelf bij, dus een gebruiker kan hiermee nooit
-- andermans rij aanpassen.
-- ============================================================================

alter table gebruikers add column if not exists laatst_ingelogd timestamptz;

create or replace function zet_laatst_ingelogd()
returns void as $$
begin
  update gebruikers set laatst_ingelogd = now() where id = auth.uid();
end;
$$ language plpgsql security definer;

grant execute on function zet_laatst_ingelogd() to authenticated;
