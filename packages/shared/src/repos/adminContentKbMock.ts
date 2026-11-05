import { simulate } from '../mock/delay';
import { kbQueueFixture, kbStatsFixture, technologiesFixture } from '../mock/fixtures/adminContent';
import {
  isSourceUrl,
  NothingChangedError,
  SourceRequiredError,
  SourceUrlError,
  type KbChange,
  type KbImportResult,
  type KbStats,
  type Technology,
  type TechnologyInput,
  type TechnologyPage,
  type TechnologyStatus,
} from '../models/adminContent';

import type { AdminContentRepo } from './adminContentRepo';
import { importRows, toIsoDay } from './adminContentKbImport';
import { auditRef, recordAdminAudit } from './adminAuditLog';
import { onAdminMockReset } from './adminMockReset';
import { clone, NotFoundError } from './state';

export const KB_PAGE_SIZE = 10;

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

const STAFF = 'Ehsan';
const TARGET = 'v2026.12';
const now = () => new Date().toISOString();

type Changed = { field: string; from: string | null; to: string | null };

/** Each field an edit can change, how the entry holds it, and the queue kind it makes on its own. */
const FIELDS: {
  field: string;
  of: (t: TechnologyInput) => string | null;
  kind: KbChange['kind'];
}[] = [
  { field: 'Name', of: (t) => t.name, kind: 'category' },
  { field: 'Category', of: (t) => t.category, kind: 'category' },
  { field: 'Aliases', of: (t) => t.aliases.join(', ') || null, kind: 'alias' },
  { field: 'Latest version', of: (t) => t.latestVersion, kind: 'version' },
  { field: 'Release date', of: (t) => t.releaseDate, kind: 'date' },
];

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/** The entry's status once nothing is waiting on it: a date with no source still needs one. */
const settled = (t: Technology): TechnologyStatus =>
  t.releaseDate && !t.sourceUrl ? 'needs_source' : 'published';

/** Writes a decided change's new values onto its entry. */
function apply(tech: Technology, change: KbChange) {
  for (const f of change.detail.fields) {
    if (!('to' in f)) continue;
    if (f.field === 'Name' && f.to) tech.name = f.to;
    if (f.field === 'Category' && f.to) tech.category = f.to;
    if (f.field === 'Aliases') {
      tech.aliases = (f.to ?? '')
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    }
    if (f.field === 'Latest version') tech.latestVersion = f.to;
    if (f.field === 'Release date') tech.releaseDate = f.to ? toIsoDay(f.to) : null;
  }
  const source = change.detail.source;
  if (source?.cited) {
    tech.sourceUrl = withScheme(source.url);
    tech.source = 'cited';
  }
  tech.dataset = change.detail.targetDataset;
  tech.updatedAt = now();
  tech.updatedBy = STAFF;
}

/** Refuses a date with no source, or a source that isn't a web address (P12-04). */
function checkSource(releaseDate: string | null, sourceUrl: string | null) {
  if (sourceUrl && !isSourceUrl(sourceUrl)) throw new SourceUrlError();
  if (releaseDate && !sourceUrl) throw new SourceRequiredError();
}

/**
 * The Technology KB on the mock (Figma 409:1872, 410:1771). An add, edit or import only proposes:
 * the proposed values wait on the queued change, and the entry keeps its own until the change is
 * approved. Rejecting puts the entry back as it stood, and drops a new entry that was never approved.
 */
export function createMockKbMethods(): KbMethods {
  const fresh = () => ({
    technologies: clone(technologiesFixture),
    queue: clone(kbQueueFixture),
    stats: clone(kbStatsFixture),
    /** The status an entry had before a staff edit put it in review, by change id. */
    before: new Map<string, TechnologyStatus>(),
  });
  let state = fresh();
  onAdminMockReset(() => {
    state = fresh();
  });

  const nameOf = (change: KbChange) => change.detail.technology.split(' · ')[0] ?? '';
  const techOf = (change: KbChange) => state.technologies.find((t) => t.name === nameOf(change));
  const waitingOn = (tech: Technology) => state.queue.filter((c) => nameOf(c) === tech.name);
  const isReported = (tech: Technology) =>
    tech.status === 'reported' ||
    waitingOn(tech).some((c) => c.origin === 'user_report' || c.detail.reports.length > 0);

  /** Each tab's entries, so its badge counts exactly what it lists. */
  const tabRows = {
    all: () => state.technologies,
    review: () =>
      state.technologies.filter((t) => t.status === 'in_review' || waitingOn(t).length > 0),
    reports: () => state.technologies.filter(isReported),
    imports: () => state.technologies.filter((t) => t.updatedBy === 'Import'),
  };

  const stats = (): KbStats => {
    const fromImports = state.queue.filter((c) => c.origin === 'import').length;
    return {
      ...clone(state.stats),
      review: {
        total: state.queue.length,
        fromImports,
        staffEdits: state.queue.length - fromImports,
      },
      tabs: {
        all: state.stats.technologies.total,
        review: tabRows.review().length,
        reports: tabRows.reports().length,
        imports: tabRows.imports().length,
      },
    };
  };

  const proposal = (
    tech: Technology,
    fields: Changed[],
    sourceUrl: string | null,
    added: boolean,
  ): KbChange => {
    const only = fields.length === 1 ? fields[0] : undefined;
    const what = added ? 'new technology' : only ? only.field.toLowerCase() : 'edit';
    const title = `${tech.name} · ${what}`;
    return {
      id: `chg_${tech.id}_${Date.now()}`,
      title,
      kind: added ? 'new' : (FIELDS.find((f) => f.field === only?.field)?.kind ?? 'category'),
      origin: 'staff_edit',
      originLabel: `Staff edit · ${STAFF}`,
      at: now(),
      detail: {
        heading: title.replace(' · ', ' — '),
        technology: `${tech.name} · ${tech.category}`,
        proposedBy: `Staff edit · ${STAFF}`,
        resumesAffected: 'aggregate count not yet computed',
        targetDataset: TARGET,
        fields,
        source: sourceUrl ? { url: sourceUrl, cited: true, note: 'Cited by staff' } : null,
        reports: [],
      },
    };
  };

  const addEntry = (input: TechnologyInput, updatedBy: string): Technology => {
    const tech: Technology = {
      id: `tech_${input.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`,
      ...input,
      source: input.sourceUrl ? 'cited' : 'missing',
      dataset: TARGET,
      updatedAt: now(),
      updatedBy,
      status: 'in_review',
    };
    state.technologies.unshift(tech);
    state.stats.technologies.total += 1;
    return tech;
  };

  const taken = (name: string, except?: string) =>
    state.technologies.some((t) => t.id !== except && t.name.toLowerCase() === name.toLowerCase());

  return {
    kbStats: () =>
      simulate(stats, {
        empty: () => ({
          technologies: { total: 0, added30d: null },
          review: { total: 0, fromImports: null, staffEdits: null },
          reports: { total: 0, dates: null, aliases: null },
          dataset: null,
          tabs: { all: 0, review: 0, reports: 0, imports: 0 },
        }),
      }),

    listTechnologies: ({ tab, query, page, dataset, sort }) =>
      simulate<TechnologyPage>(
        () => {
          const needle = query.trim().toLowerCase();
          const rows = tabRows[tab]().filter((t) => {
            if (dataset && t.dataset !== dataset) return false;
            if (!needle) return true;
            return [t.name, t.category, ...t.aliases].some((v) => v.toLowerCase().includes(needle));
          });
          if (sort) {
            rows.sort((a, b) =>
              sort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
            );
          }
          // The unfiltered list is the board's 1,284; the fixture holds its first pages.
          const total = tab === 'all' && !needle && !dataset ? stats().tabs.all! : rows.length;
          const start = (page - 1) * KB_PAGE_SIZE;
          return {
            rows: clone(rows.slice(start, start + KB_PAGE_SIZE)),
            total,
            page,
            pageSize: KB_PAGE_SIZE,
          };
        },
        { empty: () => ({ rows: [], total: 0, page: 1, pageSize: KB_PAGE_SIZE }) },
      ),

    saveTechnology: (input, id) =>
      simulate(() => {
        checkSource(input.releaseDate, input.sourceUrl);
        if (taken(input.name, id)) throw new Error(`${input.name} is already in the KB.`);
        const existing = id ? state.technologies.find((t) => t.id === id) : undefined;
        if (id && !existing) throw new NotFoundError('Technology', id);
        if (!existing) {
          const tech = addEntry(input, STAFF);
          const fields = FIELDS.flatMap(({ field, of }) =>
            of(input) ? [{ field, from: null, to: of(input) }] : [],
          );
          state.queue.unshift(proposal(tech, fields, input.sourceUrl, true));
          recordAdminAudit('Added KB entry', 'technology', auditRef('tech', tech.id));
          return clone(tech);
        }
        const fields = FIELDS.flatMap(({ field, of }) => {
          const from = of(existing);
          const to = of(input);
          const same =
            field === 'Release date' ? from?.slice(0, 10) === to?.slice(0, 10) : from === to;
          return same ? [] : [{ field, from, to }];
        });
        const sourceChanged = (input.sourceUrl ?? null) !== (existing.sourceUrl ?? null);
        if (fields.length === 0 && !sourceChanged) throw new NothingChangedError(existing.name);
        const change = proposal(existing, fields, input.sourceUrl, false);
        if (existing.status !== 'in_review') state.before.set(change.id, existing.status);
        existing.status = 'in_review';
        state.queue.unshift(change);
        recordAdminAudit('Edited KB entry', 'technology', auditRef('tech', existing.id));
        return clone(existing);
      }),

    importTechnologies: (file) =>
      simulate<KbImportResult>(() => {
        const { rows, failed } = importRows(file);
        let imported = 0;
        rows.forEach(({ row, input }) => {
          if (taken(input.name)) {
            failed.push({ row, reason: `${input.name} is already in the KB; edit it instead` });
            return;
          }
          imported += 1;
          const tech = addEntry(input, 'Import');
          const fields = FIELDS.flatMap(({ field, of }) =>
            of(input) ? [{ field, from: null, to: of(input) }] : [],
          );
          state.queue.push({
            ...proposal(tech, fields, input.sourceUrl, true),
            id: `chg_${tech.id}`,
            origin: 'import',
            originLabel: `Import · row ${row}`,
          });
        });
        failed.sort((a, b) => a.row - b.row);
        if (imported) recordAdminAudit('Imported KB entry', 'technology', `${imported} entries`);
        return { imported, failed };
      }),

    kbQueue: () => simulate(() => clone(state.queue), { empty: () => [] }),

    decideChange: (id, decision) =>
      simulate(() => {
        const item = state.queue.find((c) => c.id === id);
        if (!item) throw new NotFoundError('KbChange', id);
        const changesDate = item.detail.fields.some(
          (f) => f.field === 'Release date' && 'to' in f && f.to,
        );
        if (decision === 'approve' && changesDate && !item.detail.source?.cited)
          throw new SourceRequiredError();
        const tech = techOf(item);
        state.queue = state.queue.filter((c) => c.id !== id);
        const before = state.before.get(id);
        state.before.delete(id);
        recordAdminAudit(
          decision === 'approve' ? 'Approved KB change' : 'Rejected KB change',
          'technology',
          auditRef('tech', tech?.id ?? id),
        );
        if (!tech) return;
        if (decision === 'approve') apply(tech, item);
        const stillWaiting = waitingOn(tech).length > 0;
        if (decision === 'reject' && item.kind === 'new' && tech.status === 'in_review') {
          // A new entry that was never approved goes with its change.
          state.technologies = state.technologies.filter((t) => t.id !== tech.id);
          state.stats.technologies.total -= 1;
          return;
        }
        if (stillWaiting) return;
        if (decision === 'approve') tech.status = settled(tech);
        else if (before) tech.status = before;
        else if (tech.status === 'in_review') tech.status = settled(tech);
      }),

    editChange: (id, fields, source) =>
      simulate(() => {
        const item = state.queue.find((c) => c.id === id);
        if (!item) throw new NotFoundError('KbChange', id);
        const date = fields.find((f) => f.field === 'Release date');
        if (date?.to && !toIsoDay(date.to))
          throw new Error('Write the release date as YYYY-MM-DD.');
        const url = source === undefined ? undefined : source?.trim() || null;
        if (url && !isSourceUrl(url)) throw new SourceUrlError();
        for (const edit of fields) {
          const field = item.detail.fields.find((f) => f.field === edit.field);
          if (field && 'to' in field)
            field.to = edit.field === 'Release date' ? toIsoDay(edit.to) : edit.to || null;
        }
        if (url !== undefined) {
          item.detail.source = url ? { url, cited: true, note: 'Cited by staff' } : null;
        }
        item.origin = 'staff_edit';
        item.originLabel = `Staff edit · ${STAFF}`;
        recordAdminAudit('Edited KB change', 'technology', auditRef('tech', id));
        return clone(item);
      }),
  };
}
