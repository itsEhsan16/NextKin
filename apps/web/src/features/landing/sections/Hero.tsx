'use client';

import { motion, useAnimationControls } from 'motion/react';
import { getImageProps } from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { AccentWord } from '../parts/AccentWord';
import { AnnotationTag } from '../parts/AnnotationTag';
import { Eyebrow } from '../parts/Eyebrow';
import { gsap, MOTION_OK, SplitText, useLandingMotion } from '../motion/gsap';

/** The field's own placeholder (525:428), then example links typed in turn. */
const PLACEHOLDER = 'Paste a job link from LinkedIn, Indeed, Naukri…';
const TYPED = [
  'linkedin.com/jobs/view/senior-product-designer',
  'naukri.com/job-listings-frontend-engineer-bengaluru',
  'indeed.com/viewjob?jk=data-analyst-remote',
  'wellfound.com/jobs/ux-researcher',
];

/**
 * The placeholder types example job links while the field is empty and unfocused, and rests on
 * the board's own text. Off under reduced motion.
 */
function useTypedPlaceholder(paused: boolean) {
  const [text, setText] = useState(PLACEHOLDER);
  useEffect(() => {
    if (paused || !window.matchMedia(MOTION_OK).matches) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });
    void (async () => {
      await wait(3000);
      for (let i = 0; !cancelled; i = (i + 1) % TYPED.length) {
        const word = TYPED[i]!;
        for (let c = 1; c <= word.length && !cancelled; c++) {
          setText(word.slice(0, c));
          await wait(38 + Math.random() * 40);
        }
        await wait(1500);
        for (let c = word.length; c >= 0 && !cancelled; c--) {
          setText(word.slice(0, c));
          await wait(16);
        }
        setText(PLACEHOLDER);
        await wait(2400);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setText(PLACEHOLDER);
    };
  }, [paused]);
  return paused ? PLACEHOLDER : text;
}

/** The "Paste a job link" field (525:423): carries the link to sign-up. */
/**
 * The hero's app picture, art-directed: the mobile app's Home below 640px, the web dashboard above.
 * `getImageProps` gives each its own optimised srcset, so a phone downloads only its own picture.
 */
function HeroPicture() {
  const common = {
    alt: 'NextKin Home: quick start, top job matches with their match score, and your resume progress',
    fill: true,
    priority: true,
  } as const;
  const {
    props: { srcSet: phone },
  } = getImageProps({ ...common, src: '/landing/hero-mobile-home.webp', sizes: '72vw' });
  const { props: desktop } = getImageProps({
    ...common,
    src: '/landing/hero-dashboard.png',
    sizes: '(min-width: 1440px) 1290px, 92vw',
  });
  return (
    <picture>
      <source media="(max-width: 639px)" srcSet={phone} />
      <img {...desktop} alt={common.alt} className="object-cover object-top" />
    </picture>
  );
}

function JobLinkForm() {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const placeholder = useTypedPlaceholder(focused || value !== '');
  const input = useRef<HTMLInputElement>(null);
  const shake = useAnimationControls();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const link = value.trim();
    if (!link) {
      input.current?.focus();
      void shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } });
      return;
    }
    window.location.assign(`/sign-up?job=${encodeURIComponent(link)}`);
  };

  return (
    // The moving glass ring wraps the board's pill (owner, 2026-11-20); see `.lp-glass-ring`.
    <div data-hero-form data-nav-light className="lp-glass-ring w-full max-w-[730px]">
      <motion.form
        animate={shake}
        onSubmit={submit}
        className="relative z-[2] flex w-full items-center gap-2.5 rounded-full bg-lp-white py-2 pr-2 pl-2.5 shadow-lp-field sm:gap-3.5"
      >
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-[24px] bg-lp-violet-soft sm:flex">
          <img src="/landing/icon-link.svg" alt="" width={22} height={22} />
        </span>
        <label htmlFor="lp-job-link" className="sr-only">
          Job link
        </label>
        <input
          ref={input}
          id="lp-job-link"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent pl-3 text-[15px] leading-normal text-lp-ink outline-none placeholder:text-lp-muted sm:pl-0 sm:text-[17px]"
        />
        <button
          type="submit"
          className="lp-button-gradient flex shrink-0 items-center gap-2.5 h-12 rounded-full px-5 text-[15px] leading-normal font-semibold whitespace-nowrap text-lp-white transition-opacity hover:opacity-95 sm:h-[53px] sm:px-[26px] sm:text-[17px]"
        >
          <span className="sm:hidden">Tailor</span>
          <span className="hidden sm:inline">Tailor my resume</span>
          <img src="/landing/icon-arrow-white.svg" alt="" width={18} height={18} />
        </button>
      </motion.form>
    </div>
  );
}

/**
 * 01 Hero (Figma 525:390), as drawn: violet inset card with the nav row, eyebrow, the display
 * headline with its serif "honestly", the job-link field, the note, and the app's Home screen as
 * the dashboard mock, clipped by the card's bottom edge, with its Basis tag.
 *
 * Motion only brings these in: the copy builds in on load, the mock rises tilted and lands flat
 * as it scrolls into place, and the Basis tag pins itself last. At rest it is the board.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, ({ isDesktop }) => {
    const q = gsap.utils.selector(root);
    const title = q('[data-hero-title]')[0] as HTMLElement;
    const split = SplitText.create(title, { type: 'words' });

    gsap
      .timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
      .from(q('[data-lp-eyebrow]'), { y: 12, opacity: 0, duration: 0.8 }, 0.1)
      .from(split.words, { yPercent: 60, opacity: 0, duration: 1.1, stagger: 0.05 }, '<0.1')
      .from(q('[data-hero-sub]'), { y: 16, opacity: 0, duration: 0.9 }, '-=0.8')
      .from(q('[data-hero-form]'), { y: 20, opacity: 0, duration: 0.9 }, '-=0.7')
      .from(q('[data-hero-note]'), { opacity: 0, duration: 0.7 }, '-=0.6')
      .from(q('[data-hero-mock]'), { y: 100, opacity: 0, duration: 1.3 }, '-=0.9');

    // The mock rises tilted back and lands flat (its board state) as it scrolls into place.
    gsap.fromTo(
      q('[data-hero-tilt]'),
      { rotateX: isDesktop ? 20 : 12, transformOrigin: '50% 0%' },
      {
        rotateX: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: q('[data-hero-mock]')[0] as HTMLElement,
          start: 'top 95%',
          end: 'top 40%',
          scrub: 0.6,
        },
      },
    );

    // The copy drifts up and fades a touch as the hero scrolls away.
    gsap.to(q('[data-hero-copy]'), {
      yPercent: -18,
      opacity: 0.2,
      ease: 'none',
      scrollTrigger: { trigger: root.current, start: 'top top', end: '45% top', scrub: true },
    });

    const tag = q('[data-hero-tag]')[0] as HTMLElement | undefined;
    if (tag) {
      gsap
        .timeline({
          scrollTrigger: { trigger: tag, start: 'top 80%', toggleActions: 'play none none none' },
        })
        .from(tag.querySelector('.lp-tag-pin'), { scale: 0, duration: 0.4, ease: 'back.out(3)' })
        .from(tag.querySelector('.lp-tag-leader'), { scaleX: 0, duration: 0.5, ease: 'power2.out' })
        .from(tag.querySelector('.lp-tag-label'), { x: -12, opacity: 0, duration: 0.5 }, '-=0.15');
    }
    // A soft light that follows the pointer across the violet.
    const glow = q('[data-hero-glow]')[0] as HTMLElement | undefined;
    const ground = root.current?.querySelector<HTMLElement>('[data-hero-ground]');
    if (isDesktop && glow && ground) {
      const xTo = gsap.quickTo(glow, 'x', { duration: 0.9, ease: 'power3' });
      const yTo = gsap.quickTo(glow, 'y', { duration: 0.9, ease: 'power3' });
      const move = (e: PointerEvent) => {
        const r = ground.getBoundingClientRect();
        xTo(e.clientX - r.left);
        yTo(e.clientY - r.top);
      };
      gsap.set(glow, { x: ground.clientWidth / 2, y: 300, opacity: 1 });
      ground.addEventListener('pointermove', move);
      return () => {
        ground.removeEventListener('pointermove', move);
        split.revert();
      };
    }
    return () => split.revert();
  });

  return (
    <section id="top" ref={root} className="px-3 pt-3 sm:px-5 sm:pt-5">
      <div
        data-hero-ground
        data-nav-dark
        className="lp-hero-ground relative mx-auto max-w-[1400px] overflow-clip rounded-[28px] sm:rounded-[40px]"
      >
        <div
          data-hero-glow
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 mix-blend-soft-light"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.55), transparent 62%)' }}
        />
        {/* The fixed nav (LandingNav) sits over this row. */}
        <div aria-hidden className="h-[76px] sm:h-[84px]" />

        <div
          data-hero-copy
          className="relative flex flex-col items-center px-5 pt-12 text-center sm:pt-[70px]"
        >
          <Eyebrow
            tone="onViolet"
            icon={<img src="/landing/icon-sparkle-white.svg" alt="" width={14} height={14} />}
            // Phones (2026-11-22): 12px and tighter spacing keep it on one line at 375; on the
            // narrowest phones the label wraps rather than ending in an ellipsis.
            className="max-w-full gap-2 pr-3.5 text-[12px] sm:gap-2.5 sm:pr-4 sm:text-lp-eyebrow [&>span:last-child]:overflow-visible [&>span:last-child]:text-left [&>span:last-child]:whitespace-normal"
          >
            Show your work · every number has a basis
          </Eyebrow>

          <h1
            data-hero-title
            className="mt-[26px] max-w-[968px] text-[42px] leading-[50px] font-semibold tracking-[-1.4px] text-lp-white sm:text-[58px] sm:leading-[66px] sm:tracking-[-2px] lg:max-w-none lg:text-lp-display lg:leading-[86px] lg:tracking-[-2.28px] lg:whitespace-nowrap"
          >
            Every resume, written <br className="hidden lg:block" />
            <AccentWord>honestly</AccentWord> for the job you want.
          </h1>

          <p
            data-hero-sub
            className="mt-6 max-w-[658px] text-[17px] leading-[27px] text-lp-white/88 sm:text-lp-body-l sm:leading-[30px]"
          >
            Paste a job and NextKin rewrites your resume to match it — then shows you why, line by
            line. It never adds a skill you don’t have.
          </p>

          <div className="mt-9 flex w-full justify-center">
            <JobLinkForm />
          </div>

          <p
            data-hero-note
            className="mt-4 text-[14px] leading-[19px] font-medium text-lp-white/82 sm:text-[15px]"
          >
            Free to start · 3 tailored resumes a month · no card needed
          </p>
        </div>

        {/* Dashboard mock (525:436): the app's own Home, clipped by the hero's bottom edge. On
            phones (owner, 2026-11-21) it is the mobile app's Home instead (NEXKTKIN-PVT "Home
            Screen New" 414:1105) in a portrait glass frame, its lower half under the hero's edge.
            One <picture> serves the right file per width, so phones never fetch the dashboard. */}
        <div
          data-hero-mock
          data-nav-light
          className="relative mx-[2.8%] mt-12 aspect-[5/6] min-h-0 [perspective:1800px] sm:mt-16 sm:aspect-[1321/616]"
        >
          <div
            data-hero-tilt
            className="relative mx-auto aspect-[390/1111] w-[72%] max-w-[300px] rounded-[38px] border-[1.5px] border-lp-white/50 bg-lp-white/28 p-[3%] shadow-lp-mock sm:aspect-[1321/837] sm:w-full sm:max-w-none sm:rounded-[32px] sm:p-[1.06%]"
          >
            <div className="relative size-full overflow-hidden rounded-[30px] sm:rounded-[22px]">
              <HeroPicture />
            </div>
            <div data-hero-tag className="absolute top-[56.56%] left-[30.24%] hidden md:block">
              <AnnotationTag note="Matched against the job’s own requirements" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
