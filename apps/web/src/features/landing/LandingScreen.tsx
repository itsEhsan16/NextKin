import { ScrollProgress } from './motion/ScrollProgress';
import { SmoothScroll } from './motion/SmoothScroll';
import { Faq } from './sections/Faq';
import { Facts } from './sections/Facts';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { Integrations } from './sections/Integrations';
import { JobBoards } from './sections/JobBoards';
import { LandingNav } from './sections/LandingNav';
import { Pricing } from './sections/Pricing';
import { Problem } from './sections/Problem';
import { ProofBand } from './sections/ProofBand';
import { ScoreExplained } from './sections/ScoreExplained';
import { ToolkitBento } from './sections/ToolkitBento';

/**
 * nextkin.ai — the marketing landing page (Figma 524:419, "Landing v5 · Show your work").
 *
 * Section order and spacing follow the board: the inset violet hero, the job-board strip, then
 * content sections 130px apart. Motion is GSAP (scroll choreography, ScrollTrigger + SplitText)
 * and Motion (pointer and state interactions); everything renders final-state without either.
 */
export function LandingScreen() {
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-lp-page font-sans text-lp-ink">
      <SmoothScroll />
      <ScrollProgress />
      <LandingNav />
      <main>
        <Hero />
        <JobBoards />
        <Problem />
        <HowItWorks />
        <ProofBand />
        <ScoreExplained />
        <Facts />
        <ToolkitBento />
        <Integrations />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
