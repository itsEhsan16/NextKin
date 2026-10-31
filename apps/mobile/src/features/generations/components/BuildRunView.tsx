import { useMemo } from 'react';
import { View } from 'react-native';

import { buildChanges, profileKeywordFit, type Generation } from '@/data/models';
import {
  useCurrentUser,
  useJdDraft,
  useJob,
  useProfile,
  useResume,
  useResumeContent,
} from '@/data/queries';
import { FLOW_ART } from '@/features/create/components/FlowHero';
// Deep imports on purpose: the resumes barrel drags its screens in.
import { ResumeExportHost } from '@/features/resumes/ResumeExportHost';
import { useResumesStore } from '@/features/resumes/resumesStore';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Reveal } from '@/ui/motion';

import { useGenerationsActions } from '../hooks/useGenerationsActions';
import { BuildAlmostThere } from './BuildAlmostThere';
import { BuildBandPill, BuildNextTiles } from './BuildReadyParts';
import { BUILD_CARD_TITLE, BUILD_LEDE, buildProgressRows, buildProgressTitle } from './buildRun';
import { ResumePagePreview } from './ResumePagePreview';
import { TailorChrome } from './TailorChrome';
import { TailorProgress } from './TailorProgress';
import { TailorReady } from './TailorReady';
import { resumeBody, siteHost } from './TailorRunView';

export type BuildRunViewProps = { generation: Generation };

// Close bar → first block: 29 on BUILD 05 (653:128 → 661:34), 4 on BUILD 06 (653:229), at 390.
const BAR_TO_ART = 29 / 0.75;
const BAR_TO_PREVIEW = 4 / 0.75;
const CARD_TO_NOTE = 12 / 0.75; // 653:172
/** BUILD 06's Edit button is 100 wide at 390 (653:329); Download PDF takes the rest. */
const EDIT_W = 100 / 0.75;

/**
 * BUILD 05–07: Home's Build Resume run — a resume built from the profile for one job — watched
 * and then delivered. No stepper on this flow, only the ✕. Download PDF raises the app's download
 * sheet (BUILD 07), the one the editor and the library use, on its own mount above this screen.
 */
export function BuildRunView({ generation }: BuildRunViewProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useGenerationsActions();
  const openExport = useResumesStore((state) => state.openExport);
  const resumeId = generation.resumeId ?? '';
  const jobId = generation.jobId;
  const ready = generation.status === 'ready';

  const job = useJob(jobId ?? '');
  const draft = useJdDraft(generation.jdId ?? '');
  const profile = useProfile();
  const resume = useResume(resumeId);
  const content = useResumeContent(ready ? resumeId : '');
  const user = useCurrentUser();

  const company = draft.data?.company ?? job.data?.company;
  const website = jobId ? job.data?.companyWebsite : undefined;
  const domain = website ? siteHost(website) || undefined : undefined;
  // Only once both have loaded: a change list read off half the inputs would claim too little.
  // The fit is read against the profile as it was before 04c added anything, so a skill the
  // user added reads as added, not as already there.
  const changes = useMemo(() => {
    if (!draft.data || !profile.data) return [];
    const added = new Set((generation.build?.added ?? []).map((label) => label.toLowerCase()));
    const before = profile.data.skills.filter((skill) => !added.has(skill.toLowerCase()));
    return buildChanges(company, profileKeywordFit(draft.data, before), generation.build);
  }, [company, draft.data, generation.build, profile.data]);

  const close = () => actions.closeBuild(jobId);
  const edit = () => {
    if (resumeId) actions.openDocument(resumeId);
  };
  const download = () => {
    if (resume.data) openExport(resume.data, 'run');
  };
  const name = user.data ? `${user.data.firstName} ${user.data.lastName}`.trim() : '';
  const score = resume.data?.atsScore;

  return (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<TailorChrome onClose={close} />}
        headerStyle={{ paddingBottom: s(ready ? BAR_TO_PREVIEW : BAR_TO_ART) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={
          // The run's two bars cross-fade, like the page above them (§85).
          <Reveal stateKey={ready ? 'ready' : 'writing'}>
            {ready ? (
              <StickyActionBar
                floating
                secondary={{ label: 'Edit', onPress: edit, style: { flexBasis: s(EDIT_W) } }}
                primary={{
                  label: 'Download PDF',
                  icon: 'Download01',
                  haptic: 'medium',
                  disabled: !resume.data,
                  onPress: download,
                }}
              />
            ) : (
              <StickyActionBar
                floating
                // The run keeps going without this screen; the notification says when it lands.
                primary={{
                  label: 'Leave and notify me',
                  icon: 'Bell01',
                  variant: 'ghost',
                  onPress: close,
                }}
              />
            )}
          </Reveal>
        }
      >
        {/* The finished resume fades in over the progress card instead of cutting to it. */}
        <Reveal stateKey={ready ? 'ready' : 'writing'}>
          {ready ? (
            <>
              <ResumePagePreview content={resumeBody(content.data)} name={name} score={score} />
              <TailorReady
                company={company}
                domain={domain}
                score={score}
                onSeeAll={edit}
                pill={<BuildBandPill score={score} />}
                changes={changes}
                next={
                  <BuildNextTiles
                    // A letter is written for a job; a pasted or uploaded one is not on NextKin.
                    onCoverLetter={
                      jobId && resumeId ? () => actions.openCoverLetterSetup(resumeId) : undefined
                    }
                    onInterview={() => {
                      if (resumeId) actions.openInterviewSetup(resumeId);
                    }}
                  />
                }
              />
            </>
          ) : (
            <>
              <TailorProgress
                generation={generation}
                art={FLOW_ART.buildWriting}
                title={buildProgressTitle(company)}
                lede={BUILD_LEDE}
                cardTitle={BUILD_CARD_TITLE}
                rows={buildProgressRows(generation)}
                footnote={null}
              />
              <View style={styles.note}>
                <BuildAlmostThere />
              </View>
            </>
          )}
        </Reveal>
      </Screen>

      {/* BUILD 07: a sibling of the page, so its sheet and toast sit above the run. */}
      <ResumeExportHost surface="run" />
    </>
  );
}

const useStyles = scaledSheet((s) => ({
  note: { marginTop: s(CARD_TO_NOTE) },
}));
