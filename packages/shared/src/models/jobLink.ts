/**
 * TAILOR 00c: whether something on the clipboard is a job posting worth asking about. Only a lone
 * link that reads as a job counts — a careers site, a jobs path, or a job board — so a copied
 * article or video never raises "Found a job link you copied".
 */

/** One token that looks like a web address: "cred.club/careers/…" or a full https link. */
const URL_LIKE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?([/?#]\S*)?$/i;

/** Words a job posting's address carries, in its host or its path. */
const JOB_WORDS =
  /(^|[./_-])(jobs?|careers?|hiring|apply|positions?|openings?|vacanc(y|ies)|recruit\w*)([./_?#-]|$)/i;

/** Boards whose links are job postings even when the path says only "view/123". */
const JOB_BOARD_HOSTS =
  /(^|\.)(linkedin\.com|naukri\.com|indeed\.com|glassdoor\.[a-z.]+|greenhouse\.io|lever\.co|myworkdayjobs\.com|wellfound\.com|instahyre\.com|foundit\.in|iimjobs\.com|cutshort\.io)$/i;

/** Shared text this long is the job itself; shorter is an app's wrapping around a link. */
const JOB_TEXT_MIN = 200;
const ANY_LINK = /https?:\/\/\S+/i;

/**
 * What was shared into NextKin, in the terms the job reader takes. Sharing is the tap, so unlike a
 * copied link any web address will do: the reader says plainly if there's no job on it.
 */
export function sharedJobOf(
  text: string | null | undefined,
): { source: 'link'; url: string } | { source: 'paste'; text: string } | null {
  const trimmed = text?.trim() ?? '';
  if (trimmed.length >= JOB_TEXT_MIN) return { source: 'paste', text: trimmed };
  const link = ANY_LINK.exec(trimmed)?.[0]?.replace(/[).,]+$/, '');
  return link ? { source: 'link', url: link } : null;
}

const NO_READING = [
  { host: /(^|\.)linkedin\.com$/i, name: 'LinkedIn' },
  { host: /(^|\.)indeed\.[a-z.]+$/i, name: 'Indeed' },
  { host: /(^|\.)naukri\.com$/i, name: 'Naukri' },
];

/** Names the site when it's one we know refuses, so the paste box can say whose rule it is. */
export function blockedSiteNotice(url: string): string | null {
  const host = /^https?:\/\/([^/?#]+)/i.exec(url)?.[1] ?? '';
  const site = NO_READING.find((item) => item.host.test(host));
  return site
    ? `${site.name} doesn’t let us read its pages. Copy the job text and paste it here.`
    : null;
}

/** The job link in copied text, as copied, or null when the text is anything else. */
export function jobLinkIn(text: string | null | undefined): string | null {
  const candidate = text?.trim() ?? '';
  if (!candidate || /\s/.test(candidate) || !URL_LIKE.test(candidate)) return null;
  const withoutScheme = candidate.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const host = withoutScheme.split(/[/?#]/)[0] ?? '';
  const path = withoutScheme.slice(host.length).replace(/^\/+|\/+$/g, '');
  // A board's own front page is not a posting; a path on it is.
  if (JOB_BOARD_HOSTS.test(host)) return path ? candidate : null;
  return JOB_WORDS.test(withoutScheme) ? candidate : null;
}
