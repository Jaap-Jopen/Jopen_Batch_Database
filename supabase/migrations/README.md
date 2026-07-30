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
- `20260729133833_ph_maische_start_koken_naar_tekst.sql` — pH-kolommen van
  `numeric` naar `text` (bereikwaarden zoals "5,4 - 5,5" konden anders niet
  opgeslagen worden).
- `20260729134446_batches_delete_admin_policy.sql` — DELETE-policy op
  `batches`, alleen voor admins.
- `20260730173801_create_brouwplanning_en_capaciteit.sql` — Fase Geel,
  jaarplanning: `brew_plan_group`-enum (jk/wp_60hl/wp_120hl/wp_320hl),
  `brew_capacity` (wekelijks max aantal brouwsels, twee niveaus: jk en wp-totaal)
  en `brew_planning` (geplande brouwsels per week/groep/recept). RLS staat nu
  bewust open voor elke ingelogde gebruiker (geen rolonderscheid) — dat volgt
  later via een rollen-rechtenscherm.
- `20260730173855_create_brew_planning_geschiedenis.sql` — automatische
  wijzigingslog op `brew_planning` via trigger (`brew_planning_geschiedenis`
  + leesbare view `brew_planning_wijzigingen`), zodat later te herleiden is
  hoe vaak/wanneer de planning nog wordt bijgesteld.
- `20260730191029_recipes_kleur_kolom.sql` — vrij tekstveld `kleur` op
  `recipes`, gevuld via een ronde kleurenselectie in `recept-invoer.html`,
  gebruikt om geplande brouwsels in `brouwplanning.html` sneller herkenbaar
  te maken.
- `20260730194612_create_eenheden_tabel.sql` — `eenheden`-tabel, beheerbaar
  via Settings → Units. Eerste stap richting het vervangen van het vrije
  tekstveld "Unit" op receptregels door een vaste keuzelijst — die omzetting
  zelf moet nog gebeuren.
