/**
 * xlsx-direct.js
 * -----------------------------------------------------------------------
 * Schrijft waarden/formules rechtstreeks in de ruwe sheet-XML van een xlsx-
 * bestand, via JSZip, zonder ExcelJS te gebruiken om het hele werkboek in
 * te laden/op te slaan.
 *
 * WAAROM: ExcelJS bleek bij het opslaan meerdere dingen kapot te maken die
 * niets met onze eigen wijzigingen te maken hadden -- rij/cel-mismatches,
 * een verminkte Print Area, een foute sheetPr-elementvolgorde, en (het
 * zwaarste) een complete herbouw/deduplicatie van de stijlentabel (cellXfs
 * ging van 2209 naar 1147 unieke stijlen), waarbij cellen soms de kleur van
 * een "buurstijl" kregen i.p.v. hun eigen kleur. Al deze problemen
 * verdwijnen als we ExcelJS's volledige save-cyclus vermijden en alleen de
 * specifieke cellen aanpassen die we echt moeten invullen, met de rest van
 * het bestand (incl. de hele stijlentabel) volledig ongemoeid.
 *
 * AANNAME (geverifieerd voor dit sjabloon): elke cel die we invullen bestaat
 * al als element in de sheet-XML (leeg, met een stijl -- ooit een formule
 * met "Data!"/"Batch #"!/"EBU Berekening"!-verwijzing die we hebben
 * leeggemaakt). We hoeven dus nooit nieuwe cellen in te voegen, alleen
 * bestaande te vervangen. Als een cel toch ontbreekt, gooit setCelWaarde
 * een duidelijke fout i.p.v. stilzwijgend niets te doen.
 * -----------------------------------------------------------------------
 */

function xmlEscape(tekst) {
  return String(tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, ' ');
}

class XlsxDirectWriter {
  constructor(zip) {
    this.zip = zip;
    this.sheetXmlPerBestand = {}; // 'xl/worksheets/sheet1.xml' -> xml-string (gecached, wordt aan het eind teruggeschreven)
    this.sheetNaarBestand = null; // 'Recept-voorblad' -> 'xl/worksheets/sheet1.xml'
  }

  async init() {
    const workbookXml = await this.zip.file('xl/workbook.xml').async('string');
    const relsXml = await this.zip.file('xl/_rels/workbook.xml.rels').async('string');

    const sheetEntries = [...workbookXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"/g)]
      .map(m => ({ naam: m[1], rId: m[2] }));
    const relMap = {};
    for (const m of relsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
      relMap[m[1]] = m[2];
    }

    this.sheetNaarBestand = {};
    for (const { naam, rId } of sheetEntries) {
      const target = relMap[rId]; // bv. 'worksheets/sheet1.xml'
      if (target) this.sheetNaarBestand[naam] = 'xl/' + target.replace(/^\.?\/?/, '');
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

  /**
   * Vervangt de inhoud van cel `sheetCel` (bv. "Recept-voorblad!F12") door
   * `waarde`, met behoud van de bestaande stijl (`s="..."`-attribuut).
   * - null/undefined -> lege cel (zelfsluitend, stijl blijft staan)
   * - number -> numerieke cel
   * - string -> inlineStr-cel (geen shared-strings-tabel nodig)
   * - { formula: '...' } -> formule-cel (geen cache-waarde, Excel herberekent bij openen)
   */
  async setCelWaarde(sheetCel, waarde) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    let xml = this.sheetXmlPerBestand[bestand];

    const cellPattern = new RegExp(`<c r="${cel}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`);
    const match = xml.match(cellPattern);
    if (!match) {
      throw new Error(`Cel ${sheetCel} bestaat niet in het sjabloon (kan niet invoegen, alleen vervangen)`);
    }
    const attrsRuw = match[1]; // bv. ' s="1222" t="n"'
    const sMatch = attrsRuw.match(/\bs="(\d+)"/);
    const sAttr = sMatch ? ` s="${sMatch[1]}"` : '';

    let nieuweCel;
    if (waarde === null || waarde === undefined || waarde === '') {
      nieuweCel = `<c r="${cel}"${sAttr}/>`;
    } else if (typeof waarde === 'object' && waarde.formula) {
      nieuweCel = `<c r="${cel}"${sAttr}><f>${xmlEscape(waarde.formula)}</f></c>`;
    } else if (typeof waarde === 'number') {
      nieuweCel = `<c r="${cel}"${sAttr}><v>${waarde}</v></c>`;
    } else {
      const num = Number(waarde);
      if (typeof waarde !== 'string' && !Number.isNaN(num)) {
        nieuweCel = `<c r="${cel}"${sAttr}><v>${num}</v></c>`;
      } else if (typeof waarde === 'string' && waarde.trim() !== '' && !Number.isNaN(Number(waarde))) {
        // Postgres 'numeric'-kolommen komen als string terug (bv "0.5") --
        // als echt getal schrijven, anders behandelt Excel het als tekst.
        nieuweCel = `<c r="${cel}"${sAttr}><v>${Number(waarde)}</v></c>`;
      } else {
        nieuweCel = `<c r="${cel}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(waarde)}</t></is></c>`;
      }
    }

    this.sheetXmlPerBestand[bestand] = xml.replace(cellPattern, nieuweCel);
  }

  /** Huidige `s="..."`-waarde van een cel opvragen (voor de border-helper). */
  async haalStijlIndexOp(sheetCel) {
    const [sheetNaam, cel] = sheetCel.split('!');
    const bestand = await this._laadSheetXml(sheetNaam);
    const xml = this.sheetXmlPerBestand[bestand];
    const match = xml.match(new RegExp(`<c r="${cel}"([^>]*?)(?:/>|>)`));
    if (!match) throw new Error(`Cel ${sheetCel} niet gevonden`);
    const sMatch = match[1].match(/\bs="(\d+)"/);
    return sMatch ? Number(sMatch[1]) : 0;
  }

  /** Wijst cel `sheetCel` een ander (bestaand) stijlindex toe. */
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

  /** Schrijft alle gewijzigde sheet-XML terug in de zip en levert de zip. */
  async finalize() {
    for (const [bestand, xml] of Object.entries(this.sheetXmlPerBestand)) {
      this.zip.file(bestand, xml);
    }
    return this.zip;
  }
}

/**
 * Beheert xl/styles.xml rechtstreeks, voor het toevoegen van een dikke
 * onderrand aan een cel zonder de rest van diens stijl (kleur, lettertype,
 * andere randen) aan te raken. Zoekt eerst of een passende stijl al bestaat
 * (dedupliceert zelf, netjes), voegt anders een nieuwe <border>/<xf> toe
 * -- bestaande stijlen/indexen blijven onaangeroerd.
 */
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
    // Splitst een reeks <tag ...>...</tag> of <tag .../> elementen op het top-niveau.
    const elementen = [];
    const re = new RegExp(`<${tagNaam}(?:[^>]*?/>|[^>]*?>[\\s\\S]*?</${tagNaam}>)`, 'g');
    let m;
    while ((m = re.exec(inhoud)) !== null) elementen.push(m[0]);
    return elementen;
  }

  /**
   * Geeft de stijlindex terug voor "dezelfde stijl als sourceStyleIdx, maar
   * met een dikke zwarte onderrand" (overige randen ongewijzigd).
   */
  voegDikkeOnderrandToe(sourceStyleIdx) {
    const cellXfsSectie = this._haalSectie('cellXfs');
    const xfs = this._splitsElementen(cellXfsSectie.inhoud, 'xf');
    const bronXf = xfs[sourceStyleIdx];
    if (!bronXf) throw new Error(`Stijlindex ${sourceStyleIdx} bestaat niet`);
    const borderIdMatch = bronXf.match(/borderId="(\d+)"/);
    const bronBorderId = borderIdMatch ? Number(borderIdMatch[1]) : 0;

    const bordersSectie = this._haalSectie('borders');
    const borders = this._splitsElementen(bordersSectie.inhoud, 'border');
    const bronBorder = borders[bronBorderId] || '<border><left/><right/><top/><bottom/><diagonal/></border>';

    // Nieuwe border: kopieer left/right/top/diagonal, vervang bottom
    const nieuweBorder = bronBorder.replace(
      /<bottom[^>]*\/>|<bottom[^>]*>[\s\S]*?<\/bottom>/,
      '<bottom style="medium"><color rgb="FF000000"/></bottom>'
    ).replace(/^<border[^>]*>/, '<border>'); // eventuele diagonalUp/Down-attributen negeren we hier niet, laten we intact via de originele opening-tag hieronder
    // (bovenstaande vervanging van de opening-tag ongedaan maken als bronBorder attributen had)
    const openTagMatch = bronBorder.match(/^<border([^>]*)>/);
    const finaleNieuweBorder = openTagMatch
      ? nieuweBorder.replace('<border>', `<border${openTagMatch[1]}>`)
      : nieuweBorder;

    let nieuweBorderId = borders.findIndex(b => b === finaleNieuweBorder);
    let bordersGewijzigd = false;
    if (nieuweBorderId === -1) {
      borders.push(finaleNieuweBorder);
      nieuweBorderId = borders.length - 1;
      bordersGewijzigd = true;
    }

    // Nieuwe xf: kopieer bronXf maar met de nieuwe borderId
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
      this.xml = this.xml.replace(
        bordersSectie.volledigeMatch,
        `<borders count="${borders.length}">${nieuweInhoud}</borders>`
      );
    }
    if (xfsGewijzigd) {
      // cellXfsSectie.volledigeMatch is nog gebaseerd op de OUDE xml-string;
      // na een eventuele borders-wijziging is die nog steeds geldig omdat
      // <borders> vóór <cellXfs> staat en de tekst van cellXfs zelf niet
      // is aangeraakt door de vervanging hierboven.
      const nieuweInhoud = xfs.join('');
      this.xml = this.xml.replace(
        cellXfsSectie.volledigeMatch,
        `<cellXfs count="${xfs.length}">${nieuweInhoud}</cellXfs>`
      );
    }

    return nieuweXfIdx;
  }

  finalize() {
    this.zip.file('xl/styles.xml', this.xml);
  }
}

module.exports = { XlsxDirectWriter, xmlEscape, StylesManager };

