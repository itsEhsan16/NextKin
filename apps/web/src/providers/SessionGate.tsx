'use client';

import { useEffect } from 'react';

import { auth, SIGN_IN, USES_BACKEND } from '@/lib/dataSource';

/**
 * The `(app)` shell's session guard (ImBackendImplementationPlan P5-07), behind the data-source
 * flag: on the mock there is no session to check and this does nothing. On the backend, a visit
 * without a live session goes to the sign-in screen. A session that ends later is caught by the
 * HTTP client itself: its first 401 sends the browser to the same page.
 */
export function SessionGate() {
  useEffect(() => {
    if (!USES_BACKEND) return;
    let active = true;
    auth.hasSession().then((live) => {
      if (active && !live) window.location.assign(SIGN_IN);
    });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
