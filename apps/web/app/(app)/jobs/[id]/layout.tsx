import type { ReactNode } from 'react';

/**
 * The job's page, plus a slot for what opens over it (redesign R5d): tailoring, intercepted
 * from this page so it draws as a drawer with the page still underneath (`@modal/(.)tailor`).
 */
export default function Layout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
