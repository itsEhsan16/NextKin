// Re-export shim. This module moved to @nextkin/shared when the web app landed; the app keeps
// importing it from `@/data/*` so the data-layer boundary and its lint fence are unchanged.
export * from '@nextkin/shared/queries';

// Mobile-only helpers over the shared hooks.
export { useQueriesSettled } from './useQueriesSettled';
export { useBackendServiceStatus } from './useBackendServiceStatus';
export { useIsOnline } from './useIsOnline';
export {
  backendAuth,
  beginMockAccount,
  googleSignInAvailable,
  useConfirmSignUp,
  useGoogleSignIn,
  usePasswordSignIn,
  useResendSignUpCode,
  useStartSignUp,
} from './useAuth';
// The account screen's password change: on Clerk the password changes there (§173).
export { useChangeSignInPassword } from './useChangePassword';
