import { CLERK_ENABLED } from './clerk';
import { auth, SIGN_IN, USES_BACKEND } from './dataSource';
import { showToast } from './toast';

/**
 * Signs this browser out (owner, 2026-11-04, toreview §164): the server ends the session and
 * clears its cookie, then a full load of the sign-in screen drops every cached query of the
 * session that just ended. On the mock there is no session, so it only goes to the sign-in screen.
 * A failed request keeps the user where they are and says so, rather than seeming signed out.
 * With Clerk (toreview §169) the browser's Clerk session ends too: otherwise the sign-in screen
 * would see it still live and sign straight back in.
 */
/** `destination` is where a signed-out browser lands: staff go to the staff sign-in. */
/**
 * `afterDelete`: the account is already gone, so the server may refuse the logout. Leave anyway:
 * a deleted account must never be left with a live page (audit ST-09).
 */
export async function signOut(
  destination: string = SIGN_IN,
  { afterDelete = false }: { afterDelete?: boolean } = {},
): Promise<void> {
  if (USES_BACKEND) {
    try {
      await auth.logout();
    } catch {
      if (!afterDelete) {
        showToast("You weren't signed out. Check your connection and try again.", {
          tone: 'error',
        });
        return;
      }
    }
    if (CLERK_ENABLED) await clerkSignOut();
  }
  window.location.assign(destination);
}

/** Clerk's browser object, which ClerkProvider puts on `window`; best effort, the server already ended the session. */
async function clerkSignOut(): Promise<void> {
  const clerk = (window as { Clerk?: { signOut(): Promise<unknown> } }).Clerk;
  await clerk?.signOut().catch(() => {});
}
