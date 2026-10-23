import { z } from 'zod';
import type { Page } from '../repos/types';

/** Cursor pagination on every list endpoint (spec §11). Matches the repositories' Page<T>. */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    /** Opaque; absent on the last page. */
    nextCursor: z.string().optional(),
  });
}

// Compile-time proof that the wire shape is the repositories' Page<T>.
type _PageMatches = z.infer<ReturnType<typeof pageSchema<z.ZodString>>> extends Page<string> ? true : never;
export const PAGE_SHAPE_MATCHES: _PageMatches = true;
