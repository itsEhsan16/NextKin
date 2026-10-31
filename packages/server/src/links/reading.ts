import { parse, parseFragment, type DefaultTreeAdapterMap } from 'parse5';

/**
 * What a page says, as text a person would see (toreview §144.3). A JobPosting block in the page's
 * own JSON-LD is the best source: many job sites publish one, and it names the role and the
 * employer outright. Otherwise the page's visible text is read, and hidden text never reaches the
 * model (G9).
 */

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type TextNode = DefaultTreeAdapterMap['textNode'];
type Parent = DefaultTreeAdapterMap['parentNode'];

export interface PageReading {
  url: string;
  /** A JobPosting block supplied this, rather than the page's text. */
  structured: boolean;
  title?: string;
  company?: string;
  location?: string;
  closesAt?: string;
  text: string;
  words: number;
}

/** Below this, a page with no JobPosting block has not said enough to be a job posting. */
export const MIN_WORDS = 120;
const MIN_STRUCTURED_WORDS = 40;
export const MAX_TEXT = 19000;

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'head', 'nav', 'footer', 'aside', 'form', 'dialog', 'button', 'select', 'option', 'input', 'textarea', 'video', 'audio', 'object', 'embed']);
const BLOCK = new Set(['address', 'article', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section', 'table', 'tr', 'ul']);
const HIDDEN_STYLE = /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0*)?\s*($|;)|font-size\s*:\s*0)/i;

const isElement = (node: Node): node is Element => 'tagName' in node;
const isText = (node: Node): node is TextNode => node.nodeName === '#text';
const hasChildren = (node: Node): node is Node & Parent => 'childNodes' in node;
const attr = (el: Element, name: string): string | undefined => el.attrs.find((a) => a.name === name)?.value;

const isHidden = (el: Element): boolean => attr(el, 'hidden') !== undefined || attr(el, 'aria-hidden') === 'true' || HIDDEN_STYLE.test(attr(el, 'style') ?? '');

function collect(node: Node, out: string[]): void {
  if (isText(node)) {
    out.push(node.value.replace(/\s+/g, ' '));
    return;
  }
  if (isElement(node)) {
    if (SKIP.has(node.tagName) || isHidden(node)) return;
    const block = BLOCK.has(node.tagName);
    if (block) out.push('\n');
    if (node.tagName === 'li') out.push('- ');
    for (const child of node.childNodes) collect(child, out);
    if (block) out.push('\n');
    return;
  }
  if (hasChildren(node)) for (const child of node.childNodes) collect(child, out);
}

const tidy = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== ''))
    .join('\n')
    .trim();

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

const visibleText = (node: Node): string => {
  const out: string[] = [];
  collect(node, out);
  return tidy(out.join(''));
};

function walk(node: Node, visit: (el: Element) => void): void {
  if (isElement(node)) visit(node);
  if (hasChildren(node)) for (const child of node.childNodes) walk(child, visit);
}

/** The largest <main>, <article> or role=main, when it holds the page; else the whole body. */
function mainText(document: Node): string {
  const whole = visibleText(document);
  let best = '';
  walk(document, (el) => {
    if (el.tagName === 'main' || el.tagName === 'article' || attr(el, 'role') === 'main') {
      const text = visibleText(el);
      if (text.length > best.length) best = text;
    }
  });
  return wordCount(best) >= MIN_WORDS ? best : whole;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A field of the block. Some sites encode their JSON twice, so "&amp;" comes through as-is. */
const text = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const plain = visibleText(parseFragment(value));
  return plain || undefined;
};

function jobPostings(value: unknown): Json[] {
  if (Array.isArray(value)) return value.flatMap(jobPostings);
  if (!isObject(value)) return [];
  const type = value['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return [value];
  return jobPostings(value['@graph']);
}

const organisation = (value: unknown): string | undefined => (isObject(value) ? text(value.name) : text(value));

function place(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!isObject(first)) return text(first);
  const address = isObject(first.address) ? first.address : first;
  const country = isObject(address.addressCountry) ? address.addressCountry.name : address.addressCountry;
  const parts = [text(address.addressLocality), text(address.addressRegion), text(country)].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function postingIn(document: Node): Json | undefined {
  let found: Json | undefined;
  walk(document, (el) => {
    if (found || el.tagName !== 'script' || !/ld\+json/i.test(attr(el, 'type') ?? '')) return;
    const raw = el.childNodes.filter(isText).map((n) => n.value).join('');
    try {
      found = jobPostings(JSON.parse(raw))[0];
    } catch {
      // A malformed block says nothing; the page's text may still.
    }
  });
  return found;
}

/** The posting's own description is HTML more often than not. */
const descriptionText = (html: string): string => visibleText(parseFragment(html));

function pageTitle(document: Node): string | undefined {
  let title: string | undefined;
  walk(document, (el) => {
    if (title || el.tagName !== 'title') return;
    title = text(el.childNodes.filter(isText).map((n) => n.value).join(''));
  });
  return title;
}

const compose = (parts: { title?: string | undefined; company?: string | undefined; location?: string | undefined; body: string }): string =>
  [parts.title && parts.company ? `${parts.title} at ${parts.company}` : parts.title, parts.location, '', parts.body]
    .filter((line) => line !== undefined)
    .join('\n')
    .trim()
    .slice(0, MAX_TEXT);

/** A page read through a browser hands its JSON-LD and text over directly. */
export function readRendered(input: { url: string; title: string; text: string; jsonLd: string[] }): PageReading {
  for (const block of input.jsonLd) {
    try {
      const posting = jobPostings(JSON.parse(block))[0];
      if (posting) return fromPosting(input.url, posting) ?? fromText(input.url, input.title, input.text);
    } catch {
      // As above.
    }
  }
  return fromText(input.url, input.title, input.text);
}

function fromPosting(url: string, posting: Json): PageReading | null {
  const body = typeof posting.description === 'string' ? descriptionText(posting.description) : '';
  if (wordCount(body) < MIN_STRUCTURED_WORDS) return null;
  const title = text(posting.title);
  const company = organisation(posting.hiringOrganization);
  const remote = text(posting.jobLocationType)?.toUpperCase() === 'TELECOMMUTE';
  const location = place(posting.jobLocation) ?? (remote ? 'Remote' : undefined);
  const closesAt = text(posting.validThrough);
  const composed = compose({ title, company, location, body });
  return { url, structured: true, ...(title ? { title } : {}), ...(company ? { company } : {}), ...(location ? { location } : {}), ...(closesAt ? { closesAt } : {}), text: composed, words: wordCount(composed) };
}

function fromText(url: string, title: string | undefined, body: string): PageReading {
  const composed = tidy(body).slice(0, MAX_TEXT);
  return { url, structured: false, ...(title ? { title } : {}), text: composed, words: wordCount(composed) };
}

export function readHtml(html: string, url: string): PageReading {
  const document = parse(html);
  const posting = postingIn(document);
  const structured = posting ? fromPosting(url, posting) : null;
  return structured ?? fromText(url, pageTitle(document), mainText(document));
}

const CHALLENGE = /just a moment|attention required|security check|verify (that )?you(['’]re| are) (a )?human|are you (a )?(robot|human)|checking your browser|access denied|request blocked|enable javascript and cookies|unusual traffic|captcha/i;

/** A bot check that answered 200. It counts as a refusal, and we go no further. */
export function isChallenge(reading: Pick<PageReading, 'title' | 'text' | 'words' | 'structured'>): boolean {
  if (reading.structured) return false;
  return CHALLENGE.test(reading.title ?? '') || (reading.words < MIN_WORDS && CHALLENGE.test(reading.text));
}

/** Whether the reading holds enough to give the model. */
export const isEnough = (reading: PageReading): boolean => reading.structured || reading.words >= MIN_WORDS;
