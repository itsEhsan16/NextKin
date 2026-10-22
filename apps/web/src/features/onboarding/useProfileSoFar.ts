import { EXPERIENCE_BANDS, GOALS } from './onboardingOptions';
import type { OnboardingPage } from './onboardingSteps';
import { useOnboardingStore, type EducationAnswer } from './onboardingStore';
import type { ProfileSoFarRow } from './components/ProfileSoFar';

/** "B.Des · NID Ahmedabad, 2017": the degree before its comma, then where and when. */
function educationSummary(answer: EducationAnswer): string | undefined {
  const degree = answer.degree.split(',')[0]?.trim();
  const where = [answer.school.trim(), answer.year].filter(Boolean).join(', ');
  return joined(degree, where) || undefined;
}

const joined = (...parts: (string | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');

/**
 * The card's four rows, from the answers alone (807:36): "Better role · Lead UX Designer",
 * "6–10 yrs · Senior UX Designer". The Resume row stays a grey bar until there is a resume: on
 * ONB 04 even with "Yes" picked, and on ONB 04b until the file has been read (808:84). The quick
 * questions (05–07) swap Resume for "Recent job" and "Skills" (808:168, 808:172), and ONB 07
 * adds "Education" (808:344): "B.Des · NID Ahmedabad, 2017".
 */
export function useProfileSoFar(page: OnboardingPage): ProfileSoFarRow[] {
  const {
    name,
    goal,
    targetRole,
    experience,
    jobTitle,
    resumeFile,
    roles,
    noWork,
    skills,
    education,
  } = useOnboardingStore();
  const flow = page.flow;
  const goalShort = GOALS.find((option) => option.value === goal)?.short;
  const bandShort = EXPERIENCE_BANDS.find((band) => band.value === experience)?.short;

  const common: ProfileSoFarRow[] = [
    { label: 'Name', value: name?.trim() || undefined },
    { label: 'Goal', value: goalShort && joined(goalShort, targetRole) },
    { label: 'Experience', value: bandShort && joined(bandShort, jobTitle) },
  ];
  if (flow === 'questions') return [...common, { label: 'Resume', value: resumeFile }];

  const recent = roles?.[0];
  return [
    ...common,
    {
      label: 'Recent job',
      value: noWork ? 'Not yet' : recent && (joined(recent.title, recent.company) || undefined),
    },
    { label: 'Skills', value: skills?.length ? `${skills.length} picked` : undefined },
    ...(page.key === 'education'
      ? [{ label: 'Education', value: education && educationSummary(education) }]
      : []),
  ];
}
