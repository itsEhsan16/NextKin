'use client';

import { motion } from 'motion/react';
import { useRef } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { ClayTile } from '../parts/ClayTile';
import { Eyebrow } from '../parts/Eyebrow';
import { GlassCard } from '../parts/GlassCard';
import { Reveal } from '../parts/Reveal';
import { DealScene } from './scenes/problem/DealScene';
import { FlagScene } from './scenes/problem/FlagScene';
import { GaugeScene } from './scenes/problem/GaugeScene';

/**
 * 03 The problem (Figma 525:647; Landing v2 cards, owner 2026-11-20, toreview §251): eyebrow,
 * heading with its serif "problem", an outline link to How it works, and three dark glass cards.
 * Each card runs its own looping micro-scene (sections/scenes/problem) while it is on screen:
 * a generic PDF dealt to six jobs that never reply, a dial sweeping to 58 minutes, and an
 * interview-prep inbox flagging the claim you can't defend. The cards rise in on entry.
 */
export function Problem() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, ({ isDesktop }) => {
    const q = gsap.utils.selector(root);
    gsap.from(q('[data-problem-eyebrow], [data-problem-cta]'), {
      y: 16,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: root.current,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
    const cards = q('[data-problem-card]') as HTMLElement[];
    gsap.from(cards, {
      y: 70,
      opacity: 0,
      rotate: (i: number) => (isDesktop ? (i - 1) * 2 : 0),
      transformOrigin: '50% 100%',
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.12,
      scrollTrigger: { trigger: cards[0], start: 'top 88%', toggleActions: 'play none none none' },
    });
  });

  return (
    <section id="problem" ref={root} className="mt-10">
      <div className="mx-auto max-w-[1440px] px-5 pt-12 pb-16 md:px-10 lg:px-16 lg:pb-[104px]">
        <div data-problem-eyebrow>
          <Eyebrow
            icon={
              <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
                <img src="/landing/icon-sparkle-on-violet.svg" alt="" width={14} height={14} />
              </span>
            }
            className="border-transparent text-lp-ink-2"
          >
            Why NextKin
          </Eyebrow>
        </div>

        <div className="mt-[30px] flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-[700px] flex-col gap-[18px]">
            <Reveal
              as="h2"
              className="text-[34px] leading-[40px] font-semibold tracking-[-1.15px] text-lp-ink md:text-[46px] md:leading-[52px]"
            >
              The job-search{' '}
              <AccentWord className="text-[1.13em] text-lp-violet">problem</AccentWord>
              <br />
              every applicant faces
            </Reveal>
            <Reveal
              as="p"
              delay={0.15}
              className="max-w-[580px] text-[17px] leading-[27px] text-[#475569]"
            >
              One generic resume goes out to forty jobs and none of them answer the posting. NextKin
              reads the job description and rewrites to it — without inventing a single skill you
              don’t have.
            </Reveal>
          </div>
          <motion.a
            data-problem-cta
            href="#how"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="self-start rounded-full border border-[#e2e8f0] bg-lp-white px-6 py-[13px] text-[15px] font-semibold whitespace-nowrap text-[#0f172a] transition-colors hover:border-lp-violet hover:text-lp-violet md:self-auto"
          >
            How it works
          </motion.a>
        </div>

        <div
          data-problem-cards
          className="mt-[52px] grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <div data-problem-card>
            <GlassCard
              className="h-full min-h-[440px]"
              dots
              beam={{ x: 82, y: 4, w: 46, h: 70, rotate: -28 }}
              visual={<DealScene />}
              icon={<ClayTile scene="paper-stack" size={40} float={false} />}
              title="One resume for every job"
              body="The same PDF goes to every posting. Recruiters see a profile written for nobody in particular."
            />
          </div>
          <div data-problem-card>
            <GlassCard
              className="h-full min-h-[440px]"
              beam={[
                { x: 70, y: 18, w: 60, h: 60, rotate: -20 },
                { x: 20, y: 90, w: 40, h: 40, rotate: 0 },
              ]}
              visual={<GaugeScene />}
              icon={<ClayTile scene="hourglass" size={40} float={false} />}
              title="Hours of manual rewriting"
              body="Re-reading the posting, moving bullets, re-checking dates — an hour per application that could go into interview prep."
            />
          </div>
          <div data-problem-card className="md:col-span-2 lg:col-span-1">
            <GlassCard
              className="h-full min-h-[440px]"
              dots
              beam={{ x: 12, y: 2, w: 44, h: 60, rotate: 24 }}
              visual={<FlagScene />}
              icon={<ClayTile scene="puzzle" size={40} float={false} />}
              title="Skills that quietly don’t match"
              body="A keyword slipped in to pass the filter becomes a question you can’t answer in the room."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
