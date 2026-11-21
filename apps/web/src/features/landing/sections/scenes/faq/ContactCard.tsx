'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { useRef } from 'react';

import { useSceneLoop } from '../../../motion/loop';
import { ClayTile } from '../../../parts/ClayTile';
import { GlassCard } from '../../../parts/GlassCard';

/**
 * The avatar stack: the generated portraits the mobile onboarding uses
 * (`apps/mobile/assets/onboarding/people`), at 192px so they stay sharp on high-density screens (owner, 2026-11-21: "use them instead
 * of names"). They are illustrative, not the actual support team.
 */
const PEOPLE = [
  '/landing/people-p1@2x.webp',
  '/landing/people-p2@2x.webp',
  '/landing/people-p3@2x.webp',
];

/**
 * The FAQ contact column as a light glass card (Landing v2, owner 2026-11-20): an avatar stack of
 * the people who answer, a "typing…" bubble whose dots bounce, and the reply that lands under it,
 * then the "Contact us" button and the address.
 *
 * Loop (only while on screen): the typing dots bounce three times, the typing bubble gives way to
 * the reply, the reply's tick draws, then it all resets. At rest the reply is showing.
 */
export function ContactCard() {
  const root = useRef<HTMLDivElement>(null);

  useSceneLoop(
    root,
    (tl, q) => {
      tl.set(q('[data-reply]'), { opacity: 0, y: 10 })
        .set(q('[data-typing]'), { opacity: 1, y: 0 })
        .fromTo(
          q('[data-avatar]'),
          { y: 6, opacity: 0.4 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.08 },
        )
        .to(
          q('[data-dot]'),
          { y: -4, duration: 0.28, ease: 'sine.inOut', stagger: 0.12, yoyo: true, repeat: 5 },
          '<0.2',
        )
        .to(q('[data-typing]'), { opacity: 0, y: -6, duration: 0.3 })
        .to(q('[data-reply]'), { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, '<0.1')
        .fromTo(
          q('[data-reply-tick]'),
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' },
        )
        .to({}, { duration: 2.2 });
    },
    { repeatDelay: 0.6 },
  );

  return (
    <div ref={root}>
      <GlassCard
        className="min-h-[300px]"
        beam={{ x: 85, y: 10, w: 60, h: 90, rotate: -30 }}
        dots
        visual={
          <div className="relative flex flex-col gap-4 px-6 pt-6 sm:px-7 sm:pt-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center">
                {PEOPLE.map((src, i) => (
                  <span
                    key={src}
                    data-avatar
                    className="relative -ml-2.5 size-11 overflow-hidden rounded-full ring-2 ring-lp-white first:ml-0"
                    style={{ zIndex: PEOPLE.length - i }}
                  >
                    <Image src={src} alt="" fill unoptimized className="object-cover" />
                  </span>
                ))}
                <span className="ml-3 flex items-center gap-1.5 text-[13px] font-medium text-lp-on-glass-dim">
                  <span className="size-2 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
                  Online now
                </span>
              </div>
              <ClayTile scene="chat" size={60} className="-mt-1 hidden sm:block" />
            </div>

            <div className="relative h-[52px]">
              {/* Typing… (hidden at rest; the loop shows it before the reply lands). */}
              <div
                data-typing
                aria-hidden
                className="lp-glass-panel absolute top-0 left-0 flex items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-3.5 opacity-0"
              >
                {[0, 1, 2].map((d) => (
                  <span key={d} data-dot className="size-2 rounded-full bg-lp-beam" />
                ))}
              </div>
              <div
                data-reply
                className="lp-glass-panel absolute top-0 left-0 flex items-center gap-2.5 rounded-2xl rounded-tl-md px-4 py-3"
              >
                <span className="text-[15px] font-medium text-lp-on-glass">
                  Hi! We read every message.
                </span>
                <span
                  data-reply-tick
                  className="flex size-5 items-center justify-center rounded-full bg-lp-beam text-[11px] text-lp-white"
                >
                  <svg viewBox="0 0 16 16" width={10} height={10} fill="none" aria-hidden>
                    <path
                      d="M3 8.5 6.5 12 13 4.5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        }
        title="A person reads every message"
        body={
          <span className="flex flex-col items-start gap-4">
            <span>Real people on the other end, usually within a day.</span>
            <span className="flex flex-wrap items-center gap-4">
              <motion.a
                href="#"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="rounded-full bg-lp-ink px-[26px] py-3.5 text-[16px] font-semibold text-lp-white shadow-[0_14px_30px_-14px_rgba(20,22,43,0.45)]"
              >
                Contact us
              </motion.a>
              <span className="text-[14px] font-medium text-lp-on-glass-dim">
                hello@nextkin.com (placeholder)
              </span>
            </span>
          </span>
        }
      />
    </div>
  );
}
