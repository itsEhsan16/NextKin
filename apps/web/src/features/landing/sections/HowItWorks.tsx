'use client';

import { useRef, type ReactNode } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { Eyebrow } from '../parts/Eyebrow';
import { Reveal } from '../parts/Reveal';
import {
  AsksScene,
  KeywordsScene,
  PasteScene,
  ScoreScene,
  SendScene,
} from './scenes/how/HowScenes';

/**
 * The five steps. Since Landing v2 (owner 2026-11-20, toreview §251) each fragment is a dark
 * glass mini-scene with its own clay tile and looping micro-animation (scenes/how/HowScenes).
 */
const STEPS: { title: string; body: string; fragment: ReactNode }[] = [
  {
    title: 'Paste the job',
    body: 'A link from any board, or the text itself.',
    fragment: <PasteScene />,
  },
  {
    title: 'See what it asks',
    body: 'Every requirement, read from the post — not guessed.',
    fragment: <AsksScene />,
  },
  {
    title: 'Pick the keywords',
    body: 'Nothing is pre-selected. You choose what goes in.',
    fragment: <KeywordsScene />,
  },
  {
    title: 'Score, with its basis',
    body: 'Every number tells you what it counted.',
    fragment: <ScoreScene />,
  },
  { title: 'Send it', body: 'A clean PDF — no watermark, ATS-safe.', fragment: <SendScene /> },
];

/** The numbered badge (524:414). It starts pale and turns violet when the route reaches it. */
function Badge({ n }: { n: number }) {
  return (
    <span
      data-how-badge
      className="relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-lp-violet text-[17px] font-bold text-lp-white"
    >
      {n}
    </span>
  );
}

function StepText({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-lp-h3 font-semibold tracking-[-0.24px] text-lp-heading">{title}</h3>
      <p className="mt-2.5 text-lp-body text-lp-copy">{body}</p>
    </div>
  );
}

/**
 * 04 How it works (Figma 527:511): "One job in. One honest resume out." and the five-step path,
 * each step with a fragment of the product.
 *
 * Motion: the path is scrubbed to the scroll. A violet line runs along the dotted route (across on
 * wide screens, down on narrow ones) and each step wakes as the line reaches it: its badge pops
 * from pale to violet, and its text and glass scene rise in (the doodle hand was removed by the
 * owner, 2026-11-21). Since Landing v2, a soft light also runs along the
 * route between the badges, and each step's glass scene loops its own micro-animation.
 */
export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, () => {
    const q = gsap.utils.selector(root);

    // The path, scrubbed: one layout's elements are display:none, so pick the visible one.
    const layout = (q('[data-how-wide], [data-how-narrow]') as HTMLElement[]).find(
      (el) => el.offsetParent !== null,
    );
    if (!layout) return;

    // Route beams: a soft light runs along the route between the badges while it's on screen.
    layout.querySelectorAll<HTMLElement>('[data-how-pulse]').forEach((pulse, i) => {
      const track = pulse.parentElement!;
      const horizontal = track.offsetWidth > track.offsetHeight;
      gsap.fromTo(pulse, horizontal ? { x: 0, opacity: 0 } : { y: 0, opacity: 0 }, {
        ...(horizontal
          ? { x: () => track.offsetWidth - pulse.offsetWidth }
          : { y: () => track.offsetHeight - pulse.offsetHeight }),
        opacity: 1,
        duration: horizontal ? 3.2 : 1.4,
        delay: i * 0.25,
        ease: 'power1.inOut',
        repeat: -1,
        repeatDelay: horizontal ? 0.6 : 1.2,
        scrollTrigger: {
          trigger: layout,
          start: 'top bottom',
          end: 'bottom top',
          toggleActions: 'play pause resume pause',
        },
      });
    });
    const steps = Array.from(layout.querySelectorAll<HTMLElement>('[data-how-step]'));
    const lines = layout.querySelectorAll<HTMLElement>('[data-how-progress]');
    const wide = layout.hasAttribute('data-how-wide');

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: layout,
        start: wide ? 'top 78%' : 'top 70%',
        end: wide ? 'bottom 62%' : 'bottom 55%',
        scrub: 0.8,
      },
    });
    const at = (i: number) => i; // one unit of timeline per step
    if (wide) {
      tl.fromTo(
        lines[0]!,
        { scaleX: 0 },
        { scaleX: 1, ease: 'none', duration: steps.length - 1 },
        0,
      );
    }
    steps.forEach((step, i) => {
      const badge = step.querySelector('[data-how-badge]');
      const text = step.querySelectorAll('h3, h3 + p');
      const frag = step.querySelector('[data-how-fragment]');
      if (!wide && lines[i]) {
        tl.fromTo(lines[i]!, { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: 1 }, at(i));
      }
      tl.fromTo(
        badge,
        { scale: 0.6, backgroundColor: '#e4e1fb', color: '#8a8fa3' },
        {
          scale: 1,
          backgroundColor: '#5543ee',
          color: '#ffffff',
          duration: 0.35,
          ease: 'back.out(3)',
        },
        at(i),
      )
        .from(text, { y: 24, opacity: 0.15, duration: 0.5, stagger: 0.08 }, at(i) + 0.05)
        .from(frag, { y: 36, opacity: 0, scale: 0.94, duration: 0.6 }, at(i) + 0.15);
    });
  });

  return (
    <section id="how" ref={root} className="mt-20 scroll-mt-24 px-5 lg:mt-[130px] lg:px-10">
      <div className="mx-auto max-w-[1360px]">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col items-start gap-[22px]">
            <Eyebrow
              icon={
                <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
                  <img src="/landing/icon-sparkle-on-violet.svg" alt="" width={14} height={14} />
                </span>
              }
              className="border-transparent text-lp-ink-2"
            >
              How it works
            </Eyebrow>
            <Reveal
              as="h2"
              className="text-[38px] leading-[46px] font-semibold tracking-[-1.35px] text-lp-heading sm:text-lp-h2 sm:tracking-[-1.35px] sm:leading-[62px]"
            >
              One job in.
              <br />
              One <AccentWord className="text-lp-violet">honest</AccentWord> resume out.
            </Reveal>
            <Reveal
              as="p"
              delay={0.15}
              className="text-[17px] leading-[27px] text-lp-copy sm:text-lp-body-l sm:leading-[30px]"
            >
              Five steps, and you can see the reasoning at every one of them.
            </Reveal>
          </div>
        </div>

        {/* Wide (≥1280): five columns on one dotted route. */}
        <div data-how-wide className="relative mt-12 hidden xl:block">
          <div className="absolute top-[19px] left-5 h-0.5 w-[calc(80%+20.8px)]">
            <img src="/landing/how-dotted-route.svg" alt="" className="block size-full" />
            {/* Empty until the scroll fills it, so without motion the board's dotted route shows. */}
            <span
              data-how-progress
              className="absolute inset-0 origin-left rounded-full bg-lp-violet"
              style={{ transform: 'scaleX(0)' }}
            />
            <span
              aria-hidden
              data-how-pulse
              className="absolute top-1/2 left-0 h-2 w-20 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,#7266f7,rgba(85,67,238,0.45)_40%,transparent)] opacity-0"
            />
          </div>
          <ol className="relative grid grid-cols-5 gap-[26px]">
            {STEPS.map((step, i) => (
              <li key={step.title} data-how-step className="flex flex-col items-start gap-[18px]">
                <div className="flex flex-col items-start gap-3.5">
                  <Badge n={i + 1} />
                  <StepText title={step.title} body={step.body} />
                </div>
                {step.fragment}
              </li>
            ))}
          </ol>
        </div>

        {/* Narrow (<1280): the route runs down the left. */}
        <ol data-how-narrow className="mt-12 xl:hidden">
          {STEPS.map((step, i) => (
            <li key={step.title} data-how-step className="relative flex gap-5 pb-10 last:pb-0">
              {i < STEPS.length - 1 ? (
                <span className="absolute top-[44px] bottom-1 left-[19px] w-0.5">
                  <span className="absolute inset-0 border-l-2 border-dotted border-lp-violet/50" />
                  <span
                    data-how-progress
                    className="absolute inset-0 origin-top rounded-full bg-lp-violet"
                    style={{ transform: 'scaleY(0)' }}
                  />
                  <span
                    aria-hidden
                    data-how-pulse
                    className="absolute top-0 left-1/2 h-10 w-2 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#7266f7,rgba(85,67,238,0.45)_40%,transparent)] opacity-0"
                  />
                </span>
              ) : null}
              <Badge n={i + 1} />
              <div className="grid min-w-0 flex-1 gap-4 pt-1 md:grid-cols-[1fr_minmax(0,300px)] md:gap-8">
                <StepText title={step.title} body={step.body} />
                <div className="max-w-[340px]">{step.fragment}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
