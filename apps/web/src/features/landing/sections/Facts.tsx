import { AccentWord } from '../parts/AccentWord';
import { Reveal } from '../parts/Reveal';
import { FactTiles } from './scenes/facts/FactTiles';

/**
 * 07 Facts (Figma 528:662, Landing v2 2026-11-20). "It's like having an editor who never makes
 * things up", then four dark glass stat tiles with 3D clay scenes; the second is the featured one.
 * The motion lives in `FactTiles`.
 */
export function Facts() {
  return (
    <section id="facts" className="mt-20 px-5 lg:mt-[130px] lg:px-10">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-8 lg:gap-11">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Reveal
            as="h2"
            className="text-[36px] leading-[44px] font-semibold tracking-[-1px] text-lp-heading sm:text-[46px] sm:leading-[54px] lg:text-lp-h2 lg:tracking-[-1.35px] lg:leading-[62px]"
          >
            It’s like having an <AccentWord className="text-lp-violet">editor</AccentWord>
            <br />
            who never makes things up.
          </Reveal>
          <Reveal
            as="p"
            delay={0.2}
            className="text-[17px] leading-[27px] text-lp-copy sm:text-lp-body-l lg:text-right sm:leading-[30px]"
          >
            Four facts about the product,
            <br className="hidden lg:block" /> each one checkable in the app.
          </Reveal>
        </div>

        <FactTiles />
      </div>
    </section>
  );
}
