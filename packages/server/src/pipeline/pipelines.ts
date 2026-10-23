import { JD_TEMPLATE } from '../services/jd';
import type { PipelineDef, RunKind } from './stages';
import { INTERVIEW_TEMPLATE, interviewCheckStage, interviewGroundStage, interviewPersistStage, interviewSourceStage, interviewWriteStage } from './stages/interview';
import { atsPersistStage, atsScoreStage, COVER_TEMPLATE, coverPersistStage, coverStage, sourceStage, ZERO_TEMPLATE, zeroPersistStage, zeroStage } from './stages/kinds';
import { persistStage, scoreStage } from './stages/persist';
import { generateStage, jdStage, planStage, RESUME_TEMPLATE, REVISE_TEMPLATE } from './stages/resume';
import { sectionPersistStage } from './stages/section';
import { validateStage } from './stages/validate';

/**
 * Which stages each kind runs (ImBackendImplementationPlan P9-03). Every stage is checkpointed by
 * the P6 runner, so each can be retried and tested on its own.
 *
 * | Kind | Stages | Output |
 * |---|---|---|
 * | resume | jd → plan → generate → validate → score → persist | a resume version with its claim ledger, timeline report and ATS report |
 * | zero_resume | jd → zero → persist | a version whose every claim is `assumed`; no score (D-15) |
 * | cover_letter | jd → source → letter → persist | a letter version and its `cover_letters` row |
 * | ats_check | source → jd → score → persist | an ATS report on the source version, and the check's result |
 * | interview | source → jd → ground → write → check → persist | a practice set; technical questions only on eligible skills, never on a flagged one (P11-08) |
 * | section | jd → plan → generate → validate → persist | one section of an existing resume, laid over its current version (P10-02) |
 *
 * `jd` is a no-op for a run with no JD; the extraction itself is `services/jd.ts`'s job.
 */
export const PIPELINES: Record<RunKind, PipelineDef> = {
  resume: {
    promptTemplate: RESUME_TEMPLATE,
    prompts: [RESUME_TEMPLATE, REVISE_TEMPLATE],
    stages: [jdStage, planStage, generateStage, validateStage, scoreStage, persistStage],
  },
  zero_resume: { promptTemplate: ZERO_TEMPLATE, prompts: [ZERO_TEMPLATE], stages: [jdStage, zeroStage, zeroPersistStage] },
  cover_letter: { promptTemplate: COVER_TEMPLATE, prompts: [COVER_TEMPLATE], stages: [jdStage, sourceStage, coverStage, coverPersistStage] },
  ats_check: { promptTemplate: JD_TEMPLATE, prompts: [JD_TEMPLATE], stages: [sourceStage, jdStage, atsScoreStage, atsPersistStage] },
  interview: { promptTemplate: INTERVIEW_TEMPLATE, prompts: [INTERVIEW_TEMPLATE], stages: [interviewSourceStage, jdStage, interviewGroundStage, interviewWriteStage, interviewCheckStage, interviewPersistStage] },
  section: {
    promptTemplate: RESUME_TEMPLATE,
    prompts: [RESUME_TEMPLATE, REVISE_TEMPLATE],
    stages: [jdStage, planStage, generateStage, validateStage, sectionPersistStage],
  },
};
