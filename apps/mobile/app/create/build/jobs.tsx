import { Redirect } from 'expo-router';

/** Merged into the job step (toreview.md §172); kept so old links still land somewhere. */
export default function BuildChooseJobRoute() {
  return <Redirect href="/create/build" />;
}
