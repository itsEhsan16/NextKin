import { View } from 'react-native';

import type { Job } from '@/data/models';
import { CARD_GAP } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { JobCard } from './JobCard';
import { discoverNote } from './jobCardMeta';

/** The open-role card's height on JOBS 09 (580:1707), so the placeholder does not resize. */
const ROLE_CARD = 191.5 / 0.75;

export type CompanyRolesProps = {
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
export function CompanyRoles({
  company,
  roles,
  loading,
  failed,
  onRetry,
  onOpen,
}: CompanyRolesProps) {
  const { s } = useTheme();
  const styles = useStyles();

  if (loading) {
    return (
      <View style={styles.cards}>
        <Skeleton height={s(ROLE_CARD)} radius="cardLg" />
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
    <View style={styles.cards}>
      {roles.map((role) => (
        <JobCard
          key={role.id}
          job={role}
          variant="company"
          footer={discoverNote(role)}
          onPress={onOpen}
        />
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  cards: { gap: s(CARD_GAP) },
}));
