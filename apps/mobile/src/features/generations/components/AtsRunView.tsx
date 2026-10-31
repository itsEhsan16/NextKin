import type { Generation } from '@/data/models';
import { useCancelGeneration, useJdDraft } from '@/data/queries';
import { FLOW_ART } from '@/features/create/components/FlowHero';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Reveal, useBecameTrue } from '@/ui/motion';

import { useGenerationsActions } from '../hooks/useGenerationsActions';
import { AtsResult } from './AtsResult';
import {
  ATS_CHECKING_LEDE,
  ATS_CHECKING_TITLE,
  atsCheckingCardTitle,
  atsProgressRows,
} from './atsRun';
import { TailorChrome } from './TailorChrome';
import { TailorProgress } from './TailorProgress';

// The ✕ bar → first block at 390: the drawing on ATS 02 (646:6), the verdict on ATS 03 (646:55).
const BAR_TO_ART = 16 / 0.75;
const BAR_TO_RESULT = 18 / 0.75;

export const ATS_FIX_NOTE = 'Saves a copy to your Resumes first';

/**
 * ATS 02–03 (646:2 / 646:51, toreview §73): a check of an outside resume against one job, watched
 * and then read. While the pipeline runs it is ATS 02's checklist with Cancel, which stops the run
 * and hands the check back; once ready it is the verdict, the missing keywords and the fixes, and
 * "Fix it for this job" carries the file into Tailor for that job.
 */
export function AtsRunView({ generation }: { generation: Generation }) {
  const { spacing, s } = useTheme();
  const actions = useGenerationsActions();
  const cancel = useCancelGeneration();
  const draft = useJdDraft(generation.jdId ?? '');
  const ready = generation.status === 'ready';
  const arrived = useBecameTrue(ready);
  const result = generation.atsCheck;
  const resumeId = generation.sourceResumeId ?? generation.resumeId ?? '';
  const company = result?.company ?? draft.data?.company;

  const fix = () => {
    if (!resumeId) return;
    // A saved job by its listing, a pasted description by its JD: Customize either way.
    if (generation.jobId) actions.openCustomize({ jobId: generation.jobId, resumeId });
    else if (generation.jdId) actions.openCustomize({ jdId: generation.jdId, resumeId });
  };

  let page;
  let footer;
  if (!ready) {
    page = (
      <TailorProgress
        generation={generation}
        title={ATS_CHECKING_TITLE}
        lede={ATS_CHECKING_LEDE}
        cardTitle={atsCheckingCardTitle(company)}
        rows={atsProgressRows(generation)}
        footnote={null}
        sparkle={false}
        art={FLOW_ART.atsChecking}
        // Analysis, not writing: a scan passes down the page being checked.
        motif="scan"
      />
    );
    footer = (
      <StickyActionBar
        floating
        primary={{
          label: 'Cancel',
          variant: 'ghost',
          loading: cancel.isPending,
          onPress: () => cancel.mutate(generation.id, { onSuccess: actions.goBack }),
        }}
      />
    );
  } else if (result) {
    page = (
      <AtsResult result={result} arrived={arrived} onRubric={() => actions.openRubric(resumeId)} />
    );
    footer = (
      <StickyActionBar
        floating
        note={ATS_FIX_NOTE}
        primary={{ label: 'Fix it for this job', haptic: 'medium', onPress: fix }}
      />
    );
  } else {
    // A check from before results were kept on the run: its score is on the document's panel.
    page = (
      <StateView
        icon="LineChartUp01"
        title="Your check is done"
        message="The result is on your resume's score panel."
        actionLabel="See the score"
        onAction={() => actions.openScore(resumeId)}
      />
    );
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<TailorChrome onClose={actions.goBack} />}
      headerStyle={{ paddingBottom: s(ready ? BAR_TO_RESULT : BAR_TO_ART) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      // The check melts into its verdict, and Cancel into "Fix it for this job" (§85).
      footer={footer ? <Reveal stateKey={ready ? 'ready' : 'checking'}>{footer}</Reveal> : null}
    >
      <Reveal stateKey={ready ? 'ready' : 'checking'}>{page}</Reveal>
    </Screen>
  );
}
