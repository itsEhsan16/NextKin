'use client';

import { Docx } from '@untitledui/file-icons/dist/docx';
import { Pdf } from '@untitledui/file-icons/dist/pdf';
import { Txt } from '@untitledui/file-icons/dist/txt';
import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { MagneticButton } from '../parts/MagneticButton';
import { Reveal } from '../parts/Reveal';

/**
 * Every position below is the board's own (528:1080, a 1100×520 web), written in container-query
 * units so the whole web scales as one picture: 1cqw = 11px at full size.
 */
const cq = (px: number) => `${((px / 1100) * 100).toFixed(4)}cqw`;

type Mark = { id: string; label: string; x: number; y: number } & (
  | { kind: 'icon'; src: string }
  /** A wordmark logo, centred in the tile at `w` board px wide. */
  | { kind: 'wordmark'; src: string; w: number }
);

/**
 * Job boards (top half of the web), with each company's own logo: LinkedIn from Wikimedia
 * Commons, Naukri, Workday and Lever from their own sites, the rest from Simple Icons.
 */
const BOARDS: Mark[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    x: 222,
    y: 32,
    kind: 'icon',
    src: '/landing/logo-linkedin.svg',
  },
  {
    id: 'indeed',
    label: 'Indeed',
    x: 372,
    y: 12,
    kind: 'icon',
    src: '/landing/integrations-indeed.svg',
  },
  {
    id: 'naukri',
    label: 'Naukri',
    x: 522,
    y: 32,
    kind: 'icon',
    src: '/landing/logo-naukri-mark.svg',
  },
  {
    id: 'glassdoor',
    label: 'Glassdoor',
    x: 672,
    y: 12,
    kind: 'icon',
    src: '/landing/integrations-glassdoor.svg',
  },
  {
    id: 'greenhouse',
    label: 'Greenhouse',
    x: 822,
    y: 32,
    kind: 'icon',
    src: '/landing/integrations-greenhouse.svg',
  },
  {
    id: 'workday',
    label: 'Workday',
    x: 372,
    y: 132,
    kind: 'wordmark',
    src: '/landing/logo-workday.svg',
    w: 56,
  },
  {
    id: 'lever',
    label: 'Lever',
    x: 522,
    y: 142,
    kind: 'wordmark',
    src: '/landing/logo-lever.png',
    w: 52,
  },
  {
    id: 'wellfound',
    label: 'Wellfound',
    x: 672,
    y: 132,
    kind: 'icon',
    src: '/landing/integrations-wellfound.svg',
  },
];

/**
 * Files in and out (bottom half), drawn with Untitled UI's own file-type icons
 * (`@untitledui/file-icons`, default variant: a page with its coloured format label). Each is
 * imported on its own so only these three ship.
 */
const FORMATS = [
  { id: 'pdf-in', x: 302, y: 442, label: 'PDF', Icon: Pdf },
  { id: 'docx-in', x: 412, y: 462, label: 'DOCX', Icon: Docx },
  { id: 'txt-in', x: 522, y: 442, label: 'TXT', Icon: Txt },
  { id: 'pdf-out', x: 632, y: 462, label: 'PDF', Icon: Pdf },
  { id: 'docx-out', x: 742, y: 442, label: 'DOCX', Icon: Docx },
];

/** A board's box: no fill, border or shadow, just the icon (owner, 2026-11-20), now on light glass. */
const TILE = 'absolute';

const px = (n: number) => `${n}px`;

/** A board's face; `u` turns board pixels into the unit of the place it is drawn. */
function MarkFace({ mark, u = cq }: { mark: Mark; u?: (n: number) => string }) {
  if (mark.kind === 'wordmark') {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <img src={mark.src} alt="" style={{ width: u(mark.w), height: 'auto' }} />
      </span>
    );
  }
  return (
    <img
      src={mark.src}
      alt=""
      className="absolute"
      style={{ left: u(6), top: u(6), width: u(44), height: u(44) }}
    />
  );
}

/** The web as the board draws it, scaled to its container (≥640px). */
function IntegrationWeb() {
  return (
    <div data-int-web className="@container relative mx-auto hidden w-full max-w-[1100px] sm:block">
      <div className="relative aspect-[1100/520] w-full">
        {/* Connector wires: revealed outward from the hub by a growing circular mask. */}
        <img
          data-int-wires
          src="/landing/integrations-wires.svg"
          alt=""
          className="absolute inset-0 size-full"
          style={{ clipPath: 'circle(150% at 50% 57.7%)' }}
        />
        {/* Beams: light pulses travel along the wires, into the hub from the boards and out of it
            to the files. The wires file masks a moving gradient (see `.lp-beam`). */}
        <div aria-hidden data-int-beams className="lp-beams">
          <span className="lp-beam lp-beam--in" />
          <span className="lp-beam lp-beam--out" />
        </div>

        {BOARDS.map((mark, i) => (
          <div
            key={mark.id}
            data-int-node
            data-depth={0.6 + (i % 3) * 0.35}
            className="absolute"
            style={{ left: cq(mark.x), top: cq(mark.y), width: cq(56), height: cq(56) }}
          >
            <div data-int-float className={cn(TILE, 'inset-0')} style={{ borderRadius: cq(16) }}>
              <span className="sr-only">{mark.label}</span>
              <MarkFace mark={mark} />
            </div>
          </div>
        ))}

        {FORMATS.map((f, i) => (
          <div
            key={f.id}
            data-int-node
            data-depth={0.5 + (i % 2) * 0.4}
            className="absolute"
            style={{ left: cq(f.x), top: cq(f.y), width: cq(56), height: cq(56) }}
          >
            <div data-int-float className="absolute inset-0">
              <f.Icon
                className="absolute"
                style={{ left: cq(4), top: cq(4), width: cq(48), height: cq(48) }}
              />
            </div>
          </div>
        ))}

        {/* Orbital glow: a slow conic light circling the hub. */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: cq(550 - 120), top: cq(300 - 120), width: cq(240), height: cq(240) }}
        >
          <div
            data-int-orbit
            className="size-full rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(139,124,255,0.35)_60deg,rgba(167,139,250,0.22)_110deg,transparent_170deg,transparent_360deg)] opacity-80 blur-2xl"
          />
        </div>

        {/* Hub (528:1134): the NextKin mark in a violet ring, pulsing. */}
        <div
          data-int-hub
          className="absolute"
          style={{ left: cq(504), top: cq(254), width: cq(92), height: cq(92) }}
        >
          <span
            data-int-pulse
            className="absolute inset-0 rounded-full border-2 border-lp-beam opacity-0"
          />
          <span
            data-int-pulse
            className="absolute inset-0 rounded-full border-2 border-lp-beam opacity-0"
          />
          <div
            className="absolute inset-0 flex items-center justify-center overflow-clip rounded-full bg-lp-white shadow-[0_10px_30px_0_rgba(85,67,238,0.22)]"
            style={{ borderWidth: cq(3), borderColor: '#5543ee', borderStyle: 'solid' }}
          >
            {/* Centred in the ring (the board's x/y offsets sat it a few px up and left). */}
            <img
              src="/landing/integrations-nextkin-mark.svg"
              alt="NextKin"
              style={{ width: cq(42), height: cq(44) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Phones: the same pieces stacked, since the web would shrink its tiles to ~17px. */
function IntegrationStack() {
  return (
    <div className="flex flex-col items-center gap-6 sm:hidden">
      <ul className="grid grid-cols-4 gap-3">
        {BOARDS.map((mark) => (
          <li key={mark.id} data-int-node className="relative size-14">
            <span className="sr-only">{mark.label}</span>
            <MarkFace mark={mark} u={px} />
          </li>
        ))}
      </ul>
      <div className="relative size-[76px]">
        <span
          data-int-pulse
          className="absolute inset-0 rounded-full border-2 border-lp-beam opacity-0"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-full border-[3px] border-lp-violet bg-lp-white shadow-[0_10px_30px_0_rgba(85,67,238,0.22)]">
          <img src="/landing/integrations-nextkin-mark.svg" alt="NextKin" width={34} height={36} />
        </div>
      </div>
      <ul className="flex gap-3">
        {FORMATS.map((f) => (
          <li key={f.id} data-int-node className="relative size-14">
            <f.Icon className="absolute inset-1 size-12" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 09 Works with what you have (Figma 528:1073). The job boards NextKin reads and the file
 * formats it takes in and gives back, wired into one hub.
 *
 * Landing v2 (toreview §251): the web sits on a large light glass panel with beams, halftone and
 * an orbital glow circling the hub; the logos stand on their own, without tiles.
 *
 * Motion: the wires draw outward from the hub, tiles pop in after them, the beams pulse along the
 * wires, the hub sends out slow pulses, the orbit turns while on screen, every tile drifts on its
 * own clock and leans with the pointer by its depth.
 */
export function Integrations() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, ({ isDesktop }) => {
    const q = gsap.utils.selector(root);
    const web = q('[data-int-web]')[0] as HTMLElement | undefined;
    const trigger = {
      trigger: root.current,
      start: 'top 60%',
      toggleActions: 'play none none none',
    };

    const tl = gsap.timeline({ scrollTrigger: trigger });
    tl.from(q('[data-int-hub]'), { scale: 0, rotate: -90, duration: 0.8, ease: 'back.out(2)' })
      .fromTo(
        q('[data-int-wires]'),
        { clipPath: 'circle(0% at 50% 57.7%)' },
        { clipPath: 'circle(75% at 50% 57.7%)', duration: 1.4, ease: 'power2.inOut' },
        '-=0.3',
      )
      // The beams start once the wires are drawn.
      .from(q('[data-int-beams]'), { opacity: 0, duration: 0.6 }, '>-0.1')
      .from(
        q('[data-int-node]'),
        {
          scale: 0,
          opacity: 0,
          duration: 0.6,
          ease: 'back.out(2.2)',
          stagger: { each: 0.06, from: 'center' },
        },
        '-=0.9',
      );

    // The orbital glow circles the hub, only while the panel is on screen.
    gsap.to(q('[data-int-orbit]'), {
      rotate: 360,
      duration: 9,
      ease: 'none',
      repeat: -1,
      scrollTrigger: {
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        toggleActions: 'play pause resume pause',
      },
    });

    // The hub's pulse rings.
    gsap.fromTo(
      q('[data-int-pulse]'),
      { scale: 1, opacity: 0.55 },
      { scale: 1.9, opacity: 0, duration: 2.4, ease: 'power2.out', repeat: -1, stagger: 1.2 },
    );

    // Each tile drifts on its own clock.
    q('[data-int-float]').forEach((el) => {
      gsap.to(el, {
        y: gsap.utils.random(-7, 7),
        x: gsap.utils.random(-4, 4),
        duration: gsap.utils.random(2.4, 4),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: gsap.utils.random(0, 1.5),
      });
    });

    // Tiles lean with the pointer, deeper ones further.
    if (isDesktop && web) {
      const nodes = Array.from(web.querySelectorAll<HTMLElement>('[data-int-node]')).map((el) => ({
        depth: Number(el.dataset.depth ?? 1),
        x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }),
        y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' }),
      }));
      const move = (e: PointerEvent) => {
        const r = web.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        nodes.forEach((n) => {
          n.x(dx * 28 * n.depth);
          n.y(dy * 20 * n.depth);
        });
      };
      const leave = () => nodes.forEach((n) => (n.x(0), n.y(0)));
      web.addEventListener('pointermove', move);
      web.addEventListener('pointerleave', leave);
      return () => {
        web.removeEventListener('pointermove', move);
        web.removeEventListener('pointerleave', leave);
      };
    }
  });

  return (
    <section
      id="integrations"
      ref={root}
      className="mt-12 overflow-x-clip px-5 pt-16 pb-20 lg:mt-[70px] lg:px-10 lg:pt-[104px] lg:pb-[112px]"
    >
      <div className="mx-auto flex max-w-[1360px] flex-col items-center text-center">
        <Reveal
          as="h2"
          className="max-w-[860px] text-[36px] leading-[42px] font-semibold tracking-[-1px] text-lp-heading sm:text-[44px] sm:leading-[50px] lg:text-[54px] lg:leading-[54px] lg:tracking-[-1.35px]"
        >
          Works where you <AccentWord className="text-lp-violet">already</AccentWord> apply.
        </Reveal>
        <Reveal as="p" delay={0.1} className="mt-[18px] max-w-[680px] text-lp-body text-[#475569]">
          Paste the link to a posting from the boards you already use and NextKin reads the real job
          description. Bring your resume in as a PDF, DOCX or plain text — and take it back out the
          same way.
        </Reveal>

        <MagneticButton
          href="/sign-up"
          className="mt-[30px] inline-flex items-center justify-center gap-2.5 rounded-full bg-[#0f172a] py-[13px] pr-6 pl-5 text-[15px] font-semibold text-lp-white"
        >
          <span className="relative flex size-[9px]">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#22c55e] opacity-60 motion-reduce:hidden" />
            <img
              src="/landing/integrations-live-dot.svg"
              alt=""
              width={9}
              height={9}
              className="relative"
            />
          </span>
          Try NextKin free today
        </MagneticButton>

        {/* No container (owner, 2026-11-21): the web sits straight on the page. */}
        <div className="relative mt-10 w-full">
          <IntegrationWeb />
          <IntegrationStack />
        </div>
      </div>
    </section>
  );
}
