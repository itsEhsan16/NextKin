import type { Certification, Education, Experience, LinkKind, ProfileLink } from '@/data/models';

/**
 * The shapes the four profile entry forms edit (V2 §7.3), what a blank one looks like, what an
 * existing entry becomes when it is loaded into one, and what leaves on Save — plus the address
 * normalisation the link and credential fields lean on.
 *
 * Split out of `profileForms` and re-exported from it, the way `sectionDrafts` is split out of
 * `sectionEdits`: the rules and the shapes are different questions, and a caller only ever
 * imports one module.
 */

const blank = (value: string): boolean => value.trim().length === 0;

/* ------------------------------------------------------------------- urls */

/**
 * "linkedin.com/in/george" is what a person types; "https://linkedin.com/in/george" is what the
 * profile has to store, because everything downstream opens the field rather than reading it. An
 * `http://` address is left alone rather than upgraded — changing the scheme changes where it
 * points, and that is not a normalisation.
 */
export function normaliseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // A pasted protocol-relative "//host/path" would otherwise become "https:////host/path".
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

/** host.tld plus whatever path follows. Deliberately loose: this catches typos, not domains. */
const HOST_AND_PATH = /^[^\s/?#]+\.[^\s/?#]{2,}(?:[/?#]\S*)?$/;

export function looksLikeUrl(value: string): boolean {
  const url = normaliseUrl(value);
  if (url.length === 0) return false;
  return HOST_AND_PATH.test(url.replace(/^https?:\/\//i, ''));
}

/* ----------------------------------------------------------------- drafts */

export type ExperienceDraft = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  current: boolean;
  skills: string[];
};

export type EducationDraft = {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  current: boolean;
};

export type CertificationDraft = {
  name: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string;
  credentialUrl: string;
};

export type LinkDraft = { kind: LinkKind; label: string; url: string };

export const blankExperience = (): ExperienceDraft => ({
  company: '',
  title: '',
  startDate: '',
  endDate: '',
  current: false,
  skills: [],
});

export const experienceDraft = (entry: Experience): ExperienceDraft => ({
  company: entry.company,
  title: entry.title,
  startDate: entry.startDate,
  endDate: entry.endDate ?? '',
  current: entry.current,
  skills: [...entry.skills],
});

export const blankEducation = (): EducationDraft => ({
  institution: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
  current: false,
});

export const educationDraft = (entry: Education): EducationDraft => ({
  institution: entry.institution,
  degree: entry.degree,
  field: entry.field ?? '',
  startDate: entry.startDate,
  endDate: entry.endDate ?? '',
  current: entry.current,
});

export const blankCertification = (): CertificationDraft => ({
  name: '',
  issuer: '',
  issuedOn: '',
  expiresOn: '',
  credentialUrl: '',
});

export const certificationDraft = (entry: Certification): CertificationDraft => ({
  name: entry.name,
  issuer: entry.issuer,
  issuedOn: entry.issuedOn ?? '',
  expiresOn: entry.expiresOn ?? '',
  credentialUrl: entry.credentialUrl ?? '',
});

export const blankLink = (): LinkDraft => ({ kind: 'portfolio', label: '', url: '' });

export const linkDraft = (entry: ProfileLink): LinkDraft => ({
  kind: entry.kind ?? 'other',
  label: entry.label,
  url: entry.url,
});

/* ------------------------------------------------------- what Save writes */

/**
 * A new entry is sent with an empty id: `profileRepo.upsertEntry` treats an empty or unknown id
 * as an append and mints the real one, so the screen never invents an id the server would throw
 * away. An id that is already on the profile replaces its row in place.
 *
 * An optional field that is empty is omitted rather than stored as '' — the models mark those
 * fields absent-or-set, and '' would print as a blank line everywhere the entry is rendered.
 */
export const experienceEntry = (id: string, draft: ExperienceDraft): Experience => ({
  id,
  company: draft.company.trim(),
  title: draft.title.trim(),
  startDate: draft.startDate,
  ...(draft.current || draft.endDate.length === 0 ? {} : { endDate: draft.endDate }),
  current: draft.current,
  skills: draft.skills,
});

export const educationEntry = (id: string, draft: EducationDraft): Education => ({
  id,
  institution: draft.institution.trim(),
  degree: draft.degree.trim(),
  ...(blank(draft.field) ? {} : { field: draft.field.trim() }),
  startDate: draft.startDate,
  ...(draft.current || draft.endDate.length === 0 ? {} : { endDate: draft.endDate }),
  current: draft.current,
});

export const certificationEntry = (id: string, draft: CertificationDraft): Certification => ({
  id,
  name: draft.name.trim(),
  issuer: draft.issuer.trim(),
  ...(draft.issuedOn.length === 0 ? {} : { issuedOn: draft.issuedOn }),
  ...(draft.expiresOn.length === 0 ? {} : { expiresOn: draft.expiresOn }),
  ...(blank(draft.credentialUrl) ? {} : { credentialUrl: normaliseUrl(draft.credentialUrl) }),
});

export const linkEntry = (id: string, draft: LinkDraft): ProfileLink => ({
  id,
  label: draft.label.trim(),
  url: normaliseUrl(draft.url),
  kind: draft.kind,
});
