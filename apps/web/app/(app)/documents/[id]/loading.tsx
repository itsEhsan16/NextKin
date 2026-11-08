import { RouteSkeleton } from '@/ui/RouteSkeleton';

/** Shown while the server renders this page (§196); it also lets links prefetch it. */
export default function Loading() {
  return <RouteSkeleton />;
}
