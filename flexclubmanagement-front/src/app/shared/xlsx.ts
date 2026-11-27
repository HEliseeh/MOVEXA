/**
 * Lecture minimale d'un fichier Excel .xlsx (première feuille) sans bibliothèque :
 * un .xlsx est une archive zip de fichiers XML, que le navigateur sait décompresser
 * (DecompressionStream « deflate-raw »). Renvoie les lignes comme du texte, comme un CSV.
 *
 * Limites voulues : première feuille seulement, pas de formules recalculées (on lit la
 * dernière valeur enregistrée par Excel), pas d'ancien format .xls.
 */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readEntries(buf: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buf);
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Fichier Excel illisible.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.push({ name, method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readText(buf: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buf);
  const nameLen = view.getUint16(entry.localOffset + 26, true);
  const extraLen = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error('Compression non prise en charge.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/** « C12 » → index de colonne 2 (A = 0) */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Numéro de série Excel (jours depuis 1899-12-30) → JJ/MM/AAAA */
export function excelSerialToDate(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Formats de nombre Excel qui sont des dates (numéros intégrés 14 à 22, ou format personnalisé avec j/m/a) */
function dateStyles(stylesXml: string | null): Set<number> {
  const result = new Set<number>();
  if (!stylesXml) return result;
  const doc = new DOMParser().parseFromString(stylesXml, 'application/xml');
  const custom = new Map<number, string>();
  for (const f of Array.from(doc.getElementsByTagName('numFmt'))) {
    custom.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '');
  }
  const xfs = doc.getElementsByTagName('cellXfs')[0];
  if (!xfs) return result;
  Array.from(xfs.getElementsByTagName('xf')).forEach((xf, i) => {
    const id = Number(xf.getAttribute('numFmtId'));
    const code = custom.get(id) ?? '';
    if ((id >= 14 && id <= 22) || /[dy]/i.test(code.replace(/"[^"]*"/g, ''))) result.add(i);
  });
  return result;
}

export async function readXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const entries = readEntries(buf);
  const find = (name: string) => entries.find(e => e.name === name);
  const sheetEntry = find('xl/worksheets/sheet1.xml') ?? entries.find(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sheetEntry) throw new Error('Aucune feuille trouvée dans ce fichier Excel.');

  const shared: string[] = [];
  const sharedEntry = find('xl/sharedStrings.xml');
  if (sharedEntry) {
    const doc = new DOMParser().parseFromString(await readText(buf, sharedEntry), 'application/xml');
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent ?? '').join(''));
    }
  }
  const stylesEntry = find('xl/styles.xml');
  const dates = dateStyles(stylesEntry ? await readText(buf, stylesEntry) : null);

  const sheet = new DOMParser().parseFromString(await readText(buf, sheetEntry), 'application/xml');
  const rows: string[][] = [];
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const values: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const col = columnIndex(c.getAttribute('r') ?? 'A1');
      const type = c.getAttribute('t');
      const raw = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map(t => t.textContent ?? '').join('');
      else if (type === 'b') value = raw === '1' ? 'VRAI' : 'FAUX';
      else if (raw && dates.has(Number(c.getAttribute('s') ?? -1))) value = excelSerialToDate(Number(raw));
      else value = raw;
      while (values.length < col) values.push('');
      values[col] = value.trim();
    }
    if (values.some(v => v)) rows.push(values);
  }
  // Toutes les lignes à la même largeur que l'en-tête
  const width = Math.max(0, ...rows.map(r => r.length));
  return rows.map(r => [...r, ...Array(width - r.length).fill('')]);
}
