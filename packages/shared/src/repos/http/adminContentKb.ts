import {
  ContentNotServedError,
  SourceRequiredError,
  type KbChange,
  type KbFieldChange,
  type Technology,
  type TechnologyInput,
} from '../../models/adminContent';
import {
  kbImportWire,
  kbStatsWire,
  kbQueueWire,
  technologiesWire,
  technologyWire,
  type KbQueueWire,
  type TechnologyWire,
} from '../../schemas/adminContent';
import { KB_PAGE_SIZE, type AdminContentRepo } from '../adminContentRepo';
import { ApiError, type HttpClient } from './client';

/**
 * The Technology KB half of the HTTP `AdminContentRepo` (P12-04): `services/admin/technologies.ts`
 * over `/api/v1/admin/technologies` and `/admin/kb/queue`. What it doesn't serve stays out: the
 * per-change diff of an edit, editing a queued change, the import batches and the dataset dates
 * come back `null`, empty or `ContentNotServedError` (`toreview.md` §171.9). Counts come from
 * `GET /admin/kb/stats` (§171.13).
 */

type KbMethods = Pick<
  AdminContentRepo,
  | 'kbStats'
  | 'listTechnologies'
  | 'saveTechnology'
  | 'importTechnologies'
  | 'kbQueue'
  | 'decideChange'
  | 'editChange'
>;

/** `GET /admin/technologies` returns at most this many rows. */
const LIST_CAP = 500;
/** The route's `q` is at most 80 characters. */
const QUERY_MAX = 80;
/** Queue ids for users' reports, so a decision on one is told apart from a technology's. */
const REPORT = 'report:';

const STATUS_OF: Record<string, Technology['status']> = {
  published: 'published',
  // Approved but not yet published: it isn't in the Skills Explorer, so the portal still says so.
  admin_reviewed: 'in_review',
  llm_seeded: 'in_review',
};

export function toTechnology(t: TechnologyWire): Technology {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    aliases: t.aliases,
    latestVersion: t.latest_version ?? null,
    // The KB stores a release year, not a day.
    releaseDate: t.release_year != null ? String(t.release_year) : null,
    source: t.source_citation ? 'cited' : 'missing',
    sourceUrl: t.source_citation ?? null,
    dataset: `v${t.dataset_version}`,
    updatedAt: t.updated_at,
    updatedBy: '—',
    // Only an unreviewed entry can hold a year with no source (a table check).
    status:
      t.release_year != null && !t.source_citation
        ? 'needs_source'
        : (STATUS_OF[t.review_status] ?? 'in_review'),
  };
}

/** A cited source must be a URL (`technologyInputSchema`); one typed without a scheme gets https. */
const asUrl = (value: string) =>
  /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;

/** "2024", "2024-04-01" or the dialog's "2024-04-01T12:00:00.000Z" as a year; anything else as is. */
const toYear = (value: unknown) =>
  typeof value === 'string' && /^\d{4}(-\d{2}-\d{2}(T[\d:.]+Z)?)?$/.test(value.trim())
    ? Number(value.trim().slice(0, 4))
    : value;

const toInput = (input: TechnologyInput) => ({
  name: input.name,
  category: input.category,
  // The server refuses a blank alias rather than dropping it.
  aliases: input.aliases.map((alias) => alias.trim()).filter(Boolean),
  latestVersion: input.latestVersion?.trim() || null,
  releaseYear: input.releaseDate ? toYear(input.releaseDate) : null,
  sourceCitation: input.sourceUrl ? asUrl(input.sourceUrl) : null,
});

/**
 * The cited-source rule, however the server words it: the review's own message, or a create or
 * edit's issue on `sourceCitation` ("a reviewed date needs a cited source").
 */
function needsSource(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return false;
  // The review rewords every refusal as the source one but keeps the issues: trust those first.
  if (!Array.isArray(error.details)) return /cited source/i.test(error.message);
  return (error.details as unknown[]).some((issue) => {
    const { path, message } = (issue ?? {}) as { path?: unknown; message?: unknown };
    return (
      path === 'sourceCitation' && typeof message === 'string' && /cited source/i.test(message)
    );
  });
}

// --- Import --------------------------------------------------------------------------------------

/** The import dialog's columns, and snake_case names, as `technologyInputSchema` names them. */
const IMPORT_KEYS: Record<string, string> = {
  latest_version: 'latestVersion',
  release_date: 'releaseYear',
  release_year: 'releaseYear',
  safe_usage_year: 'safeUsageYear',
  enterprise_adoption_year: 'enterpriseAdoptionYear',
  source: 'sourceCitation',
  source_citation: 'sourceCitation',
  review_status: 'reviewStatus',
};
const YEARS = new Set(['releaseYear', 'safeUsageYear', 'enterpriseAdoptionYear']);

/** One row with the server's keys and types. Anything it can't read goes as is, for the server to list. */
function toServerRow(row: unknown): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const out: Record<string, unknown> = {};
  for (const [raw, value] of Object.entries(row)) {
    const key = IMPORT_KEYS[raw.trim().toLowerCase()] ?? raw.trim();
    if (value === '') continue;
    if (YEARS.has(key)) out[key] = toYear(value);
    else if (key === 'aliases' && typeof value === 'string') {
      // The dialog separates aliases with ; or | (the server's CSV reader takes only |).
      out[key] = value
        .split(/[;|]/)
        .map((alias) => alias.trim())
        .filter(Boolean);
    } else if (key === 'sourceCitation' && typeof value === 'string')
      out[key] = asUrl(value.trim());
    else out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

/** A header row, then one entry per line; "" escapes a quote, and blank lines are skipped (as `parseCsv`). */
function csvRows(content: string): Record<string, string>[] {
  const lines: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((cell) => cell.length)) lines.push(row);
    row = [];
  };
  for (let i = 0; i < content.length; i++) {
    const ch = content.charAt(i);
    if (quoted) {
      if (ch === '"' && content.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content.charAt(i + 1) === '\n') i++;
      endRow();
    } else field += ch;
  }
  endRow();
  const [head, ...body] = lines;
  if (!head) return [];
  return body.map((cells) =>
    Object.fromEntries(
      head.flatMap((key, i) => {
        const value = (cells[i] ?? '').trim();
        return value ? [[key.trim(), value]] : [];
      }),
    ),
  );
}

/**
 * The file as the server reads it: the dialog's columns (name, category, aliases, latest_version,
 * release_date, source) renamed, and sent as JSON so each entry keeps its row number. JSON the
 * client can't read goes as it is, and the server says what's wrong with it.
 */
function toServerImport(file: { format: 'csv' | 'json'; content: string }) {
  if (file.format === 'csv') {
    return {
      format: 'json' as const,
      content: JSON.stringify(csvRows(file.content).map(toServerRow)),
    };
  }
  try {
    const parsed: unknown = JSON.parse(file.content);
    if (Array.isArray(parsed)) {
      return { format: 'json' as const, content: JSON.stringify(parsed.map(toServerRow)) };
    }
  } catch {
    // Sent unchanged below.
  }
  return file;
}

// --- The review queue ----------------------------------------------------------------------------

type Candidate = KbQueueWire['candidates'][number];
type Report = KbQueueWire['reports'][number];

const times = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

/** An entry's values, each as proposed (the server keeps no diff to show what it replaced). */
function proposedFields(t: TechnologyWire): KbFieldChange[] {
  const fields: KbFieldChange[] = [
    { field: 'Name', from: null, to: t.name },
    { field: 'Category', from: null, to: t.category },
  ];
  if (t.aliases.length) fields.push({ field: 'Aliases', from: null, to: t.aliases.join(', ') });
  if (t.latest_version) fields.push({ field: 'Latest version', from: null, to: t.latest_version });
  if (t.release_year != null) {
    fields.push({ field: 'Release date', from: null, to: String(t.release_year) });
  }
  return fields;
}

const sourceOf = (t: TechnologyWire, note: string) =>
  t.source_citation ? { url: t.source_citation, cited: true, note } : null;

/** A seeded candidate: a new entry the model proposed for a name the validator couldn't verify. */
function candidateChange(c: Candidate, t: TechnologyWire): KbChange {
  return {
    id: t.id,
    title: `${t.name} · new technology`,
    kind: 'new',
    // Machine-made, so it sits with the imports rather than the staff edits.
    origin: 'import',
    originLabel: `Seeded candidate · seen ${times(c.occurrences, 'time')}`,
    // When the seeded entry was filed; the queue row's own times aren't served.
    at: t.created_at,
    detail: {
      heading: `${t.name} — new technology`,
      technology: `${t.name} · ${t.category}`,
      proposedBy: 'Seeded by the model from resume validation',
      resumesAffected: `${times(c.occurrences, 'occurrence')} · aggregate count`,
      targetDataset: `v${t.dataset_version}`,
      fields: proposedFields(t),
      source: sourceOf(t, 'Cited when the entry was seeded'),
      reports: [],
    },
  };
}

/**
 * An entry staff added or imported (both land reviewed) that isn't published yet. Only publishing
 * puts it in the Skills Explorer, and the queue is the one place the portal publishes from.
 */
function reviewedChange(t: TechnologyWire): KbChange {
  return {
    id: t.id,
    title: `${t.name} · awaiting publish`,
    kind: 'new',
    origin: 'staff_edit',
    originLabel: 'Reviewed · not yet published',
    at: t.updated_at,
    detail: {
      heading: `${t.name} — awaiting publish`,
      technology: `${t.name} · ${t.category}`,
      // Who added it isn't served.
      proposedBy: 'Staff (added, imported or approved)',
      resumesAffected: '—',
      targetDataset: `v${t.dataset_version}`,
      fields: proposedFields(t),
      source: sourceOf(t, 'Cited on the entry'),
      reports: [],
    },
  };
}

const REPORT_KIND: Record<string, string> = {
  validation_flag: 'Validation flagged',
  claim_dispute: 'Claim disputed',
};

/** What a report is about, from its subject's plain values ("claim: c1"); its keys aren't pinned. */
const subjectOf = (subject: Record<string, unknown>) =>
  Object.entries(subject)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');

function reportChange(r: Report): KbChange {
  const what = REPORT_KIND[r.kind] ?? 'Reported';
  return {
    id: `${REPORT}${r.id}`,
    title: `${what} · user report`,
    kind: 'report',
    origin: 'user_report',
    originLabel: 'User report',
    at: r.createdAt,
    detail: {
      heading: what,
      technology: subjectOf(r.subject) || '—',
      proposedBy: 'User report',
      resumesAffected: '—',
      targetDataset: '—',
      fields: [],
      source: null,
      reports: [
        { id: r.id, title: what, body: r.reason ?? '', at: r.createdAt, origin: 'user report' },
      ],
    },
  };
}

export function createHttpKbMethods(http: HttpClient): KbMethods {
  const rows = async (query: { status?: string; q?: string } = {}) =>
    technologiesWire.parse(await http.request('/admin/technologies', { query })).data;
  const queue = async () => kbQueueWire.parse(await http.request('/admin/kb/queue'));

  /**
   * What's waiting: seeded candidates whose entry is still unreviewed (a review doesn't clear the
   * queue row, and a rejected entry leaves it without one), reviewed entries not yet published,
   * then users' open reports.
   */
  const changesOf = async (
    raw: KbQueueWire,
    seeded: TechnologyWire[],
    reviewed: TechnologyWire[],
  ): Promise<KbChange[]> => {
    const byId = new Map(seeded.map((t) => [t.id, t]));
    if (seeded.length >= LIST_CAP) {
      // The list stopped at its cap: look up the candidates it didn't reach by name.
      for (const c of raw.candidates) {
        if (!c.technologyId || byId.has(c.technologyId)) continue;
        const found = await rows({ status: 'llm_seeded', q: c.name.slice(0, QUERY_MAX) });
        for (const t of found) byId.set(t.id, t);
      }
    }
    const candidates = raw.candidates.flatMap((c) => {
      const t = c.technologyId ? byId.get(c.technologyId) : undefined;
      return t ? [candidateChange(c, t)] : [];
    });
    const awaiting = [...reviewed]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(reviewedChange);
    return [...candidates, ...awaiting, ...raw.reports.map(reportChange)];
  };

  /** The Review queue tab: every entry not yet published, as the portal's In review. */
  const inReview = (seeded: TechnologyWire[], reviewed: TechnologyWire[]) =>
    [...seeded, ...reviewed]
      .map(toTechnology)
      .filter((t) => t.status === 'in_review')
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    kbStats: async () => {
      const [counts, seeded, reviewed, raw] = await Promise.all([
        http.request('/admin/kb/stats').then((body) => kbStatsWire.parse(body)),
        rows({ status: 'llm_seeded' }),
        rows({ status: 'admin_reviewed' }),
        queue(),
      ]);
      const changes = await changesOf(raw, seeded, reviewed);
      return {
        // Exact counts from `GET /admin/kb/stats`, not a capped list's length.
        technologies: { total: counts.total, added30d: counts.added30d },
        review: { total: changes.length, fromImports: null, staffEdits: null },
        reports: { total: raw.reports.length, dates: null, aliases: null },
        // Closing a dataset is served; reading the current one isn't.
        dataset: null,
        // No report names a technology, and import batches aren't listed: no counts for those tabs.
        tabs: {
          all: counts.total,
          review: inReview(seeded, reviewed).length,
          reports: null,
          imports: null,
        },
      };
    },

    listTechnologies: async ({ tab, query, page, dataset, sort }) => {
      const q = query.trim().slice(0, QUERY_MAX);
      const search = q ? { q } : {};
      let list: Technology[] = [];
      if (tab === 'all') list = (await rows(search)).map(toTechnology);
      if (tab === 'review') {
        const [seeded, reviewed] = await Promise.all([
          rows({ status: 'llm_seeded', ...search }),
          rows({ status: 'admin_reviewed', ...search }),
        ]);
        list = inReview(seeded, reviewed);
      }
      if (dataset) list = list.filter((t) => t.dataset === dataset);
      if (sort) {
        list.sort((x, y) =>
          sort === 'asc' ? x.name.localeCompare(y.name) : y.name.localeCompare(x.name),
        );
      }
      const start = (page - 1) * KB_PAGE_SIZE;
      return {
        rows: list.slice(start, start + KB_PAGE_SIZE),
        total: list.length,
        page,
        pageSize: KB_PAGE_SIZE,
      };
    },

    saveTechnology: async (input, id) => {
      const body = toInput(input);
      try {
        const saved = id
          ? await http.request(`/admin/technologies/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              body,
            })
          : await http.request('/admin/technologies', { body });
        return toTechnology(technologyWire.parse(saved));
      } catch (error) {
        if (needsSource(error)) throw new SourceRequiredError();
        throw error;
      }
    },

    importTechnologies: async (file) => {
      const result = kbImportWire.parse(
        await http.request('/admin/technologies/import', { body: toServerImport(file) }),
      );
      return {
        imported: result.imported.length,
        failed: result.failed.map((f) => ({ row: f.row, reason: f.errors.join('; ') })),
      };
    },

    kbQueue: async () => {
      const [raw, seeded, reviewed] = await Promise.all([
        queue(),
        rows({ status: 'llm_seeded' }),
        rows({ status: 'admin_reviewed' }),
      ]);
      return changesOf(raw, seeded, reviewed);
    },

    decideChange: async (id, decision) => {
      if (id.startsWith(REPORT)) throw new ContentNotServedError('settling user reports');
      try {
        await http.request(`/admin/technologies/${encodeURIComponent(id)}/review`, {
          // The portal's Approve is the KB's publish (only published entries reach the Skills
          // Explorer). The server's `approve` alone would leave the entry reviewed but unpublished:
          // still In review here, and no longer in the queue to be published from.
          body: { decision: decision === 'approve' ? 'publish' : 'reject' },
        });
      } catch (error) {
        if (needsSource(error)) throw new SourceRequiredError();
        throw error;
      }
    },

    editChange: async () => {
      throw new ContentNotServedError('editing a queued change');
    },
  };
}
