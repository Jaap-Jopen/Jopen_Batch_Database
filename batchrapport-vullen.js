// ============================================================================
// batchrapport-vullen.js — client-side batchrapport-generatie (browser)
//
// Schrijft rechtstreeks in de ruwe sheet-XML (via JSZip), i.p.v. via ExcelJS'
// volledige load/save-cyclus. ExcelJS bleek zelf meerdere dingen te breken
// die niets met onze eigen wijzigingen te maken hadden: rij/cel-mismatches,
// een verminkte Print Area, een foute sheetPr-elementvolgorde, en een
// herbouwde/gedupliceerde stijlentabel. Door alleen de specifieke cellen te
// vervangen die we moeten invullen (altijd cellen die al bestaan in het
// sjabloon, nooit invoegen) en de rest van het bestand -- incl. de hele
// stijlentabel -- ongemoeid te laten, kunnen die problemen niet meer
// optreden. Zie generate-batchrapport.js (Node-versie) voor dezelfde aanpak.
//
// Vereist op de pagina:
//   <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
//   <script src="batchrapport-vullen.js"></script>
// (JSZip global moet dus al bestaan; ExcelJS is hier niet meer nodig)
//
// LET OP (onderhoud): de hop-rendement-tabel en bepaalHopRendement/bepaalHopEbu
// staan op MEERDERE plekken gedupliceerd (hier, generate-batchrapport.js,
// recept-invoer.html, receptoverzicht.html). Wijzig je de tabel/formule,
// doe dat overal.
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

// ---------------------------------------------------------------------------
// Directe XML-schrijver (zie xlsx-direct.js voor de uitgebreide toelichting)
// ---------------------------------------------------------------------------
function xmlEscape(tekst) {
  return String(tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, ' ');
}
function kolomLetterNaarNummer(letters) {
  let num = 0;
  for (const ch of letters) num = num * 26 + (ch.charCodeAt(0) - 64);
  return num;
}
function ontleedCelRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return { col: kolomLetterNaarNummer(m[1]), row: Number(m[2]) };
}

class XlsxDirectWriter {
  constructor(zip) {
    this.zip = zip;
    this.sheetXmlPerBestand = {};
    this.sheetNaarBestand = null;
    this._mergesPerBestand = {};
  }

  /**
   * Als `sheetCel` een niet-ankercel is binnen een samengevoegd bereik, geeft
   * dit de ankercel (linksboven) terug. Anders gewoon de cel zelf. Zie
   * xlsx-direct.js voor de uitgebreide toelichting.
   */
  async haalMergeAnker(sheetCel) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    if (!this._mergesPerBestand[bestand]) {
      const xml = this.sheetXmlPerBestand[bestand];
      const merges = [];
      const m = xml.match(/<mergeCells count="\d+">([\s\S]*?)<\/mergeCells>/);
      if (m) {
        for (const refMatch of m[1].matchAll(/ref="([^"]+)"/g)) {
          const [a, b] = refMatch[1].split(':');
          const p1 = ontleedCelRef(a);
          const p2 = b ? ontleedCelRef(b) : p1;
          merges.push({ c1: Math.min(p1.col, p2.col), r1: Math.min(p1.row, p2.row), c2: Math.max(p1.col, p2.col), r2: Math.max(p1.row, p2.row) });
        }
      }
      this._mergesPerBestand[bestand] = merges;
    }
    const { col, row } = ontleedCelRef(cel);
    for (const mr of this._mergesPerBestand[bestand]) {
      if (col >= mr.c1 && col <= mr.c2 && row >= mr.r1 && row <= mr.r2) {
        if (col === mr.c1 && row === mr.r1) return sheetCel;
        return `${sheetNaam}!${kolomNummerNaarLetter(mr.c1)}${mr.r1}`;
      }
    }
    return sheetCel;
  }

  async init() {
    const workbookXml = await this.zip.file('xl/workbook.xml').async('string');
    const relsXml = await this.zip.file('xl/_rels/workbook.xml.rels').async('string');

    const sheetEntries = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)]
      .map(m => {
        const attrs = m[1];
        const naam = attrs.match(/name="([^"]+)"/);
        const rId = attrs.match(/r:id="(rId\d+)"/);
        return naam && rId ? { naam: naam[1], rId: rId[1] } : null;
      })
      .filter(Boolean);
    const relMap = {};
    for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const attrs = m[1];
      const id = attrs.match(/Id="(rId\d+)"/);
      const target = attrs.match(/Target="([^"]+)"/);
      if (id && target) relMap[id[1]] = target[1];
    }

    this.sheetNaarBestand = {};
    for (const { naam, rId } of sheetEntries) {
      const target = relMap[rId];
      if (target) {
        this.sheetNaarBestand[naam] = target.startsWith('/')
          ? target.slice(1)
          : 'xl/' + target;
      }
    }
  }

  async _laadSheetXml(sheetNaam) {
    const bestand = this.sheetNaarBestand[sheetNaam];
    if (!bestand) throw new Error(`Onbekend tabblad: ${sheetNaam}`);
    if (!this.sheetXmlPerBestand[bestand]) {
      this.sheetXmlPerBestand[bestand] = await this.zip.file(bestand).async('string');
    }
    return bestand;
  }

  async setCelWaarde(sheetCel, waarde) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    let xml = this.sheetXmlPerBestand[bestand];

    const cellPattern = new RegExp(`<c r="${cel}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`);
    const match = xml.match(cellPattern);
    if (!match) {
      throw new Error(`Cel ${sheetCel} bestaat niet in het sjabloon (kan niet invoegen, alleen vervangen)`);
    }
    const attrsRuw = match[1];
    const sMatch = attrsRuw.match(/\bs="(\d+)"/);
    const sAttr = sMatch ? ` s="${sMatch[1]}"` : '';

    let nieuweCel;
    if (waarde === null || waarde === undefined || waarde === '') {
      nieuweCel = `<c r="${cel}"${sAttr}/>`;
    } else if (typeof waarde === 'object' && waarde.formula) {
      nieuweCel = `<c r="${cel}"${sAttr}><f>${xmlEscape(waarde.formula)}</f></c>`;
    } else if (typeof waarde === 'number') {
      nieuweCel = `<c r="${cel}"${sAttr}><v>${waarde}</v></c>`;
    } else if (typeof waarde === 'string' && waarde.trim() !== '' && !Number.isNaN(Number(waarde))) {
      // Postgres 'numeric'-kolommen komen als string terug (bv "0.5") --
      // als echt getal schrijven, anders behandelt Excel het als tekst.
      nieuweCel = `<c r="${cel}"${sAttr}><v>${Number(waarde)}</v></c>`;
    } else {
      nieuweCel = `<c r="${cel}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(waarde)}</t></is></c>`;
    }

    this.sheetXmlPerBestand[bestand] = xml.replace(cellPattern, nieuweCel);
  }

  async haalStijlIndexOp(sheetCel) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    const xml = this.sheetXmlPerBestand[bestand];
    const match = xml.match(new RegExp(`<c r="${cel}"([^>]*?)(?:/>|>)`));
    if (!match) throw new Error(`Cel ${sheetCel} niet gevonden`);
    const sMatch = match[1].match(/\bs="(\d+)"/);
    return sMatch ? Number(sMatch[1]) : 0;
  }

  async zetStijlIndex(sheetCel, nieuweIndex) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    let xml = this.sheetXmlPerBestand[bestand];
    const cellPattern = new RegExp(`<c r="${cel}"([^>]*?)(/>|>([\\s\\S]*?)</c>)`);
    const match = xml.match(cellPattern);
    if (!match) throw new Error(`Cel ${sheetCel} niet gevonden`);
    let attrs = match[1];
    if (/\bs="\d+"/.test(attrs)) attrs = attrs.replace(/\bs="\d+"/, `s="${nieuweIndex}"`);
    else attrs = ` s="${nieuweIndex}"` + attrs;
    this.sheetXmlPerBestand[bestand] = xml.replace(cellPattern, `<c r="${cel}"${attrs}${match[2]}`);
  }

  async celBestaat(sheetCel) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    const xml = this.sheetXmlPerBestand[bestand];
    return new RegExp(`<c r="${cel}"[^>]*(?:/>|>)`).test(xml);
  }

  async zetOfMaakCelStijl(sheetCel, stijlIdx) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    if (await this.celBestaat(sheetCel)) {
      await this.zetStijlIndex(sheetCel, stijlIdx);
      return;
    }
    let xml = this.sheetXmlPerBestand[bestand];
    const { col, row } = ontleedCelRef(cel);
    const rowPattern = new RegExp(`(<row [^>]*r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`);
    const rowMatch = xml.match(rowPattern);
    if (!rowMatch) throw new Error(`Rij ${row} bestaat niet in ${sheetNaam}`);
    const inhoud = rowMatch[2];
    const nieuweCel = `<c r="${cel}" s="${stijlIdx}"/>`;
    let invoegPositie = inhoud.length;
    for (const m of inhoud.matchAll(/<c r="([A-Z]+)(\d+)"/g)) {
      if (kolomLetterNaarNummer(m[1]) > col) { invoegPositie = m.index; break; }
    }
    const nieuweInhoud = inhoud.slice(0, invoegPositie) + nieuweCel + inhoud.slice(invoegPositie);
    this.sheetXmlPerBestand[bestand] = xml.replace(rowPattern, `$1${nieuweInhoud}$3`);
  }

  async finalize() {
    for (const [bestand, xml] of Object.entries(this.sheetXmlPerBestand)) {
      this.zip.file(bestand, xml);
    }
    return this.zip;
  }
}

class StylesManager {
  constructor(zip) {
    this.zip = zip;
    this.xml = null;
  }

  async init() {
    this.xml = await this.zip.file('xl/styles.xml').async('string');
  }

  _haalSectie(naam) {
    const m = this.xml.match(new RegExp(`<${naam} count="(\\d+)">([\\s\\S]*?)</${naam}>`));
    if (!m) return null;
    return { count: Number(m[1]), inhoud: m[2], volledigeMatch: m[0] };
  }

  _splitsElementen(inhoud, tagNaam) {
    const elementen = [];
    const re = new RegExp(`<${tagNaam}(?:[^>]*?/>|[^>]*?>[\\s\\S]*?</${tagNaam}>)`, 'g');
    let m;
    while ((m = re.exec(inhoud)) !== null) elementen.push(m[0]);
    return elementen;
  }

  wisBovenrand(sourceStyleIdx) {
    const cellXfsSectie = this._haalSectie('cellXfs');
    const xfs = this._splitsElementen(cellXfsSectie.inhoud, 'xf');
    const bronXf = xfs[sourceStyleIdx];
    if (!bronXf) throw new Error(`Stijlindex ${sourceStyleIdx} bestaat niet`);
    const borderIdMatch = bronXf.match(/borderId="(\d+)"/);
    const bronBorderId = borderIdMatch ? Number(borderIdMatch[1]) : 0;

    const bordersSectie = this._haalSectie('borders');
    const borders = this._splitsElementen(bordersSectie.inhoud, 'border');
    const bronBorder = borders[bronBorderId] || '<border><left/><right/><top/><bottom/><diagonal/></border>';

    const nieuweBorderRuw = bronBorder.replace(
      /<top[^>]*\/>|<top[^>]*>[\s\S]*?<\/top>/,
      '<top/>'
    ).replace(/^<border[^>]*>/, '<border>');
    const openTagMatch = bronBorder.match(/^<border([^>]*)>/);
    const nieuweBorder = openTagMatch
      ? nieuweBorderRuw.replace('<border>', `<border${openTagMatch[1]}>`)
      : nieuweBorderRuw;

    let nieuweBorderId = borders.findIndex(b => b === nieuweBorder);
    let bordersGewijzigd = false;
    if (nieuweBorderId === -1) {
      borders.push(nieuweBorder);
      nieuweBorderId = borders.length - 1;
      bordersGewijzigd = true;
    }

    const nieuweXf = bronXf.replace(/borderId="\d+"/, `borderId="${nieuweBorderId}"`);
    let nieuweXfIdx = xfs.findIndex(x => x === nieuweXf);
    let xfsGewijzigd = false;
    if (nieuweXfIdx === -1) {
      xfs.push(nieuweXf);
      nieuweXfIdx = xfs.length - 1;
      xfsGewijzigd = true;
    }

    if (bordersGewijzigd) {
      const nieuweInhoud = borders.join('');
      this.xml = this.xml.replace(bordersSectie.volledigeMatch, `<borders count="${borders.length}">${nieuweInhoud}</borders>`);
    }
    if (xfsGewijzigd) {
      const nieuweInhoud = xfs.join('');
      this.xml = this.xml.replace(cellXfsSectie.volledigeMatch, `<cellXfs count="${xfs.length}">${nieuweInhoud}</cellXfs>`);
    }
    return nieuweXfIdx;
  }

  voegOnderrandToe(sourceStyleIdx, stijl = 'medium') {
    const cellXfsSectie = this._haalSectie('cellXfs');
    const xfs = this._splitsElementen(cellXfsSectie.inhoud, 'xf');
    const bronXf = xfs[sourceStyleIdx];
    if (!bronXf) throw new Error(`Stijlindex ${sourceStyleIdx} bestaat niet`);
    const borderIdMatch = bronXf.match(/borderId="(\d+)"/);
    const bronBorderId = borderIdMatch ? Number(borderIdMatch[1]) : 0;

    const bordersSectie = this._haalSectie('borders');
    const borders = this._splitsElementen(bordersSectie.inhoud, 'border');
    const bronBorder = borders[bronBorderId] || '<border><left/><right/><top/><bottom/><diagonal/></border>';

    const nieuweBorderRuw = bronBorder.replace(
      /<bottom[^>]*\/>|<bottom[^>]*>[\s\S]*?<\/bottom>/,
      `<bottom style="${stijl}"><color rgb="FF000000"/></bottom>`
    ).replace(/^<border[^>]*>/, '<border>');
    const openTagMatch = bronBorder.match(/^<border([^>]*)>/);
    const nieuweBorder = openTagMatch
      ? nieuweBorderRuw.replace('<border>', `<border${openTagMatch[1]}>`)
      : nieuweBorderRuw;

    let nieuweBorderId = borders.findIndex(b => b === nieuweBorder);
    let bordersGewijzigd = false;
    if (nieuweBorderId === -1) {
      borders.push(nieuweBorder);
      nieuweBorderId = borders.length - 1;
      bordersGewijzigd = true;
    }

    const nieuweXf = bronXf.replace(/borderId="\d+"/, `borderId="${nieuweBorderId}"`);
    let nieuweXfIdx = xfs.findIndex(x => x === nieuweXf);
    let xfsGewijzigd = false;
    if (nieuweXfIdx === -1) {
      xfs.push(nieuweXf);
      nieuweXfIdx = xfs.length - 1;
      xfsGewijzigd = true;
    }

    if (bordersGewijzigd) {
      this.xml = this.xml.replace(
        bordersSectie.volledigeMatch,
        `<borders count="${borders.length}">${borders.join('')}</borders>`
      );
    }
    if (xfsGewijzigd) {
      this.xml = this.xml.replace(
        cellXfsSectie.volledigeMatch,
        `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
      );
    }

    return nieuweXfIdx;
  }

  finalize() {
    this.zip.file('xl/styles.xml', this.xml);
  }
}

// ---------------------------------------------------------------------------
// Sjabloon vullen
// ---------------------------------------------------------------------------
const BR_BASISPAD = 'batchrapport-generator/';

async function brFetchJson(pad) {
  const res = await fetch(BR_BASISPAD + pad, { cache: 'no-store' });
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

async function brVulScalaireVelden(writer, bundel, isWP, scalarMap) {
  for (const veld of scalarMap) {
    if (veld.wp_only && !isWP) continue;
    const [tabel, kolom] = veld.db_veld.split('.');
    const bron = bundel[tabel];
    if (!bron) continue;
    const waarde = bron[kolom];
    for (const loc of veld.locaties) await writer.setCelWaarde(loc, waarde);
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
async function brVulWpKerkVelden(writer, bundel, isWP) {
  const bron = bundel.recipe_brouwspecificaties;
  for (const v of WP_KERK_VELDEN) await writer.setCelWaarde(v.cel, bron[isWP ? v.wp : v.kerk]);
}

async function brVulReceptnaamKruisVelden(writer, bundel, isWP) {
  const bron = bundel.recipe_brouwspecificaties;
  if (isWP) {
    await writer.setCelWaarde('Brouwen!F8', { formula: "'Recept-voorblad'!G7*Brouwen!F19" });
    await writer.setCelWaarde('Brouwen!F9', bron.recept_naam_software ?? null);
  } else {
    await writer.setCelWaarde('Brouwen!F8', bron.recept_naam_software ?? null);
    await writer.setCelWaarde('Brouwen!F9', bron.naam_special_bin ?? null);
  }
  await writer.setCelWaarde('Brouwen!F11', bron.naam_special_bin ?? null);

  const origineelExtract = bundel.recipe_specificaties.origineel_extract;
  const stamwortCorrectie = bron.stamwort_correctie_brouwhuis;
  if (origineelExtract !== null && origineelExtract !== undefined) {
    await writer.setCelWaarde('Brouwen!N8', Number(origineelExtract) + (stamwortCorrectie ? Number(stamwortCorrectie) : 0));
  }
}

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

async function brVulIngredientRijen(writer, bundel, ingredientMap) {
  const rollen = ['hopgift_kook', 'dry_hop', 'hoofdmout', 'toegift_brouwerij', 'toegift_kelder', 'gist'];
  for (const rol of rollen) {
    const cellenPerRij = ingredientMap[rol];
    if (!cellenPerRij) continue;
    const ongesorteerd = bundel.recipe_ingredients.filter(r => r.rol === rol);
    const rijen = (rol === 'hopgift_kook' || rol === 'dry_hop')
      ? sorteerHopgiften(ongesorteerd, rol)
      : ongesorteerd.sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));

    const slots = Object.keys(cellenPerRij).sort((a, b) => Number(a) - Number(b));
    for (let i = 0; i < slots.length; i++) {
      const regel = rijen[i];
      const cellen = cellenPerRij[slots[i]];
      if (!regel) {
        for (const attr in cellen) await writer.setCelWaarde(cellen[attr], null);
        continue;
      }
      for (const attr in cellen) {
        const waarde = attr === 'naam'
          ? (bundel.ingredientNaam.get(regel.ingredient_id) || regel.notitie || null)
          : regel[attr];
        await writer.setCelWaarde(cellen[attr], waarde);
      }
    }
  }
}

async function brVulRevisies(writer, bundel, revisieMap) {
  for (let i = 0; i < bundel.recipe_revisies.length; i++) {
    const rv = bundel.recipe_revisies[i];
    const cellen = revisieMap[String(i + 1)];
    if (!cellen) continue;
    if (cellen.versienummer) await writer.setCelWaarde(cellen.versienummer, `${rv.versie_major}.${rv.versie_minor}`);
    if (cellen.datum) await writer.setCelWaarde(cellen.datum, rv.datum);
    if (cellen.door) await writer.setCelWaarde(cellen.door, rv.door);
    if (cellen.wijziging) await writer.setCelWaarde(cellen.wijziging, rv.wijziging);
  }
}

async function brVulFormaten(writer, bundel, formatenMap) {
  const gekozen = new Set(bundel.recipe_verpakking.formaten || []);
  for (const [naam, cel] of Object.entries(formatenMap)) {
    await writer.setCelWaarde(cel, gekozen.has(naam) ? 'X' : null);
  }
}

async function brVulHopRendementEnEbu(writer, bundel) {
  const og = bundel.recipe_specificaties.origineel_extract;
  const volumeKook = bundel.recipe_brouwspecificaties.volume_kook;
  const hopRijen = sorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'hopgift_kook'), 'hopgift_kook');

  let totaalEbu = 0;
  for (let i = 0; i < 15; i++) {
    const rij = 43 + i;
    const regel = hopRijen[i];
    if (!regel) {
      await writer.setCelWaarde(`Recept-voorblad!I${rij}`, null);
      await writer.setCelWaarde(`Recept-voorblad!K${rij}`, null);
      continue;
    }
    const kooktijd = regel.tijdstip !== null && regel.tijdstip !== undefined && regel.tijdstip !== ''
      ? Number(regel.tijdstip) : null;
    const rendement = (kooktijd !== null && og) ? bepaalHopRendement(kooktijd, og) : null;
    const ebu = (kooktijd !== null && og) ? bepaalHopEbu(regel.hoeveelheid, regel.alpha_pct, kooktijd, og, volumeKook) : null;

    await writer.setCelWaarde(`Recept-voorblad!I${rij}`, rendement !== null ? Number(rendement.toFixed(1)) : null);
    await writer.setCelWaarde(`Recept-voorblad!K${rij}`, ebu !== null ? Number(ebu.toFixed(1)) : null);
    if (ebu !== null) totaalEbu += ebu;
  }
  await writer.setCelWaarde('Recept-voorblad!K64', Number(totaalEbu.toFixed(1)));
}

function kolomNummerNaarLetter(num) {
  let letters = '';
  while (num > 0) {
    const rest = (num - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    num = Math.floor((num - 1) / 26);
  }
  return letters;
}

async function brZetHopGroepRanden(writer, stylesManager, bundel) {
  async function zetRandOpRij(rijNr, kolomVan, kolomTot, stijl) {
    for (let col = kolomVan; col <= kolomTot; col++) {
      const sheetCel = `Recept-voorblad!${kolomNummerNaarLetter(col)}${rijNr}`;
      try {
        let basisStijl;
        if (await writer.celBestaat(sheetCel)) {
          basisStijl = await writer.haalStijlIndexOp(sheetCel);
        } else {
          const anker = await writer.haalMergeAnker(sheetCel);
          basisStijl = await writer.haalStijlIndexOp(anker);
        }
        if (rijNr !== 43) {
          basisStijl = stylesManager.wisBovenrand(basisStijl);
        }
        const nieuweStijl = stylesManager.voegOnderrandToe(basisStijl, stijl);
        await writer.zetOfMaakCelStijl(sheetCel, nieuweStijl);
      } catch (e) {
        // onbekende/niet-bestaande cel of rij -- overslaan
      }
    }
  }

  for (let rij = 43; rij <= 63; rij++) {
    await zetRandOpRij(rij, 1, 16, 'dotted');
  }

  async function dikkeRandenVoorBlok(rijen, startRij) {
    for (let i = 0; i < rijen.length; i++) {
      const huidige = rijen[i];
      const volgende = rijen[i + 1];
      const laatsteVanGroep = !volgende || volgende.tijdstip !== huidige.tijdstip;
      if (!laatsteVanGroep) continue;
      await zetRandOpRij(startRij + i, 1, 16, 'medium');
    }
  }
  const hopRijen = sorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'hopgift_kook'), 'hopgift_kook');
  const dryHopRijen = sorteerHopgiften(bundel.recipe_ingredients.filter(r => r.rol === 'dry_hop'), 'dry_hop');
  await dikkeRandenVoorBlok(hopRijen, 43);
  await dikkeRandenVoorBlok(dryHopRijen, 58);
}

/**
 * Genereert het batchrapport voor het gegeven batchnummer en start meteen
 * een download in de browser.
 */
async function genereerEnDownloadBatchrapport(supabase, batchnummer) {
  const [scalarMap, ingredientMap, revisieMap, formatenMap, templateBuffer] = await Promise.all([
    brFetchJson('data/scalar_field_map.json'),
    brFetchJson('data/ingredient_field_map.json'),
    brFetchJson('data/revisie_field_map.json'),
    brFetchJson('data/formaten_field_map.json'),
    fetch(BR_BASISPAD + 'Batchrapport_sjabloon.xlsx', { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`Kon sjabloon niet ophalen (${r.status})`);
      return r.arrayBuffer();
    }),
  ]);

  const bundel = await haalBatchDataOpBrowser(supabase, batchnummer);

  const naam = bundel.recipes.naam || '';
  const locatie = (bundel.recipes.locatie || '').toLowerCase();
  const vestigingsBron = bundel.recipes.short_name || naam;
  const isWP = locatie.includes('waarderpolder') || vestigingsBron.toUpperCase().startsWith('WP');

  const zip = await JSZip.loadAsync(templateBuffer);
  const writer = new XlsxDirectWriter(zip);
  await writer.init();
  const stylesManager = new StylesManager(zip);
  await stylesManager.init();

  await brVulScalaireVelden(writer, bundel, isWP, scalarMap);
  await brVulWpKerkVelden(writer, bundel, isWP);
  await brVulReceptnaamKruisVelden(writer, bundel, isWP);
  await brVulIngredientRijen(writer, bundel, ingredientMap);
  await brVulRevisies(writer, bundel, revisieMap);
  await brVulFormaten(writer, bundel, formatenMap);
  await brVulHopRendementEnEbu(writer, bundel);
  await brZetHopGroepRanden(writer, stylesManager, bundel);

  await writer.setCelWaarde('Recept-voorblad!K3', bundel.batch.batchnummer);
  await writer.setCelWaarde('Recept-voorblad!Q1', vestigingsBron);

  stylesManager.finalize();
  await writer.finalize();
  const blob = await zip.generateAsync({ type: 'blob' });

  const laatsteRevisie = bundel.recipe_revisies[0];
  const versienummer = laatsteRevisie
    ? `${laatsteRevisie.versie_major}.${laatsteRevisie.versie_minor}`
    : `${bundel.recipes.versie_major ?? 1}.${bundel.recipes.versie_minor ?? 0}`;
  const vestigingsPrefix = vestigingsBron.slice(0, 2);
  const bestandsnaam = `${bundel.batch.batchnummer} ${naam} v${versienummer} ${vestigingsPrefix}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
