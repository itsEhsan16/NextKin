'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useId, useRef, useState } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { Reveal } from '../parts/Reveal';
import { ContactCard } from './scenes/faq/ContactCard';

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

/**
 * The board's eight questions (530:822), in its order. The first two answers are the board's own;
 * the board leaves the closed items' answers out, so those are written from the product's facts
 * (plan limits in apps/mobile/src/features/billing/upgradeCopy.ts, V2 §13).
 */
const ITEMS = [
  {
    q: 'What does NextKin change on my resume?',
    a: 'It rewrites your summary, bullet order and wording so the job’s real requirements come first. Nothing is added that your history doesn’t support.',
  },
  {
    q: 'Will it invent skills to beat the filter?',
    a: 'No. A skill you don’t have shows up as a gap to fix, never as a claim. Every line stays traceable to something you actually did.',
  },
  {
    q: 'How is the NextKin Score calculated?',
    a: 'It reads the job post’s own requirements and checks how many your resume backs up, plus whether the resume is structured so screening software can read it. Every point shows its basis, so you can see exactly what moved it.',
  },
  {
    q: 'Is the free plan really free?',
    a: 'Yes. Free includes 3 tailored resumes a month and clean PDF export, with no card needed. Pro lifts the limits when you need more.',
  },
  {
    q: 'Which files can I upload and export?',
    a: 'Upload your resume as PDF, DOCX or TXT. Export PDF and TXT on every plan; DOCX export is part of Pro.',
  },
  {
    q: 'Is my resume data kept private?',
    a: 'Your resume is used to tailor your own applications and nothing else. You can delete your account and everything in it at any time.',
  },
  {
    q: 'Do I need a resume to start?',
    a: 'No. Answer a few questions and NextKin builds a first resume from scratch, then tailors it to the job like any other.',
  },
  {
    q: 'How do I upgrade to Pro?',
    a: 'Open Upgrade in the app any time. Your resumes, scores and saved jobs carry straight over.',
  },
];

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <motion.div
      data-faq-item
      initial={false}
      animate={{
        backgroundColor: open ? '#f6f5ff' : '#ffffff',
        borderColor: open ? 'rgba(139,124,255,0.55)' : '#ecebf6',
        boxShadow: open
          ? '0 0 0 4px rgba(139,124,255,0.12), 0 16px 36px -18px rgba(85,67,238,0.45)'
          : '0 0 0 0px rgba(139,124,255,0), 0 0px 0px 0px rgba(85,67,238,0)',
      }}
      whileHover={open ? undefined : { borderColor: 'rgba(85,67,238,0.35)' }}
      transition={{ duration: 0.35, ease: EASE }}
      className="rounded-2xl border-[1.2px] border-solid"
    >
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={onToggle}
          className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-7 sm:py-6"
        >
          <span className="min-w-0 flex-1 text-[17px] font-medium text-lp-ink sm:text-[19px]">
            {question}
          </span>
          {/* Plus ↔ minus: the vertical stroke folds away while the whole mark turns. */}
          <motion.span
            aria-hidden
            animate={{
              rotate: open ? 180 : 0,
              backgroundColor: open ? '#5543ee' : 'rgba(85,67,238,0.08)',
            }}
            transition={SPRING}
            className="flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <svg viewBox="0 0 16 16" width={14} height={14} fill="none">
              <motion.path
                d="M2.5 8h11"
                animate={{ stroke: open ? '#ffffff' : '#5543ee' }}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <motion.path
                d="M8 2.5v11"
                style={{ originX: '50%', originY: '50%' }}
                animate={{ scaleY: open ? 0 : 1, stroke: open ? '#ffffff' : '#5543ee' }}
                transition={SPRING}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${id}-answer`}
            role="region"
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: SPRING, opacity: { duration: 0.3, ease: EASE } }}
            className="overflow-hidden"
          >
            <motion.p
              initial={{ y: -6 }}
              animate={{ y: 0 }}
              exit={{ y: -6 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="px-5 pb-5 text-[16px] leading-[26px] text-lp-copy sm:px-7 sm:pb-6 sm:text-[17px] sm:leading-[28px]"
            >
              {answer}
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * 11 FAQ + contact (Figma 530:810). A sticky contact column beside the accordion. The board
 * draws the first two questions open, so they start open; several may be open at once.
 *
 * Landing v2 (owner, 2026-11-20): the contact column ends in a light glass card (avatar stack, a
 * typing bubble that becomes a reply, "A person reads every message"). The items stay light; an
 * open item gets a violet glow edge, its height springs open, and its plus folds into a minus.
 */
export function Faq() {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set([0, 1]));

  useLandingMotion(root, () => {
    const q = gsap.utils.selector(root);
    gsap.from(q('[data-faq-item]'), {
      y: 36,
      opacity: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.07,
      scrollTrigger: {
        trigger: q('[data-faq-list]')[0] as HTMLElement,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
    gsap.from(q('[data-faq-contact] > *:not(h2)'), {
      // The glass card's own scene plays inside it; this only brings the column in.
      y: 20,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: root.current,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });
  });

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section
      id="faq"
      ref={root}
      className="mx-auto mt-20 max-w-[1360px] scroll-mt-24 px-5 lg:mt-[130px] lg:px-10"
    >
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        <div
          data-faq-contact
          className="flex flex-col items-start gap-5 lg:sticky lg:top-28 lg:w-[500px] lg:shrink-0"
        >
          <div className="inline-flex items-center gap-2.5 rounded-full bg-lp-violet-soft py-1.5 pr-4 pl-1.5">
            <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
              <img src="/landing/faq-icon-sparkle.svg" alt="" width={14} height={14} />
            </span>
            <span className="text-lp-eyebrow font-semibold text-lp-ink-2">FAQ</span>
          </div>
          <Reveal
            as="h2"
            className="text-[40px] leading-[48px] font-semibold tracking-[-1.2px] text-lp-ink sm:text-lp-h2 sm:tracking-[-1.35px] sm:leading-[62px]"
          >
            Questions,
            <br />
            answered <AccentWord className="text-lp-violet">straight</AccentWord>.
          </Reveal>
          <p className="text-[17px] leading-[27px] text-lp-copy sm:text-lp-body-l sm:leading-[30px]">
            How NextKin writes, scores and keeps your data. Still stuck? A person reads every
            message.
          </p>
          <div className="mt-2 w-full">
            <ContactCard />
          </div>
        </div>

        <div data-faq-list className="flex min-w-0 flex-1 flex-col gap-3.5">
          {ITEMS.map((item, i) => (
            <FaqItem
              key={item.q}
              question={item.q}
              answer={item.a}
              open={open.has(i)}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
