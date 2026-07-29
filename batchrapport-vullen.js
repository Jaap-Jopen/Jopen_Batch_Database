// ============================================================================
// batchrapport-vullen.js — client-side batchrapport-generatie (browser)
//
// Zelfde vul-logica als batchrapport-generator/generate-batchrapport.js
// (Node-script, gebruikt voor server-side/handmatige generatie met de
// service_role key), maar dan met:
//   - fetch() i.p.v. Node fs voor het sjabloon + de mapping-JSONs
//   - de al-ingelogde supabaseClient (anon key + RLS) i.p.v. service_role key
//   - ExcelJS' writeBuffer() + een download-link i.p.v. writeFile()
//
// LET OP (onderhoud): de hop-rendement-tabel en bepaalHopRendement/bepaalHopEbu
// staan nu op VIER plekken gedupliceerd (hier, generate-batchrapport.js,
// recept-invoer.html, receptoverzicht.html). Wijzig je de tabel/formule,
// doe dat overal.
//
// Vereist op de pagina:
//   <script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>
//   <script src="batchrapport-vullen.js"></script>
// (na config.js, zodat supabaseClient al bestaat)
// ============================================================================

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

const BR_BASISPAD = 'batchrapport-generator/';

async function brFetchJson(pad) {
  const res = await fetch(BR_BASISPAD + pad);
  if (!res.ok) throw new Error(`Kon ${pad} niet ophalen (${res.status})`);
  return res.json();
}

async function haalBatchDataOpBrowser(supabase, batchnummer) {
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

// Zie generate-batchrapport.js voor uitleg: Postgres 'numeric'-kolommen komen
// via PostgREST als string terug (bv "0.5"), en moeten als echt getal in de
// cel komen, anders behandelt Excel het als tekst en breken formules erop.
function brNaarGetalIndienMogelijk(waarde) {
  if (typeof waarde === 'string' && waarde.trim() !== '' && !Number.isNaN(Number(waarde))) {
    return Number(waarde);
  }
  return waarde;
}

function brSchrijfCel(workbook, sheetCel, waarde) {
  const [sheetNaam, cel] = sheetCel.split('!');
  const ws = workbook.getWorksheet(sheetNaam);
  if (!ws) { console.warn(`Onbekend tabblad: ${sheetNaam} (cel ${sheetCel})`); return; }
  ws.getCell(cel).value = (waarde === undefined || waarde === null) ? null : brNaarGetalIndienMogelijk(waarde);
}

function brVulScalaireVelden(workbook, bundel, isWP, scalarMap) {
  for (const veld of scalarMap) {
    if (veld.wp_only && !isWP) continue;
    const [tabel, kolom] = veld.db_veld.split('.');
    const bron = bundel[tabel];
    if (!bron) continue;
    const waarde = bron[kolom];
    for (const loc of veld.locaties) brSchrijfCel(workbook, loc, waarde);
  }
}

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
function brVulWpKerkVelden(workbook, bundel, isWP) {
  const bron = bundel.recipe_brouwspecificaties;
  for (const v of WP_KERK_VELDEN) brSchrijfCel(workbook, v.cel, bron[isWP ? v.wp : v.kerk]);
}

// Zie generate-batchrapport.js voor uitleg: F8/F9/F11 in Brouwen wisselen
// van betekenis per vestiging.
function brVulReceptnaamKruisVelden(workbook, bundel, isWP) {
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
}

// Zelfde sortering als sorteerHopHerbsRegels() in recept-invoer.html.
const DRY_HOP_VOLGORDE = ['warm', '16c', '0c'];
function brSorteerHopgiften(rijen, rol) {
  if (rol === 'hopgift_kook') {
    return [...rijen].sort((a, b) => (parseFloat(b.tijdstip) || -Infinity) - (parseFloat(a.tijdstip) || -Infinity));
  }
  if (rol === 'dry_hop') {
    return [...rijen].sort((a, b) => DRY_HOP_VOLGORDE.indexOf(a.tijdstip) - DRY_HOP_VOLGORDE.indexOf(b.tijdstip));
  }
  return rijen;
}

function brVulIngredientRijen(workbook, bundel, ingredientMap) {
  const rollen = ['hopgift_kook', 'dry_hop', 'hoofdmout', 'toegift_brouwerij', 'toegift_kelder', 'gist'];
  for (const rol of rollen) {
    const cellenPerRij = ingredientMap[rol];
    if (!cellenPerRij) continue;
    const ongesorteerd = bundel.recipe_ingredients.filter(r => r.rol === rol);
    const rijen = (rol === 'hopgift_kook' || rol === 'dry_hop')
      ? brSorteerHopgiften(ongesorteerd, rol)
      : ongesorteerd.sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));

    Object.keys(cellenPerRij).sort((a, b) => Number(a) - Number(b)).forEach((volgordeStr, i) => {
      const regel = rijen[i];
      const cellen = cellenPerRij[volgordeStr];
      if (!regel) { for (const attr in cellen) brSchrijfCel(workbook, cellen[attr], null); return; }
      for (const attr in cellen) {
        const waarde = attr === 'naam'
          ? (bundel.ingredientNaam.get(regel.ingredient_id) || regel.notitie || null)
          : regel[attr];
        brSchrijfCel(workbook, cellen[attr], waarde);
      }
    });
  }
}

// Dikke scheidingslijn onder de laatste rij van elke groep met hetzelfde
// toevoegmoment. Zie generate-batchrapport.js voor uitleg.
const BR_DIKKE_RAND = { style: 'medium', color: { argb: 'FF000000' } };
function brZetHopGroepRanden(workbook, bundel) {
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
        cel.border = { ...cel.border, bottom: BR_DIKKE_RAND };
      }
    }
  }

  const hopRijen = brSorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'hopgift_kook'), 'hopgift_kook');
  const dryHopRijen = brSorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'dry_hop'), 'dry_hop');
  randenVoorBlok(hopRijen, 43, 1, 17);
  randenVoorBlok(dryHopRijen, 58, 1, 17);
}

function brVulRevisies(workbook, bundel, revisieMap) {
  bundel.recipe_revisies.forEach((rv, i) => {
    const cellen = revisieMap[String(i + 1)];
    if (!cellen) return;
    if (cellen.versienummer) brSchrijfCel(workbook, cellen.versienummer, `${rv.versie_major}.${rv.versie_minor}`);
    if (cellen.datum) brSchrijfCel(workbook, cellen.datum, rv.datum);
    if (cellen.door) brSchrijfCel(workbook, cellen.door, rv.door);
    if (cellen.wijziging) brSchrijfCel(workbook, cellen.wijziging, rv.wijziging);
  });
}

function brVulFormaten(workbook, bundel, formatenMap) {
  const gekozen = new Set(bundel.recipe_verpakking.formaten || []);
  for (const [naam, cel] of Object.entries(formatenMap)) {
    brSchrijfCel(workbook, cel, gekozen.has(naam) ? 'X' : null);
  }
}

function brVulHopRendementEnEbu(workbook, bundel) {
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

/**
 * Genereert het batchrapport voor het gegeven batchnummer en start meteen
 * een download in de browser. Gooit een Error met een begrijpelijke boodschap
 * als er iets misgaat (te tonen aan de gebruiker).
 */
async function genereerEnDownloadBatchrapport(supabase, batchnummer) {
  const [scalarMap, ingredientMap, revisieMap, formatenMap, templateBuffer] = await Promise.all([
    brFetchJson('data/scalar_field_map.json'),
    brFetchJson('data/ingredient_field_map.json'),
    brFetchJson('data/revisie_field_map.json'),
    brFetchJson('data/formaten_field_map.json'),
    fetch(BR_BASISPAD + 'Batchrapport_sjabloon.xlsx').then(r => {
      if (!r.ok) throw new Error(`Kon sjabloon niet ophalen (${r.status})`);
      return r.arrayBuffer();
    }),
  ]);

  const bundel = await haalBatchDataOpBrowser(supabase, batchnummer);

  const naam = bundel.recipes.naam || '';
  const locatie = (bundel.recipes.locatie || '').toLowerCase();
  // Zie generate-batchrapport.js voor uitleg: WP/Kerk-detectie via short_name,
  // niet naam -- en Q1 krijgt dezelfde waarde (voedt Brouwen!A1).
  const vestigingsBron = bundel.recipes.short_name || naam;
  const isWP = locatie.includes('waarderpolder') || vestigingsBron.toUpperCase().startsWith('WP');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  brVulScalaireVelden(workbook, bundel, isWP, scalarMap);
  brVulWpKerkVelden(workbook, bundel, isWP);
  brVulReceptnaamKruisVelden(workbook, bundel, isWP);
  brVulIngredientRijen(workbook, bundel, ingredientMap);
  brVulRevisies(workbook, bundel, revisieMap);
  brVulFormaten(workbook, bundel, formatenMap);
  brVulHopRendementEnEbu(workbook, bundel);
  brZetHopGroepRanden(workbook, bundel);

  workbook.getWorksheet('Recept-voorblad').getCell('K3').value = bundel.batch.batchnummer;
  workbook.getWorksheet('Recept-voorblad').getCell('Q1').value = vestigingsBron;

  // Bestandsnaam volgens de oorspronkelijke VBA-macro:
  //   K3 & " " & C3 & " v" & A101 & " " & Left(Q1,2) & ".xlsx"
  const laatsteRevisie = bundel.recipe_revisies[0];
  const versienummer = laatsteRevisie
    ? `${laatsteRevisie.versie_major}.${laatsteRevisie.versie_minor}`
    : `${bundel.recipes.versie_major ?? 1}.${bundel.recipes.versie_minor ?? 0}`;
  const vestigingsPrefix = vestigingsBron.slice(0, 2);
  const bestandsnaam = `${bundel.batch.batchnummer} ${naam} v${versienummer} ${vestigingsPrefix}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
