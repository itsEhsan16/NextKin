import { Redirect } from 'expo-router';

/** Merged into the job step, which says a blocked link inline (toreview.md §172). */
export default function BuildUnreadableRoute() {
  return (
    <Redirect
      href={{
        pathname: '/create/build/add',
        params: { notice: 'That site blocks reading. Paste the job description instead.' },
      }}
    />
  );
}
