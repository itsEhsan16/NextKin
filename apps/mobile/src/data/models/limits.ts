// Re-export shim: the sizes the server checks, in one place (`limits.ts`, toreview §212.5, §262), so
// a box on the phone never takes more, or cuts more, than the server reads.
export * from '@nextkin/shared/schemas/limits';
