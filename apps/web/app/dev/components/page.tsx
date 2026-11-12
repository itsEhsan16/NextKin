import { notFound } from 'next/navigation';

import { ComponentShowcase } from '@/features/dev/ComponentShowcase';

/** Development only (redesign R3d): the primitives in every state. A production build 404s. */
export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ComponentShowcase />;
}
