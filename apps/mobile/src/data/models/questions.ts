// Re-export shim: "Did you use this here?" is pure state in @nextkin/shared so web and mobile ask
// the same questions (toreview §206.3); the app reads it from `@/data/*` like every model.
export * from '@nextkin/shared/tailor/questions';
