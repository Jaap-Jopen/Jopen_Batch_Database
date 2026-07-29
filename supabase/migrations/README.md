# Supabase-migraties

Deze map wordt gevolgd door Supabase's GitHub-integratie: bij een merge naar
`main` worden nieuwe bestanden hierin **automatisch op productie uitgevoerd**.
Dat is dus geen "plak in de SQL Editor en kijk zelf mee" meer, maar een echte
productie-wijziging zodra dit gepusht wordt.

## Afspraak (vastgelegd 29 juli 2026)
- **Additief en veilig** (nieuwe kolom met `IF NOT EXISTS`, nieuwe tabel,
  nieuwe policy, nieuwe index): mag zonder expliciet akkoord gecommit en
  gepusht worden, wel altijd duidelijk gemeld wat er verandert.
- **Destructief of onomkeerbaar** (`DROP TABLE`/`DROP COLUMN`, data die
  overschreven wordt, constraints die bestaande rijen kunnen laten falen):
  **nooit** zomaar pushen. Eerst expliciet voorleggen wat er gaat gebeuren en
  op akkoord wachten, ook als het voor de hand lijkt te liggen.

## Conventie
- Bestandsnaam: `YYYYMMDDHHMMSS_korte_beschrijving.sql` (UTC-timestamp,
  oplopend/chronologisch — dat bepaalt de uitvoervolgorde).
- Elke migratie is **idempotent**: gebruik `IF NOT EXISTS`,
  `DROP POLICY IF EXISTS` + opnieuw aanmaken, `DO $$ ... IF NOT EXISTS ... $$`
  voor constraints, enz. Zo kan een migratie geen kwaad als een deel ervan
  handmatig al eens is uitgevoerd (zoals bij `batches` het geval was).
- Nooit een al-gepushte migratie achteraf aanpassen — een correctie wordt een
  nieuw, volgend bestand.

## Bestaande migraties
- `20260729091304_create_batches_table.sql` — de `batches`-tabel voor Batch
  Creation. Legt de bestaande (al op productie aanwezige) eindtoestand vast;
  dit is de eerste via deze map getrackte migratie, het schema van vóór deze
  datum (recepten, ingrediënten, gebruikers, enz.) is niet met terugwerkende
  kracht hierin opgenomen.
