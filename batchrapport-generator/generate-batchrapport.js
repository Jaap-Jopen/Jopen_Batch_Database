#!/usr/bin/env node
/**
 * generate-batchrapport.js
 * -----------------------------------------------------------------------
 * Genereert een gevuld batchrapport (.xlsx) voor één batch uit de `batches`-
 * tabel: haalt het gekoppelde recept + alle sub-tabellen op uit Supabase,
 * plakt de waarden op de juiste plek in Batchrapport_sjabloon.xlsx (via de
 * mapping-bestanden in ./data), herberekent Hop-rendement/EBU en laat alle
 * overige formules in het sjabloon met rust.
 *
 * Gebruik:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node generate-batchrapport.js <batchnummer>
 *
 * LET OP: gebruik hier de service_role key (niet de publishable/anon key uit
 * config.js), dit script draait server-side/lokaal en moet buiten RLS om alle
 * receptdata kunnen lezen. Nooit deze key in een browser/frontend gebruiken.
 *
 * Output: ./output/batch-<batchnummer>.xlsx
 * -----------------------------------------------------------------------
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const SCALAR_MAP = require('./data/scalar_field_map.json');
const INGREDIENT_MAP = require('./data/ingredient_field_map.json');
const REVISIE_MAP = require('./data/revisie_field_map.json');
const FORMATEN_MAP = require('./data/formaten_field_map.json');

const TEMPLATE_PATH = path.join(__dirname, 'Batchrapport_sjabloon.xlsx');
const OUTPUT_DIR = path.join(__dirname, 'output');

// ---------------------------------------------------------------------------
// Hop rendement (utilization) & EBU — exact dezelfde tabel/logica als
// recept-invoer.html / receptoverzicht.html (1-op-1 uit Moederdata.xlsm,
// EBU Berekening!T2:AF27 + Recept-voorblad!K43). Bewust hier gedupliceerd
// i.p.v. gedeeld via een <script>-bestand, omdat dit script in Node draait
// en de webpagina's in de browser — zie qua onderhoud: als de tabel ooit
// verandert, moet dat op BEIDE plekken (hier en in de twee HTML-bestanden).
// ---------------------------------------------------------------------------
const HOP_SG_BUCKETS = [1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.09, 1.10, 1.11, 1.12, 1.13];
const HOP_RENDEMENT_TABEL = [
  { kooktijd: 0,   rendement: [6.5, 6, 6, 5.5, 5, 3, 2.5, 2, 1.8, 1.7, 1.6, null] },
  { kooktijd: 5,   rendement: [9.5, 9, 8, 7.5, 6, 3.5, 3, 2.8, 2.5, 2.4, 2.3, null] },
  { kooktijd: 10,  rendement: [18, 16, 14, 11, 9, 7, 7, 6.5, 5, 4.8, 4.6, null] },
  { kooktijd: 15,  rendement: [18, 17.5, 17, 15, 14, 12, 10, 9, 7, 6.5, 6.3, null] },
  { kooktijd: 20,  rendement: [25, 23, 21, 20, 16, 14, 12, 11, 9, 8.5, 8.2, null] },
  { kooktijd: 25,  rendement: [27.5, 26, 24.5, 23.68, 20, 17, 15, 14, 11, 10, 9.5, null] },
  { kooktijd: 30,  rendement: [30, 28, 26, 24, 22, 20, 17, 16, 14, 13, 11, null] },
  { kooktijd: 35,  rendement: [31, 29, 27, 25, 23, 21, 19, 17, 16, 15, 14.5, null] },
  { kooktijd: 40,  rendement: [32, 30, 28, 26, 24, 22, 20, 19, 17, 16, 15, null] },
  { kooktijd: 45,  rendement: [34, 32, 30, 27, 25, 24, 21, 20, 18, 17, 16, null] },
  { kooktijd: 50,  rendement: [36, 34, 32, 28, 25, 25, 22, 21, 19, 18, 17, null] },
  { kooktijd: 55,  rendement: [40, 37, 34, 29.5, 26, 25, 23, 22, 20, 19, 18, null] },
  { kooktijd: 60,  rendement: [42, 39, 36, 31, 27.07, 26, 25, 23, 21, 20, 19, null] },
  { kooktijd: 65,  rendement: [45, 41, 37, 33, 30, 28, 27, 25, 23, 21, 21, null] },
  { kooktijd: 70,  rendement: [45, 42.5, 40, 35, 33, 32, 30, 27, 25, 23, 23, null] },
  { kooktijd: 75,  rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 80,  rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 90,  rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 95,  rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 100, rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 105, rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 110, rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 115, rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
  { kooktijd: 120, rendement: [null, 44, 42, 38, 36, 35, 33, 30, 27, 25, 25, null] },
];
function bepaalHopSgBucket(og) {
  const p = parseInt(String(og).slice(0, 2), 10);
  if (Number.isNaN(p)) return null;
  return Math.round((259 / (259 - p)) * 100) / 100;
}
function bepaalHopSgKolomIndex(sgBucket) {
  let idx = -1;
  for (let i = 0; i < HOP_SG_BUCKETS.length; i++) if (HOP_SG_BUCKETS[i] <= sgBucket) idx = i;
  return idx;
}
function bepaalHopRendement(kooktijd, og) {
  const sgBucket = bepaalHopSgBucket(og);
  if (sgBucket === null) return null;
  const kolomIdx = bepaalHopSgKolomIndex(sgBucket);
  if (kolomIdx === -1) return null;
  const rij = HOP_RENDEMENT_TABEL.find(r => r.kooktijd === kooktijd);
  return rij ? rij.rendement[kolomIdx] : null;
}
function bepaalHopEbu(gewichtGram, alphaPct, kooktijd, og, volumeKookHl) {
  const rendementPct = bepaalHopRendement(kooktijd, og);
  if (rendementPct === null || !volumeKookHl || !gewichtGram || alphaPct == null) return null;
  const volumeLiter = volumeKookHl * 100;
  return (gewichtGram * 1000) * (alphaPct / 100) * (rendementPct / 100) / volumeLiter;
}

// ---------------------------------------------------------------------------
// Supabase ophalen
// ---------------------------------------------------------------------------
async function haalBatchDataOp(supabase, batchnummer) {
  const { data: batch, error: batchErr } = await supabase
    .from('batches').select('*').eq('batchnummer', batchnummer).single();
  if (batchErr || !batch) throw new Error(`Batch ${batchnummer} niet gevonden: ${batchErr?.message || ''}`);

  const recipeId = batch.recipe_id;
  const [recipe, specs, ferm, brouw, water, verpakking, processtappen, comments, ingredients, revisies, alleIngredienten] =
    await Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase.from('recipe_specificaties').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_fermentatie').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_brouwspecificaties').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_water').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_verpakking').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_processtappen').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_comments').select('*').eq('recipe_id', recipeId).maybeSingle(),
      supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipeId).order('rol').order('volgorde'),
      supabase.from('recipe_revisies').select('*').eq('recipe_id', recipeId)
        .order('versie_major', { ascending: false }).order('versie_minor', { ascending: false }).order('id', { ascending: false })
        .limit(4),
      supabase.from('ingredients').select('id, naam'),
    ]);

  if (recipe.error || !recipe.data) throw new Error(`Recept ${recipeId} niet gevonden: ${recipe.error?.message || ''}`);

  const ingredientNaam = new Map((alleIngredienten.data || []).map(i => [i.id, i.naam]));

  return {
    batch,
    recipes: recipe.data,
    recipe_specificaties: specs.data || {},
    recipe_fermentatie: ferm.data || {},
    recipe_brouwspecificaties: brouw.data || {},
    recipe_water: water.data || {},
    recipe_verpakking: verpakking.data || {},
    recipe_processtappen: processtappen.data || {},
    recipe_comments: comments.data || {},
    recipe_ingredients: ingredients.data || [],
    recipe_revisies: revisies.data || [],
    ingredientNaam,
  };
}

// ---------------------------------------------------------------------------
// Sjabloon vullen
// ---------------------------------------------------------------------------
// Postgres 'numeric'-kolommen komen via PostgREST/Supabase als STRING terug
// (bv. "0.5"), niet als JS-getal -- om precisieverlies te voorkomen. Als je
// zo'n string ongewijzigd in een cel zet, ziet Excel dat als tekst (met een
// punt), niet als getal, en breekt elke formule die er verder op rekent.
// Hier expliciet omzetten naar een echt getal zodra het er een is.
function naarGetalIndienMogelijk(waarde) {
  if (typeof waarde === 'string' && waarde.trim() !== '' && !Number.isNaN(Number(waarde))) {
    return Number(waarde);
  }
  return waarde;
}

function schrijfCel(workbook, sheetCel, waarde) {
  const [sheetNaam, cel] = sheetCel.split('!');
  const ws = workbook.getWorksheet(sheetNaam);
  if (!ws) { console.warn(`Onbekend tabblad: ${sheetNaam} (cel ${sheetCel})`); return; }
  ws.getCell(cel).value = (waarde === undefined || waarde === null) ? null : naarGetalIndienMogelijk(waarde);
}

function vulScalaireVelden(workbook, bundel, isWP) {
  for (const veld of SCALAR_MAP) {
    if (veld.wp_only && !isWP) continue; // WP-only veld, dit recept is niet WP -> leeg laten
    const [tabel, kolom] = veld.db_veld.split('.');
    const bron = bundel[tabel];
    if (!bron) { console.warn(`Onbekende tabel in mapping: ${tabel} (${veld.key})`); continue; }
    const waarde = bron[kolom];
    for (const loc of veld.locaties) schrijfCel(workbook, loc, waarde);
  }
}

// Vestigingsafhankelijke (WP/Kerk) velden: 1 Excel-cel, 2 mogelijke bron-
// kolommen afhankelijk van vestiging. isWP bepaalt welke kolom gebruikt wordt.
const WP_KERK_VELDEN = [
  { cel: 'Brouwen!F10', wp: 'stort_special_bin_kg', kerk: 'maischwater' },
  { cel: 'Brouwen!F18', wp: 'volume_water_additie_terugkoeling', kerk: 'eindvolume_brouwsel' },
  { cel: 'Brouwen!N17', wp: 'sparging_1e', kerk: 'eerste_afloop' },
  { cel: 'Brouwen!N18', wp: 'sparging_2e', kerk: 'spoelwater' },
  { cel: 'Brouwen!N19', wp: 'sparging_3e', kerk: 'spoel_afloop' },
  { cel: 'Brouwen!N20', wp: 'sparging_4e', kerk: 'totaal_gefiltreerd_volume' },
  { cel: 'Brouwen!I22', wp: 'kamers_mashfilter', kerk: 'lauterfactor' },
  { cel: 'Recept-voorblad!K9', wp: 'kamers_mashfilter', kerk: 'walsenmolen' },
];
function vulWpKerkVelden(workbook, bundel, isWP) {
  const bron = bundel.recipe_brouwspecificaties;
  for (const v of WP_KERK_VELDEN) {
    schrijfCel(workbook, v.cel, bron[isWP ? v.wp : v.kerk]);
  }
}

// F8/F9/F11 in Brouwen wisselen van betekenis per vestiging (dit was eerder
// verkeerd samengevoegd tot 1 mapping-regel per ongeluk):
// - F8: WP -> live formule (Aantal brouwsels * Eindvolume brouwsel = "Totaal
//   volume batch"), géén databasewaarde. Kerk -> Receptnaam Software.
// - F9: WP -> Receptnaam Software. Kerk -> Naam special bin storting.
// - F11: altijd -> Naam special bin storting (ongeacht vestiging).
function vulReceptnaamKruisVelden(workbook, bundel, isWP) {
  const bron = bundel.recipe_brouwspecificaties;
  const ws = workbook.getWorksheet('Brouwen');
  if (isWP) {
    ws.getCell('F8').value = { formula: "'Recept-voorblad'!G7*Brouwen!F19" };
    ws.getCell('F9').value = bron.recept_naam_software ?? null;
  } else {
    ws.getCell('F8').value = bron.recept_naam_software ?? null;
    ws.getCell('F9').value = bron.naam_special_bin ?? null;
  }
  ws.getCell('F11').value = bron.naam_special_bin ?? null;

  // Gewenste stamwort (N8) = Origineel extract + Stamwort correctie brouwhuis.
  // Dat laatste veld heeft nog geen UI-invoerplek (staat sinds een eerdere
  // sessie als open punt), dus is voorlopig meestal leeg/0 -- dan komt hier
  // gewoon het Origineel extract zelf te staan totdat dat veld een plek
  // krijgt in recept-invoer.html.
  const origineelExtract = bundel.recipe_specificaties.origineel_extract;
  const stamwortCorrectie = bron.stamwort_correctie_brouwhuis;
  if (origineelExtract !== null && origineelExtract !== undefined) {
    ws.getCell('N8').value = Number(origineelExtract) + (stamwortCorrectie ? Number(stamwortCorrectie) : 0);
  }
}

// Zelfde sortering als sorteerHopHerbsRegels() in recept-invoer.html: hop(boil)
// aflopend op kooktijd, dry hop in vaste volgorde warm/16c/0c. Zo staan de
// toevoegingen per moment gegroepeerd, wat nodig is voor de dikke
// scheidingslijnen die de gebruiker per groep wil zien.
const DRY_HOP_VOLGORDE = ['warm', '16c', '0c'];
function sorteerHopgiften(rijen, rol) {
  if (rol === 'hopgift_kook') {
    return [...rijen].sort((a, b) => (parseFloat(b.tijdstip) || -Infinity) - (parseFloat(a.tijdstip) || -Infinity));
  }
  if (rol === 'dry_hop') {
    return [...rijen].sort((a, b) => DRY_HOP_VOLGORDE.indexOf(a.tijdstip) - DRY_HOP_VOLGORDE.indexOf(b.tijdstip));
  }
  return rijen;
}

function vulIngredientRijen(workbook, bundel) {
  const rollen = ['hopgift_kook', 'dry_hop', 'hoofdmout', 'toegift_brouwerij', 'toegift_kelder', 'gist'];
  for (const rol of rollen) {
    const cellenPerRij = INGREDIENT_MAP[rol];
    if (!cellenPerRij) continue;
    const ongesorteerd = bundel.recipe_ingredients.filter(r => r.rol === rol);
    const rijen = (rol === 'hopgift_kook' || rol === 'dry_hop')
      ? sorteerHopgiften(ongesorteerd, rol)
      : ongesorteerd.sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));

    Object.keys(cellenPerRij).sort((a, b) => Number(a) - Number(b)).forEach((volgordeStr, i) => {
      const regel = rijen[i]; // i-de regel van dit type, ongeacht de eigen 'volgorde'-waarde in de rij zelf
      const cellen = cellenPerRij[volgordeStr];
      if (!regel) { // geen ingrediënt op dit slot -> leeg laten
        for (const attr in cellen) schrijfCel(workbook, cellen[attr], null);
        return;
      }
      for (const attr in cellen) {
        let waarde;
        if (attr === 'naam') waarde = bundel.ingredientNaam.get(regel.ingredient_id) || regel.notitie || null;
        else waarde = regel[attr];
        schrijfCel(workbook, cellen[attr], waarde);
      }
    });
  }
}

function vulRevisies(workbook, bundel) {
  bundel.recipe_revisies.forEach((rv, i) => {
    const cellen = REVISIE_MAP[String(i + 1)];
    if (!cellen) return;
    if (cellen.versienummer) schrijfCel(workbook, cellen.versienummer, `${rv.versie_major}.${rv.versie_minor}`);
    if (cellen.datum) schrijfCel(workbook, cellen.datum, rv.datum);
    if (cellen.door) schrijfCel(workbook, cellen.door, rv.door);
    if (cellen.wijziging) schrijfCel(workbook, cellen.wijziging, rv.wijziging);
  });
}

function vulFormaten(workbook, bundel) {
  const gekozen = new Set(bundel.recipe_verpakking.formaten || []);
  for (const [naam, cel] of Object.entries(FORMATEN_MAP)) {
    schrijfCel(workbook, cel, gekozen.has(naam) ? 'X' : null);
  }
}

// Rendement%/EBU per hopgift (Recept-voorblad!I43:I57 / K43:K57) + Calculated
// total EBU (K64). Deze cellen zijn NIET meer live-formules in het sjabloon
// (die verwezen naar het verwijderde EBU Berekening-tabblad), dus hier
// herberekend met dezelfde logica als recept-invoer.html en als waarde geplakt.
function vulHopRendementEnEbu(workbook, bundel) {
  const og = bundel.recipe_specificaties.origineel_extract;
  const volumeKook = bundel.recipe_brouwspecificaties.volume_kook;
  const ws = workbook.getWorksheet('Recept-voorblad');

  const hopRijen = bundel.recipe_ingredients
    .filter(r => r.rol === 'hopgift_kook')
    .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));

  let totaalEbu = 0;
  for (let i = 0; i < 15; i++) {
    const rij = 43 + i;
    const regel = hopRijen[i];
    if (!regel) { ws.getCell(`I${rij}`).value = null; ws.getCell(`K${rij}`).value = null; continue; }

    const kooktijd = regel.tijdstip !== null && regel.tijdstip !== undefined && regel.tijdstip !== ''
      ? Number(regel.tijdstip) : null;
    const rendement = (kooktijd !== null && og) ? bepaalHopRendement(kooktijd, og) : null;
    const ebu = (kooktijd !== null && og) ? bepaalHopEbu(regel.hoeveelheid, regel.alpha_pct, kooktijd, og, volumeKook) : null;

    ws.getCell(`I${rij}`).value = rendement !== null ? Number(rendement.toFixed(1)) : null;
    ws.getCell(`K${rij}`).value = ebu !== null ? Number(ebu.toFixed(1)) : null;
    if (ebu !== null) totaalEbu += ebu;
  }
  ws.getCell('K64').value = Number(totaalEbu.toFixed(1));
}

// ---------------------------------------------------------------------------
// Hoofdlogica
// ---------------------------------------------------------------------------
async function main() {
  const batchnummer = Number(process.argv[2]);
  if (!batchnummer) {
    console.error('Gebruik: node generate-batchrapport.js <batchnummer>');
    process.exit(1);
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten als env-var gezet zijn.');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`Batch ${batchnummer} ophalen...`);
  const bundel = await haalBatchDataOp(supabase, batchnummer);

  const naam = bundel.recipes.naam || '';
  const locatie = (bundel.recipes.locatie || '').toLowerCase();
  // Het WP/Kerk-onderscheid zit in `short_name` (bv. "WP Mooie Nel"), niet in
  // `naam` (bv. "Mooie Nel") -- dat laatste is nu de schone weergavenaam en
  // draagt de WP-prefix niet meer per se. Q1 krijgt dezelfde waarde als de
  // WP-detectie, want Brouwen!A1 (='Recept-voorblad'!Q1) voedt tientallen
  // IF(LEFT(A1,2)="WP",...)-formules in Brouwen -- die moeten dus kloppen.
  const vestigingsBron = bundel.recipes.short_name || naam;
  const isWP = locatie.includes('waarderpolder') || vestigingsBron.toUpperCase().startsWith('WP');

  console.log(`Sjabloon inladen (${isWP ? 'Waarderpolder' : 'Jopen Kerk'}-recept)...`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  vulScalaireVelden(workbook, bundel, isWP);
  vulWpKerkVelden(workbook, bundel, isWP);
  vulReceptnaamKruisVelden(workbook, bundel, isWP);
  vulIngredientRijen(workbook, bundel);
  vulRevisies(workbook, bundel);
  vulFormaten(workbook, bundel);
  vulHopRendementEnEbu(workbook, bundel);
  zetHopGroepRanden(workbook, bundel);

  workbook.getWorksheet('Recept-voorblad').getCell('H3').value = 'Batch nr.:';
  workbook.getWorksheet('Recept-voorblad').getCell('K3').value = bundel.batch.batchnummer;
  workbook.getWorksheet('Recept-voorblad').getCell('Q1').value = vestigingsBron;

  // Bestandsnaam volgens de oorspronkelijke VBA-macro:
  //   K3 & " " & C3 & " v" & A101 & " " & Left(Q1,2) & ".xlsx"
  // A101 is hier "recipe_revisies rij 1" (versienummer, zonder "v"-prefix --
  // die voegt deze formule zelf toe); valt terug op recipes.versie_major/
  // _minor als er nog geen revisiehistorie is.
  const laatsteRevisie = bundel.recipe_revisies[0];
  const versienummer = laatsteRevisie
    ? `${laatsteRevisie.versie_major}.${laatsteRevisie.versie_minor}`
    : `${bundel.recipes.versie_major ?? 1}.${bundel.recipes.versie_minor ?? 0}`;
  const vestigingsPrefix = vestigingsBron.slice(0, 2);
  const bestandsnaam = `${bundel.batch.batchnummer} ${naam} v${versienummer} ${vestigingsPrefix}.xlsx`;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, bestandsnaam);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Klaar: ${outputPath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fout tijdens genereren:', err.message);
    process.exit(1);
  });
}

// Dikke scheidingslijn onder de laatste rij van elke groep met hetzelfde
// toevoegmoment (bv. alle 45-min hopgiften bij elkaar, dan een dikke lijn,
// dan alle 0-min hopgiften). Werkt op de al gesorteerde (gegroepeerde) rijen.
const DIKKE_RAND = { style: 'medium', color: { argb: 'FF000000' } };
function zetHopGroepRanden(workbook, bundel) {
  const ws = workbook.getWorksheet('Recept-voorblad');

  function randenVoorBlok(rijen, startRij, kolomVan, kolomTot) {
    for (let i = 0; i < rijen.length; i++) {
      const huidige = rijen[i];
      const volgende = rijen[i + 1];
      const laatsteVanGroep = !volgende || volgende.tijdstip !== huidige.tijdstip;
      if (!laatsteVanGroep) continue;
      const rijNr = startRij + i;
      for (let col = kolomVan; col <= kolomTot; col++) {
        const cel = ws.getCell(rijNr, col);
        cel.border = { ...cel.border, bottom: DIKKE_RAND };
      }
    }
  }

  const hopRijen = sorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'hopgift_kook'), 'hopgift_kook');
  const dryHopRijen = sorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'dry_hop'), 'dry_hop');

  // Kolom A t/m Q dekt de hele "Hops and Herbs"-tabelbreedte (Soort t/m HDT)
  randenVoorBlok(hopRijen, 43, 1, 17);
  randenVoorBlok(dryHopRijen, 58, 1, 17);
}

module.exports = {
  bepaalHopRendement, bepaalHopEbu, vulScalaireVelden, vulWpKerkVelden, vulReceptnaamKruisVelden,
  vulIngredientRijen, vulRevisies, vulFormaten, vulHopRendementEnEbu, zetHopGroepRanden, haalBatchDataOp,
};
