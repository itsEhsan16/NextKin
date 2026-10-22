/**
 * "Go to it" in the download checklist (EDIT 02): open the section — and the entry — a problem
 * is in, then scroll to it. Sections and entries start closed, so each listens for its own id.
 */

export type Reveal = { anchor: string; entryId?: string };

const EVENT = 'nextkin:editor-reveal';

export function reveal(target: Reveal): void {
  window.dispatchEvent(new CustomEvent<Reveal>(EVENT, { detail: target }));
  requestAnimationFrame(() =>
    document.getElementById(target.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  );
}

export function onReveal(listener: (target: Reveal) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<Reveal>).detail);
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}
