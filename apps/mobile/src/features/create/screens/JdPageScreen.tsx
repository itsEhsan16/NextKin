import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import Animated from 'react-native-reanimated';

import { profileKeywordFit, REMOTE_TYPE_LABEL, type JdDraft } from '@/data/models';
import {
  WORK_MODE_LABEL,
  experienceText,
  locationText,
  payLabel,
  type JdReading,
} from '@/data/models/jd';
import { useJdJob, useStall } from '@/data/queries';
import { JobAboutSection } from '@/features/jobs/components/JobAboutSection';
import { useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { FlowCard } from '@/ui/kit';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { BuildReviewCard, type JdHeroFact } from '../components/BuildReviewCard';
import { JdSectionCard } from '../components/jd/JdSectionCard';
import { BuildReviewSkeleton } from '../components/BuildReviewSkeleton';
import { JdDoubleCheck } from '../components/JdDoubleCheck';
import { JdReadingSections } from '../components/JdReadingSections';
import { JdFactsCard, JdWorthKnowing } from '../components/jd/JdFactsCard';
import { JdStructuredSections } from '../components/jd/JdStructuredSections';
import { isNotFound } from '../buildInput';

export type JdPageScreenProps = { draftId: string };

/** The hero's fact chips (§180): pay, how and where, and the years asked, as the job states them. */
function heroFacts(draft: JdDraft, posting: JdReading | undefined): JdHeroFact[] {
  const s = draft.structured;
  const pay = s ? payLabel(s) : undefined;
  const place = s ? locationText(s) : undefined;
  const years = s ? experienceText(s.experience) : undefined;
  const out: (JdHeroFact | null)[] = s
    ? [
        pay ? { icon: 'CreditCard01', label: pay } : null,
        s.workMode ? { icon: 'Building02', label: WORK_MODE_LABEL[s.workMode.value] } : null,
        place ? { icon: 'MarkerPin01', label: place } : null,
        years ? { icon: 'Clock', label: years } : null,
      ]
    : [
        posting?.salary ? { icon: 'CreditCard01', label: posting.salary } : null,
        posting?.workArrangement
          ? { icon: 'Building02', label: REMOTE_TYPE_LABEL[posting.workArrangement] }
          : null,
        draft.location ? { icon: 'MarkerPin01', label: draft.location } : null,
      ];
  return out.filter((fact): fact is JdHeroFact => fact !== null);
}

/**
 * The whole job as NextKin read it (toreview §129.3, §145.4), mobile's side of the web's JD page.
 * Opened from BUILD 04 and Customize's Details, it is somewhere to read and correct the job, so it
 * has no action of its own: Back returns to the flow. It keeps to what the job said. The web page's
 * match card is left to Customize, which scores the same job right after this. Spec-derived from
 * BUILD 04's card and the job page's sections.
 *
 * A job read into its structure (toreview §153–§154) is drawn from it: key facts with their
 * source, anything worth knowing, then each section in its place. NextKin owns that reading
 * (owner, 2026-11-03), so its card has no pencil; a job without one keeps the old page.
 */
export function JdPageScreen({ draftId }: JdPageScreenProps) {
  const { spacing } = useTheme();
  const router = useRouter();
  const { draft, view } = useJdJob(draftId);
  const reading = draft.data?.status === 'extracting';
  // The draft is fetched again while it is read (useJdDraft); a reading that never lands says so.
  const stall = useStall(reading, draftId);
  const [fullOpen, setFullOpen] = useState(false);
  const enter = useRevealStagger(!!view && !reading);

  const page = (children: ReactNode) => (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="The job" onBack={() => router.back()} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
    >
      {children}
    </Screen>
  );

  if (draft.isError) {
    return isNotFound(draft.error)
      ? page(
          <StateView
            icon="Briefcase01"
            title="We lost that job"
            message="Add it again to read it here."
            actionLabel="Back"
            onAction={() => router.back()}
          />,
        )
      : page(
          <StateView
            tone="danger"
            icon="AlertTriangle"
            title="Couldn't load the job"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void draft.refetch()}
          />,
        );
  }

  if (reading && stall === 'stalled') {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="We couldn't finish reading this job"
        message="Check again in a moment, or add the job again."
        actionLabel="Check again"
        onAction={() => void draft.refetch()}
      />,
    );
  }

  if (!draft.data || !view || reading) return page(<BuildReviewSkeleton />);

  const { job, reading: posting, plausibility } = view;
  const aboutTheRole =
    job.description.length > 0 || job.responsibilities.length > 0 || job.requirements.length > 0;
  const structured = draft.data.structured;
  const facts = heroFacts(draft.data, posting);
  const fullText = (
    <FlowCard style={{ paddingVertical: spacing[1] }}>
      <Disclosure
        mode="row"
        title="The full job description"
        expanded={fullOpen}
        onToggle={() => setFullOpen((open) => !open)}
      >
        <Text variant="prose" color="textBody" selectable>
          {draft.data.rawText}
        </Text>
      </Disclosure>
    </FlowCard>
  );

  if (structured) {
    return page(
      <>
        <Animated.View entering={enter(0)}>
          <BuildReviewCard
            draft={draft.data}
            facts={facts}
            asks={profileKeywordFit(draft.data, []).map((keyword) => keyword.label)}
          />
        </Animated.View>
        <Animated.View entering={enter(1)} style={{ gap: spacing[6] }}>
          <JdWorthKnowing issues={structured.issues} />
          <JdFactsCard s={structured} />
          <JdDoubleCheck notes={plausibility} />
          <JdStructuredSections s={structured} />
          {fullText}
        </Animated.View>
      </>,
    );
  }

  return page(
    <>
      <Animated.View entering={enter(0)}>
        <BuildReviewCard
          draft={draft.data}
          facts={facts}
          asks={profileKeywordFit(draft.data, []).map((keyword) => keyword.label)}
          onEdit={() => router.push({ pathname: '/create/jd-review', params: { draftId } })}
        />
      </Animated.View>
      <Animated.View entering={enter(1)} style={{ gap: spacing[6] }}>
        <JdDoubleCheck notes={plausibility} />
        {aboutTheRole ? (
          <JdSectionCard title="About the role">
            <JobAboutSection
              bare
              description={job.description}
              responsibilities={job.responsibilities}
              requirements={job.requirements}
            />
          </JdSectionCard>
        ) : null}
        <JdReadingSections
          reading={posting}
          withResponsibilities={job.responsibilities.length === 0}
        />
        {fullText}
      </Animated.View>
    </>,
  );
}
