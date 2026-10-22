import { EMAIL, PHONE, isPhone } from '@nextkin/shared/privacy/contact';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import { HEADING } from './layout';

/**
 * A resume's own header, read by code (toreview §111; G5): the name and the contact row at the top
 * of the file, before its first section heading. The model never reads it — `splitHeader` hands
 * extraction only the text after it — so the name, email, phone and links cannot reach a model,
 * and what is printed is what the file said, item for item, in its order.
 */

export type FileLink = { text: string; url: string };
type Header = NonNullable<CanonicalResumeJson['header']>;

const MAX_HEADER_LINES = 6;
const SEPARATOR = /\s*(?:\||•|·|◦|▪|♦|\s{3,})\s*/;
const SAFE_URL = /^(?:https:\/\/|mailto:|tel:)/i;
const BARE_LINK = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*$/i;

const looksLikeName = (line: string) =>
  line.length <= 60 && !/[\d@/|]/.test(line) && line.split(/\s+/).length >= 1 && line.split(/\s+/).length <= 5;

const bare = (s: string) => s.replace(/[|•·◦▪♦]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * The link an item carries. An annotation's own text is coarse (a contact line is often one run),
 * so a link is matched by what it is: an email is its mailto:, a phone its tel:, "LinkedIn" the
 * https link whose host is linkedin.com, else an annotation whose text is the item.
 */
function urlOf(item: string, links: readonly FileLink[]): string | undefined {
  const text = item.trim();
  const key = bare(text);
  const safe = links.filter((l) => SAFE_URL.test(l.url));
  if (new RegExp(`^${EMAIL.source}$`, 'i').test(text)) return `mailto:${text}`;
  if (PHONE.test(text) && isPhone(text)) return `tel:${text.replace(/[^\d+]/g, '')}`;
  const https = safe.filter((l) => /^https:/i.test(l.url));
  const exact = https.find((l) => bare(l.text) === key);
  if (exact) return exact.url;
  const word = key.replace(/[^a-z0-9]/g, '');
  const byHost = word.length >= 3 ? https.find((l) => hostOf(l.url).replace(/[^a-z0-9.]/g, '').split('.').includes(word) || hostOf(l.url).startsWith(word)) : undefined;
  if (byHost) return byHost.url;
  if (BARE_LINK.test(text)) return `https://${text.replace(/^https?:\/\//i, '')}`;
  return undefined;
}

/**
 * The header and the body after it. No header is returned when the top of the file does not look
 * like one (no name line, or no heading within the first lines): then the whole text is the body,
 * and the resume prints the account's name as before.
 */
export function splitHeader(text: string, links: readonly FileLink[] = []): { header?: Header; headline?: string; body: string } {
  const lines = text.split('\n');
  const firstHeading = lines.findIndex((line) => line.trim().length <= 40 && HEADING.test(line.trim()));
  const top = (firstHeading < 0 ? [] : lines.slice(0, firstHeading)).map((l) => l.trim()).filter(Boolean);
  if (top.length === 0 || top.length > MAX_HEADER_LINES || !looksLikeName(top[0]!)) return { body: text };

  const [name, ...rest] = top;
  let headline: string | undefined;
  const items: Header['items'] = [];
  for (const line of rest) {
    const pieces = line.split(SEPARATOR).map((p) => p.trim()).filter(Boolean);
    // A line with no separators and nothing contact-like under the name is a headline.
    if (pieces.length === 1 && !headline && !items.length && !urlOf(pieces[0]!, links) && !/\d/.test(pieces[0]!)) {
      headline = pieces[0]!.slice(0, 200);
      continue;
    }
    for (const piece of pieces) {
      const url = urlOf(piece, links);
      items.push({ text: piece.slice(0, 200), ...(url ? { url: url.slice(0, 500) } : {}) });
    }
  }
  return {
    header: { name: name!.slice(0, 120), items: items.slice(0, 12) },
    ...(headline ? { headline } : {}),
    body: lines.slice(firstHeading).join('\n'),
  };
}
