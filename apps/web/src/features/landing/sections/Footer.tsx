'use client';

import { motion } from 'motion/react';
import { useRef } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { LightBeam } from '../parts/GlassCard';
import { MagneticButton } from '../parts/MagneticButton';
import { Reveal } from '../parts/Reveal';

/**
 * The board's four link columns (530:930–953), in its order. Links go to a real route or an
 * in-page section where one exists; pages the site does not have yet are "#".
 */
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'About',
    links: [
      { label: 'Company', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Contact', href: '#faq' },
    ],
  },
  {
    title: 'Product',
    links: [
      { label: 'Tailored resumes', href: '#how' },
      { label: 'NextKin Score', href: '#score' },
      { label: 'Cover letters', href: '#toolkit' },
      { label: 'Interview prep', href: '#toolkit' },
      { label: 'Templates', href: '#toolkit' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '#' },
      { label: 'Resume examples', href: '#' },
      { label: 'Scoring rubric', href: '#score' },
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Terms of service', href: '/legal/terms' },
    ],
  },
  {
    title: 'Help center',
    links: [
      { label: 'Getting started', href: '#how' },
      { label: 'Account setup', href: '/sign-up' },
      { label: 'Report an issue', href: '#' },
      { label: 'Contact support', href: '#faq' },
    ],
  },
];

/** "Coming soon" store chips (530:919, 530:924); the logos are stand-ins until official badges. */
const STORES = [
  { name: 'App Store', logo: '/landing/footer-logo-apple.svg' },
  { name: 'Google Play', logo: '/landing/footer-logo-google-play.svg' },
];

/**
 * 13 Footer (Figma 530:894). Pale inset card: a "Let's talk" connect row with the primary CTA
 * (on a light glass card since Landing v2, owner 2026-11-20), a divider, then the brand block and
 * four link columns.
 *
 * Motion: the glass card rises, its contents follow, the divider draws from the left, then the columns arrive one
 * after another with their links trickling in; links get a sliding underline on hover.
 */
export function Footer() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, () => {
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      scrollTrigger: {
        trigger: root.current,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
    tl.from(q('[data-footer-glass]'), { y: 30, opacity: 0, duration: 1 })
      .from(q('[data-footer-rise]'), { y: 24, opacity: 0, duration: 0.9, stagger: 0.1 }, '-=0.7')
      .from(q('[data-footer-divider]'), { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, '-=0.6')
      .from(
        q('[data-footer-brand] > *'),
        { y: 20, opacity: 0, duration: 0.8, stagger: 0.08 },
        '-=0.7',
      );
    q('[data-footer-col]').forEach((col, i) => {
      tl.from(
        col.querySelectorAll(':scope > *'),
        { y: 18, opacity: 0, duration: 0.7, stagger: 0.05 },
        0.7 + i * 0.12,
      );
    });
  });

  return (
    <footer ref={root} className="mt-6 px-3 pb-5 sm:px-5 lg:mt-10">
      <div className="mx-auto max-w-[1400px] overflow-clip rounded-[28px] bg-[#f7f6fd] px-3 py-3 sm:rounded-[40px] sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        {/* "Let's talk" on a light glass card (Landing v2, light tone, owner 2026-11-20). */}
        <div
          data-footer-glass
          className="lp-glass flex flex-col items-start gap-8 px-6 py-8 sm:px-10 sm:py-10 md:flex-row md:items-center md:justify-between"
        >
          <span aria-hidden className="lp-glass-dots" />
          <LightBeam beam={{ x: 88, y: 20, w: 34, h: 160, rotate: -28 }} />
          <LightBeam beam={{ x: 8, y: 100, w: 30, h: 90, rotate: 20 }} />
          <div className="relative z-[2] flex flex-col items-start">
            <div
              data-footer-rise
              className="inline-flex items-center gap-2.5 rounded-full border border-lp-glass-line bg-lp-violet-soft py-1.5 pr-4 pl-1.5"
            >
              <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
                <img src="/landing/footer-icon-sparkle.svg" alt="" width={14} height={14} />
              </span>
              <span className="text-[15px] font-semibold text-lp-on-glass">Let’s connect</span>
            </div>
            <Reveal
              as="h2"
              by="words"
              className="mt-5 text-[44px] leading-[1.15] font-semibold tracking-[-1.3px] text-lp-heading sm:text-[52px]"
            >
              Let’s <AccentWord className="text-lp-violet">talk</AccentWord>.
            </Reveal>
            <p
              data-footer-rise
              className="mt-3.5 text-[17px] leading-[26px] text-lp-on-glass-dim sm:text-[19px]"
            >
              Questions, feedback or ideas — we’d love to hear from you.
            </p>
          </div>
          <div data-footer-rise className="relative z-[2]">
            <MagneticButton
              href="/sign-up"
              className="group flex items-center gap-4 rounded-full bg-lp-ink py-2 pr-2 pl-7 text-[17px] font-semibold whitespace-nowrap text-lp-white shadow-[0_14px_30px_-14px_rgba(20,22,43,0.45)]"
            >
              Get started free
              <span
                className="flex size-11 items-center justify-center rounded-[22px] transition-transform duration-500 group-hover:rotate-45"
                style={{ backgroundImage: 'linear-gradient(135deg, #7c70f6 0%, #5543ee 71%)' }}
              >
                <img src="/landing/footer-icon-arrow-up-right.svg" alt="" width={20} height={20} />
              </span>
            </MagneticButton>
          </div>
        </div>

        <div className="px-3 pb-7 sm:px-6 sm:pb-8 lg:px-11 lg:pb-9">
          <div data-footer-divider className="mt-10 h-px origin-left bg-[#e7e5f4] lg:mt-12" />

          <div className="mt-10 flex flex-col gap-10 lg:mt-12 lg:flex-row lg:gap-10">
            <div
              data-footer-brand
              className="flex flex-col items-start gap-[18px] lg:w-[380px] lg:shrink-0"
            >
              <a href="#top" className="flex items-center gap-3" aria-label="NextKin, back to top">
                <img
                  src="/landing/footer-logo-mark.svg"
                  alt=""
                  width={38}
                  height={40}
                  className="h-10 w-[38px]"
                />
                <span className="text-[28px] font-semibold tracking-[-0.56px] text-lp-ink">
                  NextKin
                </span>
              </a>
              <p className="max-w-[380px] text-[16px] leading-[26px] text-lp-copy">
                NextKin tailors every application to the job — and shows its work.
              </p>
              <div className="flex flex-wrap gap-3">
                {STORES.map((store) => (
                  <motion.div
                    key={store.name}
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex items-center gap-3 rounded-xl border-[1.2px] border-[#e4e2f0] bg-lp-white px-4 py-2.5"
                  >
                    {/* 34px (owner, 2026-11-21: "increase both the icon size"). */}
                    <img src={store.logo} alt="" width={34} height={34} className="shrink-0" />
                    <span className="flex flex-col gap-px whitespace-nowrap">
                      <span className="text-[13px] font-semibold text-lp-ink">{store.name}</span>
                      <span className="text-[12px] text-lp-copy">Coming soon</span>
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="hidden flex-1 lg:block" />

            <nav
              aria-label="Footer"
              className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:flex lg:gap-10"
            >
              {COLUMNS.map((col) => (
                <div
                  key={col.title}
                  data-footer-col
                  className="flex flex-col items-start gap-4 lg:w-[170px]"
                >
                  <h3 className="mb-0.5 text-[18px] font-semibold text-lp-ink">{col.title}</h3>
                  {col.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="group relative text-[16px] whitespace-nowrap text-lp-copy transition-colors hover:text-lp-ink"
                    >
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-full origin-right scale-x-0 bg-lp-violet transition-transform duration-300 group-hover:origin-left group-hover:scale-x-100" />
                    </a>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
