import type { ResumeSectionKey } from '@/data/models';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import type { ListRowArt } from '@/ui/ListRow';

import ProjectsIcon from '../../../assets/icons/resumes/projects.svg';

/**
 * The illustrated icon at the head of each editor section card (RESUMES 06, 577:6993 …
 * 577:7242). Five are the Profile row drawings, the same exports at the same aspect; Projects is
 * the "Documents" drawing (577:7158), which Profile has no row for.
 */
export const RESUME_SECTION_ART: Record<ResumeSectionKey, ListRowArt> = {
  summary: PROFILE_ROW_ART.terms,
  skills: PROFILE_ROW_ART.skills,
  experience: PROFILE_ROW_ART.experience,
  projects: { Icon: ProjectsIcon, w: 30, h: 19.7865 },
  certifications: PROFILE_ROW_ART.certifications,
  education: PROFILE_ROW_ART.education,
};

/** Width the section icons are drawn at on the 390 board (owner, 2026-11-09: 30 read too small, §202). */
export const SECTION_ART_WIDTH = 40;
