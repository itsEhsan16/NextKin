import { isSourceUrl, type KbImportResult, type TechnologyInput } from '../models/adminContent';

/**
 * Reading a KB import file on the mock (Figma 409:1872 "Import CSV / JSON", P12-04): CSV with a
 * header row, or a JSON array of objects with the same keys. Every problem is reported against its
 * row; a value of the wrong type is a row problem too, never a crash.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const YEAR = /^\d{4}$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A release date as the KB holds it: a day at noon UTC, or a bare year where only the year is known.
 * Takes "2024", "2024-04-01", a stored stamp, or a board-style "Apr 1, 2024"; `null` otherwise.
 */
export function toIsoDay(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  if (YEAR.test(v) || STAMP.test(v)) return v;
  if (DAY.test(v)) {
    const date = new Date(`${v}T12:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v
      ? null
      : date.toISOString();
  }
  const shown = /^([a-z]{3})[a-z]* (\d{1,2}), (\d{4})$/i.exec(v);
  const month = shown ? MONTHS.indexOf(shown[1]!.toLowerCase()) : -1;
  if (!shown || month < 0) return null;
  return new Date(Date.UTC(Number(shown[3]), month, Number(shown[2]), 12)).toISOString();
}

/** Splits a CSV line on commas outside quotes. */
const csvCells = (line: string) =>
  (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [])
    .map((cell) => cell.replace(/,$/, '').trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
    .slice(0, -1);

type Parsed = { rows: { row: number; input: TechnologyInput }[]; failed: KbImportResult['failed'] };

/** One cell as text: a number is written out, anything else that isn't text is refused. */
function text(row: Record<string, unknown>, key: string): string | { problem: string } {
  const value = row[key];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return { problem: `${key.replace(/_/g, ' ')} isn’t text` };
}

function toInput(row: Record<string, unknown>): TechnologyInput | string {
  const name = text(row, 'name');
  const category = text(row, 'category');
  const version = text(row, 'latest_version');
  const date = text(row, 'release_date');
  const source = text(row, 'source');
  for (const cell of [name, category, version, date, source]) {
    if (typeof cell !== 'string') return cell.problem;
  }
  const raw = row.aliases;
  const aliases = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? raw.split(/[;|]/)
      : raw == null
        ? []
        : null;
  if (!aliases) return 'aliases isn’t text or a list';
  const [n, c, v, d, s] = [name, category, version, date, source] as string[];
  if (!n) return 'missing a name';
  if (d && !(DAY.test(d) || YEAR.test(d))) return 'release date isn’t YYYY-MM-DD';
  const releaseDate = d ? toIsoDay(d) : null;
  if (d && !releaseDate) return 'release date isn’t a real day';
  if (d && !s) return 'a release date needs a cited source';
  if (s && !isSourceUrl(s)) return 'the source isn’t a web address (https://…)';
  return {
    name: n,
    category: c || 'Uncategorised',
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    latestVersion: v || null,
    releaseDate,
    sourceUrl: s || null,
  };
}

export function importRows(file: { format: 'csv' | 'json'; content: string }): Parsed {
  let records: unknown[];
  if (file.format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      return { rows: [], failed: [{ row: 1, reason: 'the file isn’t valid JSON' }] };
    }
    if (!Array.isArray(parsed)) {
      return { rows: [], failed: [{ row: 1, reason: 'the file isn’t a JSON array of rows' }] };
    }
    records = parsed;
  } else {
    const [head, ...lines] = file.content.split(/\r?\n/).filter((l) => l.trim());
    const keys = csvCells(head ?? '').map((k) => k.toLowerCase());
    records = lines.map((line) =>
      Object.fromEntries(csvCells(line).map((v, i) => [keys[i] ?? `col${i}`, v])),
    );
  }
  if (records.length === 0) {
    return { rows: [], failed: [{ row: 1, reason: 'the file has no rows under its header' }] };
  }
  const out: Parsed = { rows: [], failed: [] };
  records.forEach((record, index) => {
    const row = index + 1;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      out.failed.push({ row, reason: 'the row isn’t an object' });
      return;
    }
    const input = toInput(record as Record<string, unknown>);
    if (typeof input === 'string') out.failed.push({ row, reason: input });
    else out.rows.push({ row, input });
  });
  return out;
}
