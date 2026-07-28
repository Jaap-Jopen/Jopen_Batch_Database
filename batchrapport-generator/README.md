# Batchrapport-generator

Genereert een gevuld batchrapport (.xlsx) voor één batch: haalt het gekoppelde
recept + alle sub-tabellen op uit Supabase, plakt de waarden op de juiste plek
in `Batchrapport_sjabloon.xlsx`, herberekent Hop-rendement/EBU, en laat alle
overige formules in het sjabloon met rust (die blijven gewoon werken zodra de
operator de rest tijdens het brouwen invult).

## Installatie

```
npm install
```

## Gebruik

```
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role key, NIET de publishable/anon key> \
node generate-batchrapport.js <batchnummer>
```

Output: `./output/batch-<batchnummer>.xlsx`

**Waarom de service_role key en niet de anon key uit `config.js`?** Dit script
draait server-side/lokaal, niet in de browser, en moet alle receptdata kunnen
lezen ongeacht RLS-policies. Gebruik deze key nooit in een frontend-bestand.

## Testen zonder Supabase

```
npm test
```

Vult het sjabloon met verzonnen testdata (`test-fill.js`) — handig om te
controleren of de mapping/schrijf-logica nog klopt na wijzigingen, zonder dat
er een echte databaseverbinding nodig is.

## Wat er gebeurt

1. `batches`-tabel opzoeken op batchnummer → `recipe_id`
2. Recept + alle sub-tabellen ophalen (`recipe_specificaties`, `recipe_fermentatie`,
   `recipe_brouwspecificaties`, `recipe_water`, `recipe_verpakking`,
   `recipe_processtappen`, `recipe_comments`, `recipe_ingredients`, laatste 4
   `recipe_revisies`)
3. Sjabloon inladen, cellen vullen via de mappings in `./data/`:
   - `scalar_field_map.json` — losse spec/tolerantie/brouwspecificatie/verpakking/
     water/comments-velden
   - `ingredient_field_map.json` — genummerde ingrediënt-slots (Hop 1-15, Mout
     1-10, Dry Hop 1-6, Toegiften Brouwers/Kelder, Gist)
   - `revisie_field_map.json` — laatste 4 revisies
   - `formaten_field_map.json` — verpakkingsformaat-checkboxen
   - vestigingsafhankelijke (WP/Kerk) velden apart in de code (`WP_KERK_VELDEN`)
4. Hop-rendement%/EBU per hopgift + Calculated total EBU herberekend (zelfde
   logica als `recept-invoer.html`) en als waarde geplakt — dit tabblad had
   ooit een live `EBU Berekening`-tabblad nodig, nu niet meer
5. Batchnummer + receptnaam weggeschreven, opgeslagen als nieuw bestand

## Onderhoud

De hop-rendement-tabel en `bepaalHopRendement`/`bepaalHopEbu`-logica staan
**gedupliceerd** op drie plekken: hier, in `recept-invoer.html` en in
`receptoverzicht.html`. Verander je de tabel of formule, doe dat op alle drie.
(Overwegen om dit ooit te delen via een klein gemeenschappelijk JS-bestand.)

Als het recept-schema wijzigt (nieuwe/hernoemde velden), moet
`../batchrapport_cel_mapping.csv` opnieuw gegenereerd worden en de JSON-
bestanden in `./data/` opnieuw afgeleid.
