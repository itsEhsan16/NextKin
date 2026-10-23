/**
 * Contact-shaped text, recognised and replaced (V2 §8.5, G5). Pure and phone-safe: the server's
 * model gateway refuses anything these patterns find (`assertNoContact`), and anything that builds
 * text for a model redacts with them first.
 *
 * A phone number has a phone's shape, not merely many digits — "2019-2021", "120000 - 150000" and
 * ids must survive. Three shapes: an international number (+ country code), a North American
 * number ((555) 123-4567, 555.123.4567), and a national number with a trunk zero (030 1234567).
 */

export const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const PHONE =
  /(?:\+\d{1,3}(?:[\s.-]?\(?\d{1,5}\)?){2,5})|(?:\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b)|(?:\b0\d{2,4}[\s/-]\d{3,8}(?:[\s-]\d{2,6})?\b)/g;

export const isPhone = (match: string): boolean => {
  const digits = match.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
};

/**
 * Untrusted documents (a pasted JD, extracted resume text) can carry contact details — a
 * recruiter's email, the candidate's phone. They are replaced before the text reaches a model,
 * deterministically, so the same document always yields the same prompt.
 */
export function redactContact(text: string): string {
  return text
    .replace(new RegExp(EMAIL.source, 'gi'), '[email]')
    .replace(PHONE, (match) => (isPhone(match) ? '[phone]' : match));
}

// A link is a scheme or `www.` address, or a domain followed by a path ("github.com/ana").
// A bare dotted word with no path stays: "Node.js", "ASP.NET" and "Socket.io" are skills.
const LINK =
  /\b(?:https?:\/\/|www\.)[^\s<>()]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s<>()]*/gi;

/**
 * Profile and portfolio URLs say who the person is as plainly as an email does. A sentence's own
 * closing punctuation stays outside the marker.
 */
export function redactLinks(text: string): string {
  return text.replace(LINK, (match) => `[link]${/[.,;:!?]+$/.exec(match)?.[0] ?? ''}`);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The user's own names, whole words only (G5: a name is never sent to a model). Names under two
 * letters are left alone: an initial would match half the alphabet.
 */
export function redactNames(text: string, names: readonly (string | null | undefined)[]): string {
  const words = [
    ...new Set(
      names
        .flatMap((name) => (name ?? '').split(/\s+/))
        .map((w) => w.trim())
        .filter((w) => w.length >= 2),
    ),
  ];
  if (words.length === 0) return text;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  );
  return text.replace(pattern, '[name]');
}

/** Everything above, in the order that keeps an email inside a link from being half-replaced. */
export function redactPersonal(
  text: string,
  names: readonly (string | null | undefined)[] = [],
): string {
  return redactNames(redactLinks(redactContact(text)), names);
}
