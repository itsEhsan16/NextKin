'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useRef, type PointerEvent } from 'react';

import { cn } from '@/lib/cn';

import { useSceneOnce } from '../../motion/loop';
import { AccentWord } from '../../parts/AccentWord';
import { LightBeam } from '../../parts/GlassCard';

type Layout = 'modern' | 'tech' | 'bold' | 'minimal';

/** Template sheets (528:995), in board order. */
const TEMPLATES: readonly { name: string; plan: 'Free' | 'Pro'; layout: Layout }[] = [
  { name: 'Modern professional', plan: 'Free', layout: 'modern' },
  { name: 'Tech friendly', plan: 'Free', layout: 'tech' },
  { name: 'Bold impact', plan: 'Pro', layout: 'bold' },
  { name: 'Minimalist focus', plan: 'Free', layout: 'minimal' },
];

const SPRING = { stiffness: 220, damping: 18, mass: 0.5 };
/** The parser's "read" green (the same as the Problem flag rows). */
const OK = '#10b981';

/** A bullet's text, drawn as grey lines; widths in % of the column. */
function Lines({ widths, tone = 'bg-[#e4e2ee]' }: { widths: number[]; tone?: string }) {
  return (
    <span className="flex flex-col gap-[3px]">
      {widths.map((w, i) => (
        <span key={i} style={{ width: `${w}%` }} className={cn('h-[3px] rounded-full', tone)} />
      ))}
    </span>
  );
}

/** The parser's tick beside a section heading; it pops in as the read pass reaches it. */
function Tick() {
  return (
    <span
      data-tk-tick
      className="ml-auto flex size-[9px] shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: OK }}
    >
      <svg viewBox="0 0 10 10" className="size-[7px]" fill="none" aria-hidden>
        <path
          d="M2.2 5.2 4.2 7.1 7.9 3"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** A section heading in the template's own style, with the parser's tick. */
function Heading({ layout, children }: { layout: Layout; children: string }) {
  const row = 'flex items-center rounded-[3px]';
  if (layout === 'modern')
    return (
      <span data-tk-heading className={cn(row, 'gap-1.5')}>
        <span className="text-[6.5px] font-bold tracking-[0.06em] text-lp-violet uppercase">
          {children}
        </span>
        <span className="h-px flex-1 bg-lp-violet/40" />
        <Tick />
      </span>
    );
  if (layout === 'tech')
    return (
      <span data-tk-heading className={cn(row, 'gap-1')}>
        <span className="font-mono text-[6.5px] font-semibold text-lp-violet">
          {`// ${children.toLowerCase()}`}
        </span>
        <Tick />
      </span>
    );
  if (layout === 'bold')
    return (
      <span data-tk-heading className={cn(row, 'gap-1.5')}>
        <span className="h-[9px] w-[3px] rounded-full bg-lp-heading" />
        <span className="text-[7.5px] font-extrabold text-lp-heading">{children}</span>
        <Tick />
      </span>
    );
  return (
    <span data-tk-heading className={cn(row, 'gap-1.5 border-b border-[#ecebf3] pb-[3px]')}>
      <span className="text-[5.5px] font-medium tracking-[0.22em] text-lp-copy uppercase">
        {children}
      </span>
      <Tick />
    </span>
  );
}

/** A role or degree line: title and dates, then its bullets. */
function Role({ title, dates, bullets }: { title: string; dates: string; bullets: number[] }) {
  return (
    <span className="flex flex-col gap-[3px]">
      <span className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[6px] font-semibold text-lp-ink-2">{title}</span>
        <span className="shrink-0 text-[5px] text-lp-muted">{dates}</span>
      </span>
      <Lines widths={bullets} />
    </span>
  );
}

/**
 * The resume on a sheet, one per template (owner, 2026-11-21: "more detailed"). All four keep
 * what the band promises (single column, standard headings, no photos, no tables) and differ in
 * their header, heading style and accents. The people and employers are made up.
 */
function Resume({ layout }: { layout: Layout }) {
  if (layout === 'modern')
    return (
      <span className="flex flex-col gap-[7px] px-4 pt-4">
        <span className="flex flex-col gap-[2px]">
          <span className="text-[11px] leading-none font-bold text-lp-violet">Priya Sharma</span>
          <span className="text-[6px] text-lp-ink-2">Product designer</span>
          <span className="text-[5px] text-lp-muted">priya@mail.com · Pune · portfolio</span>
        </span>
        <Heading layout="modern">Experience</Heading>
        <Role title="Senior designer · Lumen" dates="2022 – now" bullets={[96, 88, 72]} />
        <Role title="Designer · Arcway" dates="2019 – 22" bullets={[82]} />
        <Heading layout="modern">Skills</Heading>
        <Lines widths={[86, 70]} />
        <Heading layout="modern">Education</Heading>
        <Role title="B.Des · NID" dates="2019" bullets={[60]} />
      </span>
    );
  if (layout === 'tech')
    return (
      <span className="flex flex-col gap-[7px] px-4 pt-4">
        <span className="flex flex-col gap-[2px]">
          <span className="text-[10.5px] leading-none font-bold text-lp-heading">
            Daniel Okafor
          </span>
          <span className="font-mono text-[5.5px] text-lp-violet">full-stack engineer</span>
          <span className="text-[5px] text-lp-muted">github.com/dokafor · Lagos</span>
        </span>
        <Heading layout="tech">Skills</Heading>
        <span className="flex flex-wrap gap-[3px]">
          {['React', 'TypeScript', 'Node', 'PostgreSQL', 'AWS'].map((skill) => (
            <span
              key={skill}
              className="rounded-[3px] bg-lp-violet-soft px-[4px] py-[1.5px] font-mono text-[5px] text-lp-violet"
            >
              {skill}
            </span>
          ))}
        </span>
        <Heading layout="tech">Experience</Heading>
        <Role title="Engineer · Kestrel Pay" dates="2021 – now" bullets={[94, 80, 66]} />
        <Heading layout="tech">Projects</Heading>
        <Role title="queue-lite (open source)" dates="1.2k stars" bullets={[84]} />
      </span>
    );
  if (layout === 'bold')
    return (
      <span className="flex flex-col gap-[7px]">
        <span className="flex flex-col gap-[3px] bg-lp-heading px-4 pt-4 pb-3">
          <span className="text-[12px] leading-none font-extrabold tracking-[0.02em] text-lp-white">
            MAYA CHEN
          </span>
          <span className="text-[6px] font-semibold text-lp-beam-hot">Sales lead · B2B SaaS</span>
          <span className="text-[5px] text-lp-white/60">maya@mail.com · Singapore</span>
        </span>
        <span className="flex flex-col gap-[7px] px-4">
          <Heading layout="bold">Experience</Heading>
          <Role title="Sales lead · Northbeam" dates="2020 – now" bullets={[92, 84, 70]} />
          <Heading layout="bold">Skills</Heading>
          <Lines widths={[80, 62]} />
          <Heading layout="bold">Education</Heading>
          <Role title="BBA · NUS" dates="2016" bullets={[56]} />
        </span>
      </span>
    );
  return (
    <span className="flex flex-col gap-[8px] px-5 pt-[18px]">
      <span className="flex flex-col items-center gap-[3px] text-center">
        <span className="text-[10px] leading-none font-medium tracking-[0.08em] text-lp-heading">
          Sam Rivera
        </span>
        <span className="text-[5px] tracking-[0.12em] text-lp-muted uppercase">
          Data analyst · Austin
        </span>
      </span>
      <Heading layout="minimal">Experience</Heading>
      <Role title="Analyst · Fieldline" dates="2021 – now" bullets={[90, 74]} />
      <Heading layout="minimal">Skills</Heading>
      <Lines widths={[78, 58]} tone="bg-[#ebeaf2]" />
      <Heading layout="minimal">Education</Heading>
      <Role title="BS Statistics · UT" dates="2021" bullets={[54]} />
    </span>
  );
}

/** One paper sheet that tilts toward the pointer like a page lifted off a desk. */
function Sheet({ name, plan, layout }: { name: string; plan: 'Free' | 'Pro'; layout: Layout }) {
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), SPRING);
  const ry = useSpring(useMotionValue(0), SPRING);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 18);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 14);
  };
  const leave = () => {
    rx.set(0);
    ry.set(0);
  };
  return (
    <figure data-tk-sheet className="flex shrink-0 snap-start flex-col gap-2.5 [perspective:900px]">
      <motion.div
        onPointerMove={move}
        onPointerLeave={leave}
        whileHover={reduce ? undefined : { y: -10, scale: 1.04 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ rotateX: rx, rotateY: ry }}
        data-tk-paper
        className="relative h-[224px] w-[176px] overflow-hidden rounded-[10px] bg-lp-white shadow-[0_14px_30px_-10px_rgba(85,67,238,0.35)] ring-1 ring-lp-violet-line"
        aria-hidden
      >
        <Resume layout={layout} />
        {/* The parser's read pass: a band of light that runs down the page once. */}
        <span
          data-tk-scan
          className="pointer-events-none absolute inset-x-0 top-0 h-7 border-b border-lp-violet/70 bg-[linear-gradient(180deg,transparent,rgba(85,67,238,0.14))] opacity-0"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
          <span
            data-tk-chip
            className="flex items-center gap-1 rounded-full bg-lp-white px-2 py-[3px] text-[7px] font-semibold whitespace-nowrap text-lp-ink-2 shadow-[0_4px_12px_-4px_rgba(20,22,43,0.25)] ring-1 ring-[#10b981]/35"
          >
            <span className="size-[5px] rounded-full" style={{ backgroundColor: OK }} />
            Every section read
          </span>
        </span>
      </motion.div>
      <figcaption className="flex items-center gap-2">
        <span className="text-[14px] font-semibold whitespace-nowrap text-lp-heading">{name}</span>
        <span
          className={
            plan === 'Pro'
              ? 'rounded-full bg-lp-violet px-2 py-[3px] text-[11px] font-bold text-lp-white'
              : 'rounded-full bg-lp-violet-soft px-2 py-[3px] text-[11px] font-bold text-lp-violet'
          }
        >
          {plan}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Row 3 / Templates (528:991), as a glass band (Landing v2). On entry the sheets are dealt from a
 * stacked deck into their row while a light beam sweeps across them; then the parser reads each
 * page in turn (owner, 2026-11-21), ticking its sections. Each sheet tilts toward the pointer.
 * Below 1280px the sheets become a swipeable, snap-scrolling strip.
 */
export function TemplatesBand() {
  const root = useRef<HTMLDivElement>(null);
  useSceneOnce(root, (tl, q) => {
    const sheets = q('[data-tk-sheet]') as HTMLElement[];
    const wide = window.matchMedia('(min-width: 1280px)').matches;
    if (wide && sheets.length > 1) {
      const step =
        sheets[1]!.getBoundingClientRect().left - sheets[0]!.getBoundingClientRect().left;
      tl.from(sheets, {
        x: (i: number) => -i * step + i * 8,
        y: (i: number) => i * -4,
        rotate: (i: number) => (i - 1.5) * 5,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.07,
      });
    } else {
      tl.from(sheets, { x: 50, opacity: 0, rotate: 3, duration: 0.9, stagger: 0.09 });
    }
    tl.fromTo(
      q('[data-tk-sweep]'),
      { xPercent: -120, opacity: 0 },
      { xPercent: 260, opacity: 1, duration: 1.6, ease: 'power2.inOut' },
      0.2,
    ).to(q('[data-tk-sweep]'), { opacity: 0, duration: 0.4 }, '-=0.4');

    // The parser reads each page in turn: a scan band runs top to bottom, every section heading
    // gets its tick (and a brief green wash) as the band passes, and the sheet ends on its chip.
    // Every tween ends on the markup's own state, which is what reduced motion shows.
    const READ = 1.15;
    (q('[data-tk-paper]') as HTMLElement[]).forEach((paper, i) => {
      const at = 1.05 + i * 0.5;
      const h = paper.offsetHeight;
      const scan = paper.querySelector('[data-tk-scan]');
      tl.fromTo(
        scan,
        { y: -28, opacity: 0 },
        { y: h, opacity: 1, duration: READ, ease: 'none' },
        at,
      ).to(scan, { opacity: 0, duration: 0.25 }, at + READ - 0.25);
      paper.querySelectorAll<HTMLElement>('[data-tk-heading]').forEach((head) => {
        const when = at + (head.offsetTop / h) * READ;
        tl.fromTo(
          head.querySelector('[data-tk-tick]'),
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' },
          when,
        ).fromTo(
          head,
          { backgroundColor: 'rgba(16,185,129,0)' },
          {
            backgroundColor: 'rgba(16,185,129,0.12)',
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: 'power1.inOut',
          },
          when,
        );
      });
      tl.fromTo(
        paper.querySelector('[data-tk-chip]'),
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)' },
        at + READ - 0.1,
      );
    });
  });

  return (
    <div
      ref={root}
      data-tk-card
      data-tk-templates
      className="lp-glass flex flex-col gap-8 py-8 sm:py-9 xl:flex-row xl:items-center xl:gap-10 xl:px-10"
    >
      <span aria-hidden className="lp-glass-dots" />
      <LightBeam beam={{ x: 72, y: 10, w: 34, h: 110, rotate: -18 }} />
      {/* The sweep: a vertical light that passes over the sheets once. */}
      <span
        data-tk-sweep
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[30%] z-[1] w-[18%] bg-[linear-gradient(90deg,transparent,rgba(139,124,255,0.18),transparent)] opacity-0"
      />
      <div className="relative z-[2] flex flex-col gap-3.5 px-6 sm:px-10 xl:w-[400px] xl:shrink-0 xl:px-0">
        <h3 className="text-[28px] leading-[36px] font-semibold tracking-[-0.34px] text-lp-heading sm:text-[34px] sm:leading-[42px]">
          Templates the <AccentWord className="text-lp-violet">parser</AccentWord> can read.
        </h3>
        <p className="text-[15px] leading-[24px] text-lp-on-glass-dim sm:text-lp-body sm:leading-[27px]">
          Single column, standard headings, no photos, no tables. Free gets three; Pro gets the full
          library.
        </p>
      </div>
      <div
        data-tk-strip
        className="scrollbar-none relative z-[2] flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-6 px-6 pt-3 pb-1 sm:scroll-px-10 sm:px-10 xl:overflow-visible xl:p-0"
      >
        {TEMPLATES.map((t) => (
          <Sheet key={t.name} name={t.name} plan={t.plan} layout={t.layout} />
        ))}
      </div>
    </div>
  );
}
