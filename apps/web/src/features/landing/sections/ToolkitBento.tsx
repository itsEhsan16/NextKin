'use client';

import { useRef } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { ClayTile } from '../parts/ClayTile';
import { GlassCard } from '../parts/GlassCard';
import { Reveal } from '../parts/Reveal';
import { AssistantScene } from './scenes/toolkit/AssistantScene';
import { ReadingScene } from './scenes/toolkit/ReadingScene';
import { SkillsScene } from './scenes/toolkit/SkillsScene';
import { TrackScene } from './scenes/toolkit/TrackScene';
import { TemplatesBand } from './toolkit/TemplatesBand';

const SCENE = 'px-5 pt-5 sm:px-7 sm:pt-7';

/**
 * 08 Toolkit bento (Figma 528:707, rebuilt as Landing v2 dark glass cards, toreview §251): the
 * header on the light page, then four glass use-case cards — each a detailed mini-UI scene with its
 * own micro-animation loop that runs only while on screen — and the templates band.
 *
 * Section motion: the header rises; each row's cards glide up in a stagger.
 */
export function ToolkitBento() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, ({ isDesktop }) => {
    const q = gsap.utils.selector(root);
    const onEnter = (trigger: Element, start = 'top 82%') => ({
      trigger,
      start,
      toggleActions: 'play none none none',
    });
    gsap.from(q('[data-tk-eyebrow]'), {
      y: 14,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: onEnter(root.current!, 'top 85%'),
    });
    gsap.from(q('[data-tk-aside]'), {
      x: isDesktop ? 30 : 0,
      y: isDesktop ? 0 : 16,
      opacity: 0,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: onEnter(root.current!, 'top 80%'),
    });
    q('[data-tk-row]').forEach((row) => {
      gsap.from(row.querySelectorAll(':scope > [data-glass-card], :scope > [data-tk-card]'), {
        y: 56,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.12,
        scrollTrigger: onEnter(row, 'top 86%'),
      });
    });
  });

  return (
    <section
      id="toolkit"
      ref={root}
      className="mx-auto mt-20 max-w-[1360px] px-5 lg:mt-[130px] lg:px-10 2xl:px-0"
    >
      {/* Header (528:708) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col items-start gap-[22px]">
          <div
            data-tk-eyebrow
            className="inline-flex items-center gap-2.5 rounded-full bg-lp-violet-soft py-1.5 pr-4 pl-1.5 text-lp-eyebrow font-semibold text-lp-ink-2"
          >
            <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
              <img src="/landing/toolkit-icon-sparkle.svg" alt="" width={14} height={14} />
            </span>
            The toolkit
          </div>
          <Reveal
            as="h2"
            className="text-[38px] leading-[46px] font-semibold tracking-[-1.2px] text-lp-heading sm:text-[46px] sm:leading-[54px] lg:text-lp-h2 lg:tracking-[-1.35px] lg:leading-[62px]"
          >
            Everything you need
            <br />
            to land the <AccentWord className="text-lp-violet">right</AccentWord> job.
          </Reveal>
        </div>
        <p
          data-tk-aside
          className="max-w-[440px] text-[16px] leading-[27px] text-lp-copy sm:text-[18px] sm:leading-[30px] lg:text-right"
        >
          Fresh graduate, career switcher or ten years in — NextKin works from what you’ve actually
          done.
        </p>
      </div>

      {/* Row 1 (528:716) */}
      <div data-tk-row className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-[560fr_776fr]">
        <GlassCard
          dots
          beam={{ x: 18, y: 0, w: 46, h: 70, rotate: -30 }}
          visual={<SkillsScene />}
          visualClassName={SCENE}
          icon={<ClayTile scene="grad-cap" size={40} />}
          title="For fresh graduates & switchers"
          body="Turn projects, internships and coursework into a resume that answers the job."
        />
        <GlassCard
          beam={{ x: 82, y: 4, w: 40, h: 80, rotate: 24 }}
          visual={<TrackScene />}
          visualClassName={SCENE}
          icon={<ClayTile scene="bar-chart" size={40} />}
          title="Modern tools to track every application"
          body="See what you sent, where, and what happened next."
        />
      </div>

      {/* Row 2 (528:912) */}
      <div data-tk-row className="mt-6 grid gap-6 lg:mt-14 lg:grid-cols-[736fr_600fr]">
        <GlassCard
          dots
          beam={{ x: 30, y: 0, w: 40, h: 70, rotate: -20 }}
          visual={<ReadingScene />}
          visualClassName={SCENE}
          icon={<ClayTile scene="scanner" size={40} />}
          title="Reads your resume the way recruiters do"
          body="Upload a PDF, DOCX or plain text — NextKin finds every section and asks you to confirm before anything is saved."
        />
        <GlassCard
          beam={{ x: 60, y: 6, w: 44, h: 80, rotate: 18 }}
          visual={<AssistantScene />}
          visualClassName={SCENE}
          icon={<ClayTile scene="chat" size={40} />}
          title="Help whenever you need it"
          body="Ask the NextKin assistant about your resume or any job, any time."
        />
      </div>

      {/* Row 3 / Templates (528:991) */}
      <div data-tk-row className="mt-6 lg:mt-14">
        <TemplatesBand />
      </div>
    </section>
  );
}
