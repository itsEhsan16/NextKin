import { auth, SIGN_IN, USES_BACKEND } from './dataSource';
import { showToast } from './toast';

/**
 * Signs this browser out (owner, 2026-11-04, toreview §164): the server ends the session and
 * clears its cookie, then a full load of the sign-in screen drops every cached query of the
 * session that just ended. On the mock there is no session, so it only goes to the sign-in screen.
 * A failed request keeps the user where they are and says so, rather than seeming signed out.
 */
/** `destination` is where a signed-out browser lands: staff go to the staff sign-in. */
export async function signOut(destination: string = SIGN_IN): Promise<void> {
  if (USES_BACKEND) {
    try {
      await auth.logout();
    } catch {
      showToast("You weren't signed out. Check your connection and try again.", { tone: 'error' });
      return;
    }
  }
  window.location.assign(destination);
}
