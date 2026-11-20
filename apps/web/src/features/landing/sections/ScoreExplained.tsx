'use client';

import { AccentWord } from '../parts/AccentWord';
import { Reveal } from '../parts/Reveal';
import { MatchPanel } from './scenes/score/MatchPanel';
import { ScoreChecks } from './scenes/score/ScoreChecks';

/**
 * 06 The score, explained (Figma 527:722, Landing v2 2026-11-20). Copy and checks on the left; the
 * Match overview on the right as a dark glass panel, with the Basis tag pinned to the current bar.
 * The motion lives in the scenes: `ScoreChecks` draws its ticks, `MatchPanel` raises the bars,
 * counts "18" and loops a faint scan while on screen.
 */
export function ScoreExplained() {
  return (
    <section id="score" className="mt-20 px-5 lg:mt-[130px] lg:px-10">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-12 lg:flex-row lg:items-center lg:gap-[60px]">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2.5 rounded-full bg-lp-violet-soft py-1.5 pr-4 pl-1.5">
            <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
              <img src="/landing/score-icon-sparkle.svg" alt="" width={14} height={14} />
            </span>
            <span className="text-[15px] font-semibold text-lp-ink-2">The NextKin Score</span>
          </div>

          <Reveal
            as="h2"
            className="mt-6 text-[38px] leading-[46px] font-semibold tracking-[-1px] text-lp-heading sm:text-[46px] sm:leading-[54px] lg:text-lp-h2 lg:tracking-[-1.35px] lg:leading-[62px]"
          >
            Every number
            <br />
            shows its <AccentWord className="text-lp-violet">basis</AccentWord>.
          </Reveal>

          <Reveal
            as="p"
            delay={0.15}
            className="mt-5 max-w-[540px] text-[17px] leading-[27px] text-lp-copy sm:text-lp-body-l sm:leading-[30px]"
          >
            The NextKin Score counts only what the printed page says, and shows which of the job’s
            requirements each line meets.
          </Reveal>

          <ScoreChecks />
        </div>

        <MatchPanel />
      </div>
    </section>
  );
}
