import type { AtsScore, DocumentContent, Job, Resume } from '../models';
import { clone, type MockStore } from './state';

/**
 * Files a document the server generated into the app's library (ImBackendImplementationPlan P9-08),
 * under the server's ids, so the ready screen, the editor and the score panel read it like any
 * other. A bridge until P10 serves the library; the same precedent as P7's imports.
 */
export interface AdoptedDocument {
  resume: Resume;
  content: DocumentContent;
  score?: AtsScore;
}

export function adoptDocument(store: MockStore, doc: AdoptedDocument): void {
  const { resume, content, score } = doc;
  store.state.resumes = [clone(resume), ...store.state.resumes.filter((r) => r.id !== resume.id)];
  store.state.contents[resume.id] = clone(content);
  store.state.contentVersions[resume.currentVersionId] = clone(content);
  if (!store.state.resumeVersions.some((v) => v.id === resume.currentVersionId)) {
    store.state.resumeVersions = [
      ...store.state.resumeVersions,
      { id: resume.currentVersionId, resumeId: resume.id, version: resume.versionCount, createdAt: resume.updatedAt, changeNote: 'Generated' },
    ];
  }
  if (score) store.state.atsScores[resume.id] = clone(score);
  else delete store.state.atsScores[resume.id];
}

/**
 * Files a server listing into the mock store (P11-11), so the flows that stay on the mock and look
 * jobs up there (applying, D-05; tailoring a library resume) can act on it under its server id.
 */
export function adoptJob(store: MockStore, job: Job): void {
  store.state.jobs = [clone(job), ...store.state.jobs.filter((j) => j.id !== job.id)];
}
