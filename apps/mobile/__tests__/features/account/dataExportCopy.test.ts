import { profileFixture, userFixture } from '@/data/mock';
import type { ActivityEntry, DataExportStatus, Job, Resume } from '@/data/models';
import {
  buildDataExportPayload,
  DATA_EXPORT_CONTENTS,
  DATA_EXPORT_FORMAT,
  DATA_EXPORT_VERSION,
  dataExportBlock,
  dataExportExpiryLine,
  dataExportFileLine,
  dataExportJson,
} from '@/features/account/dataExportCopy';

const NOW = new Date('2026-09-06T09:00:00.000Z');

const status = (over: Partial<DataExportStatus> = {}): DataExportStatus => ({
  status: 'idle',
  ...over,
});

describe('dataExportCopy — the four export states (V2 §8.5)', () => {
  it('gives each state its own block, and never a delivery time the data layer does not honour', () => {
    expect(dataExportBlock(status({ status: 'idle' })).cta).toBe('Request export');
    expect(dataExportBlock(status({ status: 'preparing' })).cta).toBe('Preparing');
    expect(dataExportBlock(status({ status: 'ready' })).cta).toBe('Download export');
    expect(dataExportBlock(status({ status: 'failed' })).cta).toBe('Try again');

    // The spec's own wording, and the only time claim anywhere on the screen.
    expect(dataExportBlock(status({ status: 'preparing' })).body).toContain('Usually under a minute');
  });

  it('shows a failure its own reason rather than a generic one', () => {
    const withReason = dataExportBlock(status({ status: 'failed', error: 'The archive timed out.' }));
    expect(withReason.body).toBe('The archive timed out.');

    // A blank reason is no reason: the generic body stands rather than an empty line.
    expect(dataExportBlock(status({ status: 'failed', error: '   ' })).body).toBe(
      dataExportBlock(status({ status: 'failed' })).body,
    );
  });

  it('quotes the file name and size the export itself reported, and nothing it did not', () => {
    expect(dataExportFileLine(status({ fileName: 'nextkin-export.json', sizeLabel: '4.2 MB' }))).toBe(
      'nextkin-export.json · 4.2 MB',
    );
    // No size reported means no size printed — not "0 MB".
    expect(dataExportFileLine(status({ fileName: 'nextkin-export.json' }))).toBe(
      'nextkin-export.json',
    );
    expect(dataExportFileLine(status())).toBeUndefined();
  });

  it('states the expiry only when the export gave one', () => {
    const line = dataExportExpiryLine(status({ expiresAt: '2026-09-13T09:00:00.000Z' }), NOW);
    expect(line).toMatch(/^The link expires on .+\.$/);
    // Never an invented window.
    expect(dataExportExpiryLine(status(), NOW)).toBeUndefined();
  });
});

describe('dataExportCopy — the file itself (V2 §8.5)', () => {
  const resume: Resume = {
    id: 'res_1',
    title: 'UX Designer Resume',
    docType: 'resume',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
    versionCount: 3,
    currentVersionId: 'ver_1_3',
    atsScore: 92,
    status: 'ready',
    tags: [],
  };

  const activity: ActivityEntry = {
    id: 'act_1',
    kind: 'export',
    title: 'Exported **Product Designer** as a PDF',
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('flattens what the screen could read into the shape the file promises', () => {
    const payload = buildDataExportPayload(
      {
        user: userFixture,
        profile: profileFixture,
        resumes: [resume],
        savedJobs: [],
        activity: [activity],
      },
      NOW.toISOString(),
    );

    expect(payload.format).toBe(DATA_EXPORT_FORMAT);
    expect(payload.version).toBe(DATA_EXPORT_VERSION);
    expect(payload.generatedAt).toBe(NOW.toISOString());
    expect(payload.account).toEqual({
      id: userFixture.id,
      email: userFixture.email,
      firstName: userFixture.firstName,
      lastName: userFixture.lastName,
      joinedAt: userFixture.createdAt,
    });
    expect(payload.documents).toHaveLength(1);
    expect(payload.documents[0]?.atsScore).toBe(92);
    expect(payload.activity[0]?.detail).toBeNull();
    // Everything was read, so nothing is declared missing.
    expect(payload.missing).toEqual([]);
  });

  /**
   * The distinction the whole payload turns on: a section that failed to load is not the same
   * fact as an account that has none of that thing, and §8.5 is answered worse by a silently
   * short archive than by an honest one.
   */
  it('names the sections it could not read, so an empty list is never mistaken for an empty account', () => {
    const payload = buildDataExportPayload({ user: userFixture }, NOW.toISOString());

    expect(payload.documents).toEqual([]);
    expect(payload.savedJobs).toEqual([]);
    expect(payload.activity).toEqual([]);
    expect(payload.missing).toEqual(['profile', 'resumes', 'savedJobs', 'activity']);

    // A section that loaded and was genuinely empty is NOT missing.
    const emptyButRead = buildDataExportPayload(
      { user: userFixture, profile: profileFixture, resumes: [], savedJobs: [], activity: [] },
      NOW.toISOString(),
    );
    expect(emptyButRead.missing).toEqual([]);
  });

  it('nulls a saved job with no save date rather than dropping the row', () => {
    const job = { id: 'j1', title: 'Product Designer', company: 'Stripe', location: 'Bengaluru' };
    const payload = buildDataExportPayload(
      { savedJobs: [job as unknown as Job] },
      NOW.toISOString(),
    );
    expect(payload.savedJobs).toEqual([
      { id: 'j1', title: 'Product Designer', company: 'Stripe', location: 'Bengaluru', savedAt: null },
    ]);
  });

  it('writes the file so the person who asked for it can read it', () => {
    const json = dataExportJson(buildDataExportPayload({ user: userFixture }, NOW.toISOString()));
    expect(json).toContain('\n  "format"');
    expect(JSON.parse(json)).toMatchObject({ format: DATA_EXPORT_FORMAT });
  });

  it('keeps the explainer honest: one line per section the file actually carries', () => {
    const payload = buildDataExportPayload({}, NOW.toISOString());
    const sections = Object.keys(payload).filter(
      (key) => !['format', 'version', 'generatedAt', 'missing'].includes(key),
    );
    expect(DATA_EXPORT_CONTENTS).toHaveLength(sections.length);
  });
});
