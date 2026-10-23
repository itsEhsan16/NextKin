// Re-export shim. This module moved to @nextkin/shared when the web app landed; the app keeps
// importing it from `@/data/*` so the data-layer boundary and its lint fence are unchanged.
export * from '@nextkin/shared/queries';

// Mobile-only helpers over the shared hooks.
export { useQueriesSettled } from './useQueriesSettled';
export { usePrefetchActiveGeneration } from './usePrefetchActiveGeneration';
export { useBackendServiceStatus } from './useBackendServiceStatus';
export {
  backendAuth,
  useConfirmSignUp,
  usePasswordSignIn,
  useResendSignUpCode,
  useStartSignUp,
} from './useAuth';
