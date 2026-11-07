import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { APPLICATION_STATUS_CHOICES, followUpDue, type ApplicationStatus } from '@/data/models';
import {
  queryPhase,
  useApplications,
  useCheckInApplication,
  useUpdateApplicationStatus,
} from '@/data/queries';
import { formatDaysAgo, formatWeekdayDate } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { NoteBar } from '@/ui/NoteBar';
import { OptionSheet } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SelectField } from '@/ui/SelectField';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { showAppToast } from '@/ui/Toast';

import { NO_INTERVIEW_DAY, interviewDayOptions } from '../applicationDays';
import { ApplicationPractice } from '../components/ApplicationPractice';
import { useJobsActions } from '../hooks/useJobsActions';

export type ApplicationScreenProps = { id: string };

export const APPLICATION_TITLE = 'Your application';
export const APPLICATION_NOTE =
  'NextKin can’t see what employers do, so this only shows what you tell us.';
export const APPLICATION_SAVE_FAILED =
  "We couldn't save that. Check your connection and try again.";
const NO_NEWS = 'No news yet';

const statusLabel = (status: ApplicationStatus): string =>
  APPLICATION_STATUS_CHOICES.find((choice) => choice.status === status)?.label ?? NO_NEWS;

type Sheet = 'status' | 'day' | null;

/**
 * One application (owner, 2026-11-01, toreview §147.1): where a follow-up lands, and the place to say
 * where it stands. Spec-derived from the app's fields and sheets; no artboard draws it.
 */
export function ApplicationScreen({ id }: ApplicationScreenProps) {
  const { spacing, s } = useTheme();
  const actions = useJobsActions();
  const applications = useApplications();
  const update = useUpdateApplicationStatus();
  const checkIn = useCheckInApplication();
  const [sheet, setSheet] = useState<Sheet>(null);
  const status = queryPhase(applications);
  const row = applications.data?.find((item) => item.application.id === id);

  const page = (children: ReactNode, sheets?: ReactNode) => (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={APPLICATION_TITLE} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[4] }}
      >
        {children}
      </Screen>
      {sheets}
    </>
  );

  if (status === 'pending') {
    return page(
      <View accessible accessibilityLabel="Loading your application" style={{ gap: spacing[3] }}>
        <Skeleton height={s(120)} radius="card" />
        <Skeleton height={s(72)} radius="card" />
      </View>,
    );
  }

  if (status === 'error') {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your application"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void applications.refetch()}
      />,
    );
  }

  if (!row) {
    return page(
      <StateView
        icon="Briefcase01"
        title="This application is gone"
        message="It may have been removed from your applications."
        actionLabel="Back"
        onAction={actions.goBack}
      />,
    );
  }

  const { application, job } = row;
  const failed = { onError: () => showAppToast(APPLICATION_SAVE_FAILED, 'error') };
  const interview = application.status === 'interview';

  const setStatus = (next: ApplicationStatus) => {
    setSheet(null);
    update.mutate({ id, status: next }, failed);
  };
  const setDay = (key: string) => {
    setSheet(null);
    update.mutate(
      { id, status: 'interview', interviewAt: key === NO_INTERVIEW_DAY ? null : key },
      failed,
    );
  };

  return page(
    <>
      <Card radius="card">
        <View style={{ gap: spacing[1] }}>
          <Text variant="title">{job.title}</Text>
          <Text variant="body" color="textBody">
            {job.company}
          </Text>
          <Text variant="caption" color="textSecondary">
            {`Applied ${formatDaysAgo(application.appliedAt)}`}
          </Text>
        </View>
        <Button
          label="View the job"
          variant="secondary"
          block
          onPress={() => actions.openJob(job)}
          style={{ marginTop: spacing[4] }}
        />
      </Card>

      {followUpDue(application, new Date()) ? (
        <Card radius="card">
          <Text variant="title">{`Any news from ${job.company}?`}</Text>
          <Text variant="body" color="textBody" style={{ marginTop: spacing[1] }}>
            If you’ve heard back, change where it stands below.
          </Text>
          <Button
            label={NO_NEWS}
            variant="secondary"
            block
            loading={checkIn.isPending}
            onPress={() => checkIn.mutate(id, failed)}
            style={{ marginTop: spacing[4] }}
          />
        </Card>
      ) : null}

      <SelectField
        label="Where it stands"
        icon="CheckCircle"
        value={statusLabel(application.status)}
        hint="Opens the list"
        open={sheet === 'status'}
        onPress={() => setSheet('status')}
      />
      {interview ? (
        <SelectField
          label="Interview day"
          icon="Calendar"
          value={application.interviewAt ? formatWeekdayDate(application.interviewAt) : undefined}
          placeholder="Not set"
          hint="We’ll remind you the day before"
          open={sheet === 'day'}
          onPress={() => setSheet('day')}
        />
      ) : null}

      {interview ? <ApplicationPractice application={application} job={job} /> : null}

      <NoteBar text={APPLICATION_NOTE} />
    </>,
    <>
      <OptionSheet
        open={sheet === 'status'}
        title="Where it stands"
        options={APPLICATION_STATUS_CHOICES.map((choice) => ({
          key: choice.status,
          label: choice.label,
        }))}
        selectedKey={application.status}
        onSelect={setStatus}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        open={sheet === 'day'}
        title="Interview day"
        options={interviewDayOptions(new Date())}
        selectedKey={application.interviewAt ?? NO_INTERVIEW_DAY}
        onSelect={setDay}
        onClose={() => setSheet(null)}
      />
    </>,
  );
}
