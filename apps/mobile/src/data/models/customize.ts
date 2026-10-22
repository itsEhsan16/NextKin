// Re-export shim: the Customize screen's pure state lives in @nextkin/shared so web and mobile
// start exactly the same run (toreview §114); the app reads it from `@/data/*` like every model.
export * from '@nextkin/shared/tailor/customize';
