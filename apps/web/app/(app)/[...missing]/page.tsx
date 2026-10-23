import { notFound } from 'next/navigation';

/**
 * Any address under the app that no route claims. Real routes win over this catch-all, so it only
 * ever hands a stray link to `not-found.tsx`, which draws inside the app's shell (§85).
 */
export default function MissingPage() {
  notFound();
}
