'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/ui/Button';
import { BUTTON_SIZE, BUTTON_VARIANT, type ButtonVariant } from '@/ui/buttonStyles';
import { CreditPill } from '@/ui/CreditPill';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/Dialog';
import { backButton, finalButton, FlowFooter, primaryButton } from '@/ui/FlowFooter';
import { InfoTip } from '@/ui/InfoTip';
import { Plus, XClose } from '@/ui/lineIcons';
import { ScoreRing } from '@/ui/ScoreRing';
import { ScoreVerdict } from '@/ui/ScoreVerdict';
import { Soon, soonControl, SoonTag } from '@/ui/Soon';
import { Stepper } from '@/ui/Stepper';
import { Tag, type TagTone } from '@/ui/Tag';
import { TimeEstimateNote } from '@/ui/TimeEstimateNote';

/**
 * Every redesign primitive in every state, on one page (redesign R3d's definition of done:
 * "each primitive has a page showing each variant and state"). Development only: the route 404s
 * in a production build. Used to review the system by eye and as the target of a11y and pixel
 * checks; it holds no product logic.
 */
const VARIANTS = Object.keys(BUTTON_VARIANT) as ButtonVariant[];
const SIZES = Object.keys(BUTTON_SIZE) as (keyof typeof BUTTON_SIZE)[];
const TAGS: TagTone[] = ['brand', 'info', 'success', 'warning', 'danger', 'neutral'];
const FLOW = ['Choose the job', 'Pick keywords', 'Review'] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`showcase-${title}`} className="flex flex-col gap-4">
      <h2 id={`showcase-${title}`} className="text-h2 text-text-primary">
        {title}
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-card p-6">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-32 shrink-0 text-caption-m text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

export function ComponentShowcase() {
  const [dialog, setDialog] = useState<'sm' | 'md' | 'lg' | 'xl' | null>(null);
  const [step, setStep] = useState(1);

  return (
    <main className="mx-auto flex max-w-container-page flex-col gap-10 bg-surface-page px-8 py-10">
      <header>
        <h1 className="text-display-l text-text-primary">Components</h1>
        <p className="mt-1 text-body-l text-text-secondary">
          The redesign primitives in every state. Development only.
        </p>
      </header>

      <Section title="Buttons">
        {VARIANTS.map((variant) => (
          <Row key={variant} label={variant}>
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {size.toUpperCase()}
              </Button>
            ))}
            <Button variant={variant} disabled>
              Disabled
            </Button>
            <Button variant={variant} loading busyLabel="Saving…">
              Save
            </Button>
            <Button
              variant={variant}
              iconOnly
              aria-label="Add"
              icon={<Plus className="size-4" />}
            />
          </Row>
        ))}
      </Section>

      <Section title="Dialogs">
        <Row label="sizes">
          {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <Button key={size} variant="secondary" onClick={() => setDialog(size)}>
              Open {size}
            </Button>
          ))}
        </Row>
        <Dialog
          open={dialog !== null}
          onOpenChange={(open) => !open && setDialog(null)}
          size={dialog ?? 'md'}
          className="gap-3 p-6"
        >
          <DialogTitle className="text-h2 text-text-primary">A {dialog} dialog</DialogTitle>
          <DialogDescription className="text-body-l text-text-secondary">
            One shell: width step, corners, shadow, scrim and stacking.
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="secondary" className="self-end">
              Close
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <button type="button" aria-label="Close dialog" className="absolute right-4 top-4">
              <XClose aria-hidden className="size-5 text-text-tertiary" />
            </button>
          </DialogClose>
        </Dialog>
      </Section>

      <Section title="Scores">
        <Row label="ring tones">
          <ScoreRing score={88} label="Strong" tone="success" />
          <ScoreRing score={72} label="Good" tone="brand" />
          <ScoreRing score={58} label="Fair" tone="warning" />
          <ScoreRing score={31} label="Weak" tone="danger" />
        </Row>
        <Row label="badge / pill">
          {(['strong', 'good', 'fair', 'weak'] as const).map((band) => (
            <ScoreVerdict key={band} variant="badge" kind="match" score={80} band={band} />
          ))}
          {(['strong', 'good', 'fair', 'weak'] as const).map((band) => (
            <ScoreVerdict key={band} variant="pill" kind="match" band={band} />
          ))}
        </Row>
        <div className="grid gap-6 md:grid-cols-2">
          <ScoreVerdict
            variant="panel"
            kind="match"
            score={64}
            band="fair"
            reasons={[
              { kind: 'met', label: 'Figma, user research' },
              { kind: 'partial', label: 'Design systems' },
              { kind: 'missing', label: 'Product strategy' },
            ]}
            action={{ label: 'Tailor resume', onClick: () => {} }}
            rubricHref={'/help' as never}
          />
          <ScoreVerdict
            variant="panel"
            kind="resume"
            state="no-jd"
            addJobHref={'/create/build' as never}
          />
          <ScoreVerdict
            variant="panel"
            kind="resume"
            state="insufficient"
            missingEvidence="Add dates to 2 roles"
          />
          <ScoreVerdict variant="panel" kind="resume" state="loading" />
          <ScoreVerdict variant="panel" kind="resume" state="error" onRetry={() => {}} />
        </div>
      </Section>

      <Section title="Hints">
        <Row label="credit pill">
          <CreditPill state="available" text="2 resumes left this month" />
          <CreditPill
            state="cost"
            text="Uses 1 generation"
            rule="Credits reset on the 1st. Nothing is charged until you press Create."
          />
          <CreditPill state="consumed" text="1 generation used" />
          <CreditPill state="free" text="Free · no credits used" />
          <CreditPill state="none" text="No generations left" upgradeHref={'/settings' as never} />
        </Row>
        <Row label="info tip">
          <span className="flex items-center gap-1 text-body-m text-text-primary">
            Job match
            <InfoTip label="What job match means">
              How many of the job&apos;s required skills your resume shows in a dated role.
            </InfoTip>
          </span>
        </Row>
        <Row label="time estimate">
          <TimeEstimateNote>Usually takes 10–20 seconds</TimeEstimateNote>
        </Row>
        <Row label="soon">
          <SoonTag />
          <Soon>
            <button
              type="button"
              aria-disabled="true"
              className={`${BUTTON_VARIANT.secondary} ${BUTTON_SIZE.md} ${soonControl}`}
            >
              Interview prep
            </button>
          </Soon>
        </Row>
        <Row label="tags">
          {TAGS.map((tone) => (
            <Tag key={tone} tone={tone}>
              {tone}
            </Tag>
          ))}
        </Row>
      </Section>

      <Section title="Flow chrome">
        <Row label="stepper">
          <Stepper steps={FLOW} step={step} label="Tailor steps" />
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s + 1) % 4)}>
            Next step
          </Button>
        </Row>
        <FlowFooter note="Your credits won't be used until you create a resume.">
          <button type="button" className={backButton}>
            Back
          </button>
          <button type="button" className={primaryButton}>
            Continue
          </button>
        </FlowFooter>
        <FlowFooter note={<TimeEstimateNote>Usually takes 10–20 seconds</TimeEstimateNote>}>
          <button type="button" className={finalButton}>
            Download resume
          </button>
        </FlowFooter>
        <FlowFooter note="Pick at least one keyword to continue." noteTone="danger">
          <button type="button" className={primaryButton} disabled>
            Continue
          </button>
        </FlowFooter>
      </Section>
    </main>
  );
}
