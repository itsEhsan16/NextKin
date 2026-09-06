import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import type { Job } from '@/data/models';
import { useJob, useJobsByCompany } from '@/data/queries';
import { openExternalUrl } from '@/lib';
import { useTheme } from '@/theme';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { CompanyHero } from '../components/CompanyHero';
import { CompanySkeleton } from '../components/CompanySkeleton';
import { SimilarJobCard } from '../components/SimilarJobCard';
import { useJobsActions } from '../hooks/useJobsActions';

export type CompanyScreenProps = { jobId: string };

/** Said on the page, not in a toast: a pushed screen sits above every toast host in the app. */
const WEBSITE_UNAVAILABLE = 'Nothing on this device could open that address';

/** Height of a `SimilarJobCard`, so the placeholder rows do not resize when the roles land. */
const ROLE_ROW = 88;

/** Fixtures store a bare host ("stripe.com"); a real provider will return a full URL. */
const hostOf = (website: string): string =>
  website
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '');

const urlOf = (website: string): string =>
  /^https?:\/\//i.test(website) ? website : `https://${website}`;

/**
 * The employer behind a listing (V2 §7.13): who they are, where to read more, and their other
 * open roles. Spec-derived — no artboard exists — so it is assembled from built primitives only.
 *
 * No sticky action bar. Every action worth taking here belongs to a *specific* role and lives on
 * the rows below; a bar pinned to a reference page would have to invent a page-level verb the
 * company itself does not have.
 */
export function CompanyScreen({ jobId }: CompanyScreenProps) {
  const { spacing } = useTheme();
  const actions = useJobsActions();

  const job = useJob(jobId);
  // The route carries a JOB id, not a company, so the listings query cannot be asked for anything
  // until the job has been read. An empty name disables it — and a disabled query stays
  // `isPending` for ever, which is why the section's loading branch tests `company` as well.
  const company = job.data?.company ?? '';
  const listings = useJobsByCompany(company);

  const [message, setMessage] = useState<string | null>(null);
  const openWebsite = useCallback((website: string) => {
    setMessage(null);
    void openExternalUrl(urlOf(website)).then((result) => {
      // The wrapper returns 'unavailable' rather than throwing, and a silent no-op would leave
      // the reader tapping a dead row.
      if (result === 'unavailable') setMessage(WEBSITE_UNAVAILABLE);
    });
  }, []);

  const page = (children: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={job.data?.company ?? 'Company'} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
    >
      {children}
    </Screen>
  );

  // Gated on the id for the same reason as above: without one the query never runs, so falling
  // through to the error state is right and pulsing for ever is not.
  if (jobId.length > 0 && job.isPending) return page(<CompanySkeleton />);

  if (job.isError || !job.data) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load this company"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void job.refetch()}
        style={{ marginTop: spacing[6] }}
      />,
    );
  }

  const current = job.data;
  const website = hostOf(current.companyWebsite);
  // The reader arrived from this job and is already looking at it, so it is never one of the
  // "other" roles. Filtered here rather than in the repo, which stays a plain listing.
  const otherRoles = (listings.data ?? []).filter((role) => role.id !== current.id);

  return page(
    <>
      <CompanyHero job={current} />

      <View style={{ gap: spacing[2] }}>
        <RowGroup>
          <ListRow
            icon="external-link-alt"
            label={website}
            accessibilityLabel={`Website, ${website}`}
            accessibilityHint="Opens in your browser"
            onPress={() => openWebsite(current.companyWebsite)}
          />
        </RowGroup>
        {message ? (
          <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </View>

      {current.companyAbout ? (
        <View style={{ gap: spacing[3] }}>
          <Text variant="section" accessibilityRole="header">
            About
          </Text>
          <Text variant="prose" color="textBody">
            {current.companyAbout}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: spacing[3] }}>
        <Text variant="section" accessibilityRole="header">
          {`Open roles at ${current.company}`}
        </Text>
        <CompanyRoles
          company={current.company}
          roles={otherRoles}
          loading={company.length > 0 && listings.isPending}
          failed={listings.isError}
          onRetry={() => void listings.refetch()}
          onOpen={actions.openJob}
        />
      </View>
    </>,
  );
}

type CompanyRolesProps = {
  company: string;
  roles: readonly Job[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (job: Job) => void;
};

/**
 * The listings section's own four states. A failed listings query is *not* the page failing: the
 * hero and the About copy are still worth reading, so only this section degrades.
 */
function CompanyRoles({ company, roles, loading, failed, onRetry, onOpen }: CompanyRolesProps) {
  const { spacing, s } = useTheme();

  if (loading) {
    return (
      <View style={{ gap: spacing[3] }}>
        {[0, 1].map((index) => (
          <Skeleton key={index} height={s(ROLE_ROW)} radius="card" />
        ))}
      </View>
    );
  }

  if (failed) {
    return (
      <StateView
        compact
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load these roles"
        message="The rest of this page still loaded."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }

  // A real case, not a fallback: most employers in the listings we hold have exactly one opening.
  if (roles.length === 0) {
    return (
      <StateView
        compact
        icon="briefcase"
        title="No other open roles right now"
        message={`This is the only ${company} listing we have today.`}
      />
    );
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {roles.map((role) => (
        <SimilarJobCard key={role.id} job={role} onPress={onOpen} />
      ))}
    </View>
  );
}
