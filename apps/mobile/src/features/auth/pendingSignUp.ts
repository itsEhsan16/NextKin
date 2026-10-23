import { create } from 'zustand';

/**
 * The sign-up waiting for its emailed code (ImBackendImplementationPlan P5-08). Memory only, never
 * persisted: the password is needed once, to sign in straight after the code is confirmed, and is
 * dropped then — or when the app closes, after which the reader simply signs in.
 */
type PendingSignUp = {
  email: string;
  password: string;
  start: (email: string, password: string) => void;
  clear: () => void;
};

export const usePendingSignUp = create<PendingSignUp>((set) => ({
  email: '',
  password: '',
  start: (email, password) => set({ email, password }),
  clear: () => set({ email: '', password: '' }),
}));
