// Re-export shim. This module moved to @nextkin/shared when the web app landed; the app keeps
// importing it from `@/data/*` so the data-layer boundary and its lint fence are unchanged.
export * from '@nextkin/shared/models/jd';
export type { JdReading, JdSectionKind } from '@nextkin/shared/jobs/jdSections';
export type { PlausibilityNote } from '@nextkin/shared/scoring/plausibility';
// The structured job's wording (toreview §154), shared with the web so both say a fact the same way.
export {
  APPLICATION_LABEL,
  ELIGIBILITY_LABEL,
  LEVEL_LABEL,
  SKILL_GROUPS,
  WORK_MODE_LABEL,
  experienceText,
  locationText,
  payLabel,
  scheduleText,
} from '@nextkin/shared/jobs/jdLabels';
export { payText } from '@nextkin/shared/jobs/jdChecks';
