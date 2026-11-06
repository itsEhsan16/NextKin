import type { JdFile, JdInput } from '@/data/models';

/** One token that looks like a web address — "cred.club/careers/…" or a full https link. */
const URL_LIKE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?([/?#]\S*)?$/i;

/** What a pasted job reads as: a file beats text, and a lone URL-looking token is a link. */
export function buildAddInput(text: string, file: JdFile | null): JdInput | null {
  if (file) return { source: 'file', file };
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/\s/.test(trimmed) && URL_LIKE.test(trimmed)) return { source: 'link', url: trimmed };
  return { source: 'paste', text: trimmed };
}

/** A JD draft that is gone (expired, or another device's). */
export const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';
