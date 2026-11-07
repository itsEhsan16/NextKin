import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Loading shape of PROFILE 01: identity row, stats bar, completeness card, plan row, a group. */
export function ProfileSkeleton() {
  const { s } = useTheme();

  // A fragment: the blocks are the scroller's own children, spaced by its gap like the cards.
  return (
    <>
      <Skeleton height={s(84)} radius="card" />
      <Skeleton height={s(154)} radius="card" />
      <Skeleton height={s(72)} radius="card" />
      <Skeleton height={s(290)} radius="card" />
    </>
  );
}

/** The identity row (avatar, name, headline) as one block, in the header where it lands (§191). */
export function ProfileIdentitySkeleton() {
  const { s } = useTheme();
  return <Skeleton height={s(104)} radius="card" />;
}
