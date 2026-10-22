import { RESUME_SECTION_LABEL, type ResumeSectionKey } from '@nextkin/shared/models/resumeContent';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import { lockResume, writeResumeVersion } from '../../services/versions';
import { StageError, type StageDef } from '../stages';
import { readRun } from './common';
import type { ValidationOutput } from './validate';

/**
 * Regenerating one section (ImBackendImplementationPlan P10-02; V2 §7.11). The run goes through the
 * same jd → plan → generate → validate stages as a whole resume, so the new section is held to the
 * claim ledger and the timeline checks; `persist` then takes only that section from the validated
 * draft and lays it over the document as it stands now, so the user's edits elsewhere survive.
 * Role headers stay as the user has them: a regenerated experience section replaces bullets only.
 */

export function withRegenerated(current: CanonicalResumeJson, fresh: CanonicalResumeJson, section: ResumeSectionKey): CanonicalResumeJson {
  switch (section) {
    case 'summary':
      return fresh.summary ? { ...current, summary: fresh.summary } : current;
    case 'skills':
      return { ...current, skills: fresh.skills };
    case 'experience':
      return { ...current, roles: current.roles.map((role) => ({ ...role, bullets: fresh.roles.find((r) => r.roleId === role.roleId)?.bullets ?? role.bullets })) };
    case 'projects':
      return { ...current, projects: current.projects.map((p) => { const next = fresh.projects.find((x) => x.factId === p.factId); return next && next.bullets.length ? { ...p, bullets: next.bullets } : p; }) };
    case 'certifications':
      return { ...current, certifications: fresh.certifications };
    case 'education':
      return { ...current, education: fresh.education };
  }
}

export const sectionPersistStage: StageDef = {
  name: 'persist',
  status: 'scoring',
  async run(ctx) {
    const run = readRun(ctx.run);
    const section = run.section;
    const resumeId = run.sourceResumeId;
    if (!section || !resumeId) throw new StageError('no_section', 'Choose the section to regenerate.');
    const fresh = (ctx.outputs.validate as ValidationOutput).document;
    const versionId = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, async (tx) => {
      // A redelivered run that already wrote its version reuses it.
      const existing = await tx.selectFrom('resume_versions').select('id').where('generation_id', '=', ctx.generationId).executeTakeFirst();
      if (existing) return existing.id;
      const row = await lockResume(tx, resumeId);
      if (row.doc_type !== 'resume' || !row.current_version_id) throw new StageError('no_source', 'That document is not a resume.');
      const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', row.current_version_id).executeTakeFirstOrThrow();
      const current = canonicalResumeSchema.parse(version.content);
      return writeResumeVersion(tx, {
        userId: ctx.userId,
        resumeId,
        jdId: row.job_description_id,
        doc: canonicalResumeSchema.parse(withRegenerated(current, fresh, section)),
        note: `Regenerated ${RESUME_SECTION_LABEL[section]}`,
        createdBy: 'generation',
        generationId: ctx.generationId,
        // An AI rewrite reads only the resume's own lines (toreview §113–§114).
        ...(run.instruction ? { inheritAccuracy: true } : {}),
      });
    });
    return { output: { resumeId, versionId } };
  },
};
