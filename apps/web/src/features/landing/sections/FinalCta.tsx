'use client';

import { useRef, useState, type FormEvent } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';
import { MagneticButton } from '../parts/MagneticButton';
import { Reveal } from '../parts/Reveal';
import { CtaClay, CtaGrid } from './scenes/cta/CtaStage';

/**
 * 12 Final CTA (Figma 530:874; Landing v2, owner 2026-11-20). The violet inset card is now a grid
 * surface in window light, after the owner's red/purple grid references, with two glossy clay
 * toys lying on it (the gift and the document + sticker). The headline, copy and email form are
 * unchanged.
 *
 * Motion: the headline words rise and the copy follows; the toys settle onto the grid as the card
 * arrives, then drift with the pointer by their depth. The window light slides slowly across and
 * the grid's intersections breathe, both only while the card is on screen.
 */
export function FinalCta() {
  const root = useRef<HTMLElement>(null);
  const [email, setEmail] = useState('');

  useLandingMotion(root, ({ isDesktop }) => {
    const q = gsap.utils.selector(root);
    const card = q('[data-cta-card]')[0] as HTMLElement | undefined;

    gsap.from(q('[data-cta-rise]'), {
      y: 28,
      opacity: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.12,
      delay: 0.3,
      scrollTrigger: {
        trigger: root.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      },
    });

    // The toys drop onto the grid: down from a little above, turning as they land.
    gsap.from(q('[data-cta-clay]'), {
      y: -50,
      rotate: (i: number) => (i % 2 ? 14 : -12),
      opacity: 0,
      duration: 1.2,
      ease: 'back.out(1.4)',
      stagger: 0.18,
      scrollTrigger: {
        trigger: root.current,
        start: 'top 70%',
        toggleActions: 'play none none none',
      },
    });

    // The grid's lit squares run their own loop (CtaGrid), paused offscreen.

    // Pointer parallax: each toy leans by its depth.
    if (!isDesktop || !card) return;
    const toys = (q('[data-cta-clay]') as HTMLElement[]).map((el) => ({
      depth: Number(el.dataset.depth ?? 1),
      x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' }),
      y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' }),
    }));
    const move = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      toys.forEach((t) => {
        t.x(dx * 40 * t.depth);
        t.y(dy * 30 * t.depth);
      });
    };
    const leave = () => toys.forEach((t) => (t.x(0), t.y(0)));
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', leave);
    return () => {
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerleave', leave);
    };
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    window.location.assign(value ? `/sign-up?email=${encodeURIComponent(value)}` : '/sign-up');
  };

  return (
    <section id="cta" ref={root} className="mt-20 px-3 sm:px-5 lg:mt-[130px]">
      <div
        data-cta-card
        data-nav-dark
        className="relative isolate mx-auto flex max-w-[1400px] flex-col items-center overflow-clip rounded-[28px] px-5 pt-16 pb-16 text-center sm:rounded-[40px] sm:pt-[84px] sm:pb-[88px] lg:min-h-[520px] lg:justify-center"
      >
        <CtaGrid />

        {/* The toys lie on the grid on either side of the copy (not on phones, where they'd cover it). */}
        <CtaClay
          scene="document"
          size={210}
          depth={1.2}
          className="top-[10%] right-[4%] hidden lg:block xl:right-[7%]"
          style={{ rotate: '8deg' }}
        />
        <CtaClay
          scene="gift"
          size={180}
          depth={0.8}
          className="bottom-[9%] left-[4%] hidden lg:block xl:left-[7%]"
          style={{ rotate: '-10deg' }}
        />
        <CtaClay
          scene="gift"
          size={96}
          depth={0.8}
          className="bottom-[6%] left-[3%] hidden md:block lg:hidden"
          style={{ rotate: '-10deg' }}
        />
        <CtaClay
          scene="document"
          size={104}
          depth={1.2}
          className="top-[7%] right-[3%] hidden md:block lg:hidden"
          style={{ rotate: '8deg' }}
        />

        <Reveal
          as="h2"
          by="words"
          className="relative text-[40px] leading-[48px] font-semibold tracking-[-1.2px] text-lp-white sm:text-[64px] sm:leading-[72px] sm:tracking-[-1.6px]"
        >
          Ready to land
          <br />
          your <AccentWord>next</AccentWord> role?
        </Reveal>

        <p
          data-cta-rise
          className="relative mt-[22px] max-w-[611px] text-[17px] leading-[26px] text-lp-white/86 sm:text-[19px]"
        >
          Join job seekers tailoring every application honestly. Start free today.
        </p>

        <form
          data-cta-rise
          data-nav-light
          onSubmit={submit}
          // Phones (owner, 2026-11-21): a stacked card, the field with its icon on top and the
          // button full width below, so the placeholder fits. From sm up, the board's single pill.
          className="relative mt-10 flex w-full max-w-[730px] flex-col gap-2 rounded-[26px] bg-lp-white p-2 shadow-lp-field sm:flex-row sm:items-center sm:gap-4 sm:rounded-full"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3 px-2 sm:px-0">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.2px] border-[#e4e2f0] sm:size-[52px]">
              <img src="/landing/cta-icon-mail.svg" alt="" width={20} height={20} />
            </span>
            <label htmlFor="lp-cta-email" className="sr-only">
              Email address
            </label>
            <input
              id="lp-cta-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-lp-ink outline-none placeholder:text-lp-muted sm:h-auto sm:text-[17px]"
            />
          </span>
          <MagneticButton
            type="submit"
            className="w-full shrink-0 rounded-[20px] bg-lp-ink px-6 py-[15px] text-[16px] font-semibold whitespace-nowrap text-lp-white sm:w-auto sm:rounded-full sm:px-9 sm:py-[17px] sm:text-[17px]"
          >
            Get started
          </MagneticButton>
        </form>
      </div>
    </section>
  );
}
