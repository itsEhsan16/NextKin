import { notFound } from 'next/navigation';

import { DevSignIn } from '@/features/dev/DevSignIn';
import { USES_BACKEND } from '@/lib/dataSource';

/** Development only (P5-07): a production build, or a mock-only setup, has no such page. */
export default function DevSignInPage() {
  if (process.env.NODE_ENV === 'production' || !USES_BACKEND) notFound();
  return <DevSignIn />;
}
