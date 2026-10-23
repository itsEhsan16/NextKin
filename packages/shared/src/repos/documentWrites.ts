import { newId } from '../mock';
import type { Resume, ResumeContent } from '../models';

import { nowIso } from './resumeContentEdits';
import type { MockStore } from './state';

/**
 * The two halves of every document write (V2 §7.11): mint a version, then file the body under it.
 * Shared by the section editor and Zero Resume's check flow so both write history the same way.
 */

/** §7.11 never rewrites history: every write mints a version rather than editing the head. */
export function bumpVersion(
  store: MockStore,
  resume: Resume,
  note: string,
): { resume: Resume; versionId: string } {
  const createdAt = nowIso();
  const versionId = newId('ver');
  const version = resume.versionCount + 1;
  // A confirmation is for the version it confirmed (V2 §15 risk 2): a new version asks again.
  const { accuracyConfirmed: _confirmedEarlier, ...unconfirmed } = resume;
  const updated: Resume = {
    ...unconfirmed,
    updatedAt: createdAt,
    versionCount: version,
    currentVersionId: versionId,
  };
  store.state.resumes = store.state.resumes.map((item) => (item.id === resume.id ? updated : item));
  store.state.resumeVersions = [
    ...store.state.resumeVersions,
    { id: versionId, resumeId: resume.id, version, createdAt, changeNote: note },
  ];
  return { resume: updated, versionId };
}

/** Stores the body against the version the edit just minted, so the two never disagree. */
export function saveContent(
  store: MockStore,
  id: string,
  content: ResumeContent,
  versionId: string,
): ResumeContent {
  const stored: ResumeContent = { ...content, versionId };
  store.state.contents[id] = stored;
  // The same body filed under its version, so §7.11's restore has something to go back to.
  // Without this a restore can only re-stamp the current text and looks like it did nothing.
  store.state.contentVersions[versionId] = stored;
  return stored;
}
