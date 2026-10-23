/**
 * NextKin V2 §8.5 — every word the data-export screen says, plus the file it hands over, kept
 * pure so both read (and test) without mounting a page. The same split as `profileForms.ts`:
 * nothing here imports React, and nothing that decides anything lives in the screen.
 *
 * §8.5 is a legal right, so the copy is precise rather than reassuring. It names what the file
 * holds, says the link expires, promises no delivery time the data layer does not honour, and
 * sends the reader to the privacy policy for what is held and why.
 */
import type { ActivityEntry, DataExportStatus, Job, Profile, Resume, User } from '@/data/models';
import { formatShortDate } from '@/lib';

export const DATA_EXPORT_TITLE = 'Download your data';

/** The sections of the payload below, so the explainer cannot outgrow the file. */
export type DataExportSection = {
  key: 'account' | 'profile' | 'documents' | 'savedJobs' | 'activity';
  title: string;
  body: string;
};

/** One row per section of the payload, in the words ACCOUNT 02 (577:3105) sets them. */
export const DATA_EXPORT_CONTENTS: readonly DataExportSection[] = [
  { key: 'account', title: 'Your account', body: 'Name, email address and the day you joined.' },
  {
    key: 'profile',
    title: 'Your profile',
    body: 'Headline, experience, education, certifications, skills, links and preferences.',
  },
  {
    key: 'documents',
    title: 'Your documents',
    body: 'Each resume and cover letter with its dates, version count and latest score.',
  },
  { key: 'savedJobs', title: 'Saved jobs', body: 'The jobs you have saved.' },
  {
    key: 'activity',
    title: 'Your activity history',
    body: 'Generations, exports and applications.',
  },
];

export const DATA_EXPORT_CONTENTS_TITLE = 'What the file holds';

/** Under the privacy-policy row (577:3226): what the policy answers, so the tap is informed. */
export const DATA_EXPORT_PRIVACY_LINE =
  'What we hold about you, why we hold it, and how to get it back or get rid of it.';

export type DataExportBlock = { title: string; body: string; cta: string };

const IDLE: DataExportBlock = {
  title: 'Take a copy of your data',
  // The second sentence is the §8.5 one: asking is inert. Without it the only statement that a
  // request changes nothing lives in the FAILED block, which the reader hopes never to see.
  body: 'A JSON file of what NextKin holds about you. Asking for it changes nothing in your account.',
  cta: 'Request export',
};

const PREPARING: DataExportBlock = {
  title: 'Building your file',
  // The spec's own line. The mock is faster, but nothing here promises a number.
  body: 'Usually under a minute.',
  cta: 'Preparing',
};

const READY: DataExportBlock = {
  title: 'Your file is ready',
  body: 'Download it now. Once the link expires, a fresh copy takes another request.',
  cta: 'Download export',
};

const FAILED: DataExportBlock = {
  title: "The export didn't finish",
  body: 'Something went wrong.',
  cta: 'Try again',
};

/** The block for the state the export is actually in; a failure's reason is shown verbatim. */
export function dataExportBlock(status: DataExportStatus): DataExportBlock {
  switch (status.status) {
    case 'idle':
      return IDLE;
    case 'preparing':
      return PREPARING;
    case 'ready':
      return READY;
    case 'failed': {
      const reason = status.error?.trim();
      return reason ? { ...FAILED, body: reason } : FAILED;
    }
  }
}

/** Said under a failure: the request failed, the account did not change. */
export const DATA_EXPORT_FAILED_NOTE = 'Nothing in your account changed.';
/** The request itself never reached the export — nothing has started building. */
export const DATA_EXPORT_REQUEST_FAILED = "We couldn't ask for the export. Try again.";

/** "nextkin-export.json · 4.2 MB" — the size is the one the export itself reported. */
export function dataExportFileLine(status: DataExportStatus): string | undefined {
  if (!status.fileName) return undefined;
  return status.sizeLabel ? `${status.fileName} · ${status.sizeLabel}` : status.fileName;
}

/** The expiry the export reported, never an invented window. */
export function dataExportExpiryLine(
  status: DataExportStatus,
  now: Date = new Date(),
): string | undefined {
  if (!status.expiresAt) return undefined;
  const when = formatShortDate(status.expiresAt, now);
  return when ? `The link expires on ${when}.` : undefined;
}

/** The file was built but the device could not keep it. */
export const DATA_EXPORT_WRITE_FAILED = "We couldn't save the file on this device.";
/** The file exists and nothing on this runtime can receive it. */
export const DATA_EXPORT_SHARE_UNAVAILABLE = "This device can't share files right now.";
/** The share sheet took it; where it landed is the sheet's business, not ours. */
export const DATA_EXPORT_SHARED = 'Handed to the share sheet.';

/* ------------------------------------------------------------------ the file */

export const DATA_EXPORT_FORMAT = 'nextkin-account-export';
export const DATA_EXPORT_VERSION = 1;

export type DataExportAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  joinedAt: string;
};

export type DataExportDocument = {
  id: string;
  title: string;
  docType: Resume['docType'];
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  atsScore: number | null;
  targetCompany: string | null;
  targetRole: string | null;
};

export type DataExportSavedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  savedAt: string | null;
};

export type DataExportActivity = {
  id: string;
  kind: ActivityEntry['kind'];
  title: string;
  detail: string | null;
  createdAt: string;
};

/**
 * What the screen could actually read through its query hooks. A section left `undefined` is one
 * that had not loaded (or failed to), which is not the same fact as "you have none" — see
 * `missing` on the payload.
 */
export type DataExportSources = {
  user?: User;
  profile?: Profile;
  resumes?: readonly Resume[];
  savedJobs?: readonly Job[];
  activity?: readonly ActivityEntry[];
};

export type DataExportPayload = {
  format: typeof DATA_EXPORT_FORMAT;
  version: number;
  generatedAt: string;
  account: DataExportAccount | null;
  /** The profile aggregate as stored. */
  profile: Profile | null;
  documents: DataExportDocument[];
  savedJobs: DataExportSavedJob[];
  activity: DataExportActivity[];
  /**
   * Sections that could not be read when the file was written. Named in the file itself so an
   * empty list is never mistaken for an empty account — §8.5 is a right, and a silently short
   * archive answers it worse than an honest one.
   */
  missing: string[];
};

/** The document list, the saved jobs and the activity feed, flattened to what the file needs. */
export function buildDataExportPayload(
  sources: DataExportSources,
  generatedAt: string = new Date().toISOString(),
): DataExportPayload {
  const { user, profile, resumes, savedJobs, activity } = sources;

  return {
    format: DATA_EXPORT_FORMAT,
    version: DATA_EXPORT_VERSION,
    generatedAt,
    account: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          joinedAt: user.createdAt,
        }
      : null,
    profile: profile ?? null,
    documents: (resumes ?? []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      docType: doc.docType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      versionCount: doc.versionCount,
      atsScore: doc.atsScore ?? null,
      targetCompany: doc.targetCompany ?? null,
      targetRole: doc.targetRole ?? null,
    })),
    savedJobs: (savedJobs ?? []).map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      savedAt: job.savedAt ?? null,
    })),
    activity: (activity ?? []).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail ?? null,
      createdAt: entry.createdAt,
    })),
    missing: (['user', 'profile', 'resumes', 'savedJobs', 'activity'] as const).filter(
      (key) => sources[key] === undefined,
    ),
  };
}

/** Indented on purpose: the file is meant to be readable by the person who asked for it. */
export function dataExportJson(payload: DataExportPayload): string {
  return JSON.stringify(payload, null, 2);
}
