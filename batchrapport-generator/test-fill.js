const ExcelJS = require('exceljs');
const {
  vulScalaireVelden, vulWpKerkVelden, vulIngredientRijen, vulRevisies,
  vulFormaten, vulHopRendementEnEbu,
} = require('./generate-batchrapport');

async function test() {
  const bundel = {
    recipes: { naam: 'Testbier IPA', bierstijl: 'IPA', locatie: 'Jopen Kerk', brouwsel_hl: 60, status: 'actief' },
    recipe_specificaties: { origineel_extract: 16, origineel_extract_tol: 0.5, alcohol: 6.5, alcohol_tol: 0.3, kleur: 20, kleur_tol: 2, ph: 4.2 },
    recipe_fermentatie: { pitching_temp: 18, main_ferm_temp: 20, bier_risico: 'Standaard', bier_status: 'Standaard' },
    recipe_brouwspecificaties: {
      volume_kook: 62, verwacht_extract_begin_kook: 14, beluchting: 8,
      stort_special_bin_kg: null, maischwater: 120, eindvolume_brouwsel: 60,
      sparging_1e: 30, eerste_afloop: 30, sparging_2e: 15, spoelwater: 15,
      sparging_3e: null, spoel_afloop: null, sparging_4e: null, totaal_gefiltreerd_volume: 60,
      kamers_mashfilter: null, lauterfactor: 1.02, walsenmolen: 'walsenmolen A',
      volume_water_additie_terugkoeling: null,
    },
    recipe_water: { ca: 80, mg: 10, na: 15, cl: 60, so4: 120, ratio_cl_so4: 0.5, alkalinity: 40 },
    recipe_verpakking: { tht_fles_maanden: 6, formaten: ['24x33cl', '20L keykeg'] },
    recipe_processtappen: { comment_verwerken: 'Test processopmerking', dry_hop_comment_warm: 'warm comment test' },
    recipe_comments: { comments: ['Testcomment recept'] },
    recipe_ingredients: [
      { rol: 'hopgift_kook', volgorde: 1, ingredient_id: 1, alpha_pct: 12.8, hoeveelheid: 5000, tijdstip: '45', hdt: 1 },
      { rol: 'hopgift_kook', volgorde: 2, ingredient_id: 2, alpha_pct: 24.5, hoeveelheid: 5000, tijdstip: '0', hdt: null },
      { rol: 'dry_hop', volgorde: 1, ingredient_id: 3, hoeveelheid: 7500, tijdstip: '16c' },
      { rol: 'hoofdmout', volgorde: 1, ingredient_id: 4, hoeveelheid: 800, kleur_ebc: 5 },
      { rol: 'hoofdmout', volgorde: 2, ingredient_id: 5, hoeveelheid: 100, kleur_ebc: 900 },
      { rol: 'gist', volgorde: 1, ingredient_id: 6, hoeveelheid: 2 },
    ],
    recipe_revisies: [
      { versie_major: 2, versie_minor: 0, datum: '2026-01-15', door: 'Jaap', wijziging: 'Major revision test' },
    ],
    ingredientNaam: new Map([
      [1, 'Magnum'], [2, 'Citra CRYO'], [3, 'Cascade'], [4, 'Pilsmout'], [5, 'Chocolate malt'], [6, 'US-05'],
    ]),
    batch: { batchnummer: 99999 },
  };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('./Batchrapport_sjabloon.xlsx');

  vulScalaireVelden(workbook, bundel, false);
  vulWpKerkVelden(workbook, bundel, false);
  vulIngredientRijen(workbook, bundel);
  vulRevisies(workbook, bundel);
  vulFormaten(workbook, bundel);
  vulHopRendementEnEbu(workbook, bundel);
  workbook.getWorksheet('Recept-voorblad').getCell('K3').value = bundel.batch.batchnummer;
  workbook.getWorksheet('Recept-voorblad').getCell('Q1').value = bundel.recipes.naam;

  await workbook.xlsx.writeFile('./output/TEST-batch.xlsx');
  console.log('Testbestand geschreven: ./output/TEST-batch.xlsx');

  // Meteen een paar cellen terug uitlezen ter controle
  const ws = workbook.getWorksheet('Recept-voorblad');
  console.log('C3 (naam bier):', ws.getCell('C3').value);
  console.log('F12 (origineel extract spec):', ws.getCell('F12').value);
  console.log('A43 (hop 1 naam):', ws.getCell('A43').value);
  console.log('D43 (hop 1 alpha):', ws.getCell('D43').value);
  console.log('I43 (hop 1 rendement):', ws.getCell('I43').value);
  console.log('K43 (hop 1 EBU):', ws.getCell('K43').value);
  console.log('K44 (hop 2 EBU, kooktijd 0):', ws.getCell('K44').value);
  console.log('K64 (totale bitterheid):', ws.getCell('K64').value);
  console.log('A30 (mout 1 naam):', ws.getCell('A30').value);
  console.log('D30 (mout 1 kg):', ws.getCell('D30').value);
  console.log('F40 (calculated color bijdrage-som, live formule):', ws.getCell('F40').value);
  console.log('M40 (calculated color, live formule):', ws.getCell('M40').value);
}

test().catch(e => { console.error(e); process.exit(1); });
