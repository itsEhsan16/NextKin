'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import { gsap, useLandingMotion } from '../motion/gsap';

/** The hero's links (525:398), each an in-page anchor. */
const LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Proof', href: '#proof' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const EASE = [0.22, 1, 0.36, 1] as const;

type NavGroup = 'logo' | 'links' | 'menu';
type NavRefs = Record<NavGroup, React.RefObject<HTMLElement | null>>;

const contains = (els: HTMLElement[], x: number, y: number) =>
  els.some((el) => {
    const b = el.getBoundingClientRect();
    return b.left <= x && b.right >= x && b.top <= y && b.bottom >= y;
  });

/**
 * Whether each nav group (logo, links, menu) sits over violet. Violet surfaces are marked
 * `data-nav-dark` (hero, proof band, final CTA); light surfaces inside them are marked
 * `data-nav-light` (the proof cards, the hero and CTA fields, the hero mock), so a group over a
 * white card turns ink even inside a violet section (owner, 2026-11-21). Each group samples three
 * points across its own middle and goes dark when at least two are over bare violet. Checked on
 * scroll and every 300ms, since the proof marquee moves cards under the nav while the page is still.
 */
function useNavTone(refs: NavRefs, row: React.RefObject<HTMLElement | null>) {
  const [dark, setDark] = useState<Record<NavGroup, boolean>>({
    logo: true,
    links: true,
    menu: true,
  });
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const darkEls = [...document.querySelectorAll<HTMLElement>('[data-nav-dark]')];
      const lightEls = [...document.querySelectorAll<HTMLElement>('[data-nav-light]')];
      const isDark = (el: HTMLElement | null) => {
        let r = el?.getBoundingClientRect();
        if (!r || r.width === 0) r = row.current?.getBoundingClientRect();
        if (!r) return true;
        const y = r.top + r.height / 2;
        const hits = [0.2, 0.5, 0.8].filter((f) => {
          const x = r.left + r.width * f;
          return contains(darkEls, x, y) && !contains(lightEls, x, y);
        }).length;
        return hits >= 2;
      };
      const next = {
        logo: isDark(refs.logo.current),
        links: isDark(refs.links.current),
        menu: isDark(refs.menu.current),
      };
      setDark((prev) =>
        prev.logo === next.logo && prev.links === next.links && prev.menu === next.menu
          ? prev
          : next,
      );
      setScrolled(window.scrollY > 8);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') schedule();
    }, 300);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [refs, row]);
  return { dark, scrolled };
}

function toneFor(overDark: boolean, scrolled: boolean) {
  return overDark
    ? {
        word: 'text-lp-white',
        pill: scrolled ? 'border-lp-white/20 bg-transparent' : 'border-lp-white/30 bg-lp-white/16',
        glass: 'lp-nav-glass--dark',
        link: 'text-lp-white/92 hover:bg-lp-white/12 hover:text-lp-white',
        menu: 'border-lp-white/30 bg-lp-white/16',
        bar: 'bg-lp-white',
      }
    : {
        word: 'text-lp-ink',
        pill: scrolled ? 'border-lp-white/70 bg-transparent' : 'border-lp-ink/12 bg-lp-white/40',
        glass: 'lp-nav-glass--light',
        link: 'text-lp-ink-2 hover:bg-lp-ink/6 hover:text-lp-ink',
        menu: 'border-lp-ink/12 bg-lp-white/40',
        bar: 'bg-lp-ink',
      };
}

/**
 * The hero's top row exactly as the board draws it (525:390): logo + wordmark, the translucent
 * link pill and the white auth pill. It is fixed in place, so it stays at the top as the page
 * scrolls, with no bar behind it (owner, 2026-11-20). Over violet it is the board's white; over
 * the light sections the wordmark, links and menu turn ink so they stay readable. Once the page
 * scrolls, each group (logo, links, auth) gets its own soft frosted backdrop, not one shared bar
 * (owner, 2026-11-20); at the very top it is the board, untouched. Below 1024px,
 * where the board has no layout, the links fold into a menu button.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLAnchorElement>(null);
  const links = useRef<HTMLUListElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const refs = useMemo(() => ({ logo, links, menu }), []);
  const { dark, scrolled } = useNavTone(refs, row);

  useLandingMotion(root, () => {
    gsap.from(row.current, { y: -20, opacity: 0, duration: 0.9, ease: 'expo.out', delay: 0.1 });
  });

  const logoTone = toneFor(dark.logo, scrolled);
  const linksTone = toneFor(dark.links, scrolled);
  const menuTone = toneFor(dark.menu, scrolled);

  return (
    <header
      ref={root}
      className="pointer-events-none fixed inset-x-0 top-3 z-40 px-3 sm:top-5 sm:px-5"
    >
      <nav aria-label="Main" className="relative mx-auto max-w-[1400px]">
        <div
          ref={row}
          data-hero-nav
          className="flex h-[76px] items-end justify-between px-4 sm:h-[84px] sm:px-[39px]"
        >
          <a
            ref={logo}
            href="#top"
            className="pointer-events-auto relative flex h-14 items-center gap-2.5"
            aria-label="NextKin home"
          >
            {/* Once scrolled, a frosted glass pill like the link pill's, with no border (owner,
                2026-11-21: "bring back that glassy, but don't show border"). */}
            <span
              aria-hidden
              className={cn(
                'lp-nav-glass pointer-events-none absolute -inset-x-5 inset-y-0 -z-10 rounded-full transition-opacity duration-300',
                logoTone.glass,
                scrolled ? 'opacity-100' : 'opacity-0',
              )}
            />
            {/* The slot is the star itself (owner, 2026-11-21: bigger, properly aligned). In the
                glow SVG's 81.82 box the star spans x 24.4–53.4 and y 23.9–53.9, so the image is
                scaled to 272.7% of the slot and shifted so the star fills it; the glow overflows. */}
            <span className="relative size-[30px] shrink-0 translate-y-px sm:size-9">
              <img
                src="/landing/logo-mark-glow.svg"
                alt=""
                className="absolute top-[-79.7%] left-[-81.3%] size-[272.7%] max-w-none"
              />
            </span>
            <span
              className={cn(
                'text-[24px] leading-none font-semibold tracking-[-0.2px] transition-colors duration-300 sm:text-[28px]',
                logoTone.word,
              )}
            >
              NextKin
            </span>
          </a>

          <ul
            ref={links}
            className={cn(
              'pointer-events-auto absolute top-[28px] left-1/2 isolate hidden -translate-x-1/2 items-start gap-1 rounded-full border p-1.5 transition-[background-color,border-color,box-shadow] duration-300 lg:flex',
              linksTone.pill,
            )}
          >
            {/* The glass fades in on its own layer: a gradient can't transition, the opacity can. */}
            <li
              aria-hidden
              role="presentation"
              className={cn(
                'lp-nav-glass pointer-events-none absolute inset-0 -z-10 rounded-full transition-opacity duration-300',
                linksTone.glass,
                scrolled ? 'opacity-100' : 'opacity-0',
              )}
            />
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={cn(
                    'block rounded-full px-[22px] py-[11px] text-base leading-[20px] font-medium transition-colors duration-300',
                    linksTone.link,
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="pointer-events-auto flex h-14 items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full p-1.5 transition-[background-color,box-shadow] duration-300',
                scrolled
                  ? 'bg-lp-white/80 shadow-[0_8px_24px_0_rgba(20,22,43,0.1)] backdrop-blur-xl'
                  : 'bg-lp-white',
              )}
            >
              {/* Plain anchors on purpose: on nextkin.ai the proxy sends /sign-in and /sign-up to
                  the app host, which needs a full page load. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see above */}
              <a
                href="/sign-in"
                className="hidden px-[22px] py-[11px] text-base leading-[20px] font-semibold text-lp-ink-2 transition-colors hover:text-lp-violet sm:block"
              >
                Log in
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see above */}
              <a
                href="/sign-up"
                className="rounded-full bg-lp-ink px-5 py-[9px] text-[15px] font-semibold text-lp-white transition-opacity hover:opacity-90 sm:px-6 sm:py-[11px] sm:text-base sm:leading-[20px]"
              >
                Sign up
              </a>
            </div>
            <button
              ref={menu}
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'flex size-11 items-center justify-center rounded-full border transition-colors duration-300 lg:hidden',
                menuTone.menu,
              )}
            >
              <span className="relative block h-3 w-[18px]">
                <motion.span
                  animate={open ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
                  className={cn('absolute inset-x-0 top-0 h-0.5 rounded', menuTone.bar)}
                />
                <motion.span
                  animate={open ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
                  className={cn('absolute inset-x-0 bottom-0 h-0.5 rounded', menuTone.bar)}
                />
              </span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.ul
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="pointer-events-auto absolute inset-x-4 top-[calc(100%+10px)] rounded-[28px] border border-lp-white/30 bg-lp-violet-deep/95 p-2 lg:hidden"
            >
              {[...LINKS, { label: 'Log in', href: '/sign-in' }].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-[20px] px-5 py-3.5 text-[17px] font-medium text-lp-white hover:bg-lp-white/10"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </nav>
    </header>
  );
}
