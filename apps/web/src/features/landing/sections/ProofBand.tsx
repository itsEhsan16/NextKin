'use client';

import { useRef } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { Eyebrow } from '../parts/Eyebrow';
import { Marquee } from '../parts/Marquee';
import { RewriteCard, type Rewrite } from './scenes/proof/RewriteCard';

/** Row 1 (527:612): three cards, read in place. */
const ROW_ONE: Rewrite[] = [
  {
    before: 'Worked on the company website.',
    after: 'Rebuilt the checkout page in [[React]], cutting [[load time]] from 4.4s to 1.6s.',
    role: 'Frontend developer',
    icon: 'code',
  },
  {
    before: 'Handled social media.',
    after:
      'Planned 3 [[campaigns]] a month on Instagram and LinkedIn; grew followers 40% in 6 months.',
    role: 'Marketing associate',
    icon: 'megaphone',
  },
  {
    before: 'Did data analysis.',
    after: 'Built weekly [[SQL dashboards]] that cut [[reporting time]] from 2 days to 3 hours.',
    role: 'Data analyst',
    icon: 'database',
  },
];

/** Row 2 (527:617): the marquee, running the other way. */
const ROW_TWO: Rewrite[] = [
  ROW_ONE[2]!,
  {
    before: 'Helped customers.',
    after: 'Resolved 60+ [[support tickets]] a week with a 94% [[satisfaction score]].',
    role: 'Support specialist',
    icon: 'headset',
  },
  {
    before: 'Managed a team project.',
    after: 'Led a 4-person [[final-year project]] that shipped a working attendance app.',
    role: 'Fresh graduate',
    icon: 'grad-cap',
  },
  {
    before: 'Responsible for testing.',
    after: 'Wrote 300 [[automated tests]] that caught release bugs before [[production]].',
    role: 'QA engineer',
    icon: 'bug',
  },
];

/**
 * 05 Proof band (Figma 527:602, Landing v2 2026-11-20): the indigo band with its rewrites as dark
 * glass cards. Row 1 sits still; row 2 is a constant-speed marquee running the other way.
 *
 * Motion (time-based, one pass as the band arrives — no pin, no scrub, toreview §250.5): the
 * heading rises, row 1's cards glide up, then in each card the before line dims while a strike
 * draws through it, a band of light sweeps the card once, and the job-post words light up in turn.
 * Only opacity, transform and colour animate.
 */
export function ProofBand() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, () => {
    const band = root.current?.querySelector<HTMLElement>('[data-band]');
    if (!band) return;
    const q = gsap.utils.selector(band);
    const cards = q('[data-row-one] [data-rewrite-card]') as HTMLElement[];

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: band, start: 'top 75%', toggleActions: 'play none none none' },
    });
    tl.from(q('[data-lp-eyebrow]'), { y: 12, opacity: 0, duration: 0.7 })
      .from(q('[data-proof-title]'), { y: 24, opacity: 0, duration: 0.9 }, '<0.08')
      .from(q('[data-proof-sub]'), { y: 16, opacity: 0, duration: 0.8 }, '<0.1')
      .from(
        q('[data-row-one] [data-glass-card]'),
        { y: 48, opacity: 0, duration: 1.1, stagger: 0.14 },
        '<0.15',
      )
      .from(q('[data-row-two]'), { y: 40, opacity: 0, duration: 1.2 }, '<0.35');

    cards.forEach((card, i) => {
      const at = 0.95 + i * 0.32;
      tl.fromTo(
        card.querySelector('[data-before]'),
        { color: '#14162b' },
        { color: '#9a9fb2', duration: 0.6, ease: 'sine.inOut' },
        at,
      )
        .from(
          card.querySelector('[data-strike]'),
          { scaleX: 0, duration: 0.55, ease: 'power2.inOut' },
          at + 0.1,
        )
        .fromTo(
          card.querySelector('[data-sweep]'),
          { xPercent: -100, opacity: 1 },
          { xPercent: 420, opacity: 0, duration: 1.3, ease: 'power2.inOut' },
          at + 0.25,
        )
        .from(
          card.querySelectorAll('[data-hl]'),
          { color: '#14162b', duration: 0.6, stagger: 0.18, ease: 'sine.inOut' },
          at + 0.45,
        )
        .from(
          card.querySelector('[data-role-icon]'),
          { scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(2.5)' },
          at + 0.5,
        );
    });
  });

  return (
    <section id="proof" ref={root} className="mt-20 px-3 sm:px-5 lg:mt-[130px]">
      <div
        data-band
        data-nav-dark
        className="relative mx-auto flex max-w-[1400px] flex-col items-center overflow-clip rounded-[28px] bg-gradient-to-b from-[#1b1464] via-[#2a1f8f] via-60% to-[#3b2fc9] pt-12 pb-10 sm:rounded-[40px] sm:pt-16 sm:pb-14"
      >
        <Eyebrow
          tone="onViolet"
          icon={<img src="/landing/proof-icon-sparkle.svg" alt="" width={14} height={14} />}
        >
          Real rewrites
        </Eyebrow>

        <h2
          data-proof-title
          className="mt-5 px-5 text-center text-[36px] leading-[44px] font-semibold tracking-[-1px] text-lp-white sm:text-[44px] sm:leading-[52px] lg:text-lp-h2 lg:tracking-[-1.35px] lg:leading-[62px]"
        >
          See the difference on one <AccentWord className="text-[#b9b2ff]">bullet</AccentWord>.
        </h2>
        <p
          data-proof-sub
          className="mt-4 max-w-[872px] px-5 text-center text-[17px] leading-[27px] text-lp-white/86 sm:text-lp-body-l sm:leading-[30px] lg:max-w-none lg:px-0 lg:leading-normal lg:whitespace-nowrap"
        >
          The same experience, rewritten in the job’s own words. Highlighted words come from the job
          post.
        </p>

        {/* Row 1: still on desktop; a swipeable strip on smaller screens. */}
        <div
          data-row-one
          className="mt-11 flex w-full snap-x snap-mandatory scrollbar-none gap-5 overflow-x-auto px-5 pb-6 lg:justify-center lg:overflow-visible lg:px-[38px] lg:pb-0"
        >
          {ROW_ONE.map((item) => (
            <RewriteCard
              key={item.role}
              item={item}
              sweep
              className="w-[300px] snap-center sm:w-[360px] lg:h-[330px] lg:w-[428px]"
            />
          ))}
        </div>

        {/* Row 2: offset marquee running the other way. */}
        <div data-row-two className="mt-5 w-full">
          <Marquee reverse speed={28} trackClassName="gap-5 pr-5 py-3">
            {ROW_TWO.map((item) => (
              <RewriteCard
                key={item.role}
                item={item}
                className="w-[300px] sm:w-[360px] lg:h-[330px] lg:w-[410px]"
              />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
