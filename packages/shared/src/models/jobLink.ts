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
