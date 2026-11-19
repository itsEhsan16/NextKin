import { isLegalDocKey, LEGAL_DOC_TITLE } from '@nextkin/shared/models';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalDocScreen } from '@/features/publicPages/LegalDocScreen';

/** The public privacy policy and terms (V2 §8.5): open to anyone, no session, crawlable. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  return { title: isLegalDocKey(doc) ? `${LEGAL_DOC_TITLE[doc]} · NextKin` : 'NextKin' };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isLegalDocKey(doc)) notFound();
  return <LegalDocScreen doc={doc} />;
}
