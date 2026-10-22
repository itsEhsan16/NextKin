import { FAQ_TOPIC_LABEL, type FaqItem, type FaqTopic } from '@nextkin/shared/models';
import { useId, type ComponentType, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { ChevronDownIcon } from '@/ui/icons';
import {
  HelpGettingStartedIllustration,
  JdArtDocumentSearchIllustration,
  ProfileExperienceIllustration,
  SettingsAccountIllustration,
  SettingsBillingIllustration,
} from '@/ui/illustrations';

import { answerCount, webAnswer } from '../helpLibrary';
import { CollapseFade } from '@/ui/CollapseFade';
import { pressable } from '@/ui/pressable';

/** Each topic's duotone glyph (577:8506, 7328, 7377, 7398, 7420). */
const TOPIC_ART: Record<FaqTopic, ComponentType<SVGProps<SVGSVGElement>>> = {
  getting_started: HelpGettingStartedIllustration,
  resumes: JdArtDocumentSearchIllustration,
  jobs: ProfileExperienceIllustration,
  billing: SettingsBillingIllustration,
  account: SettingsAccountIllustration,
};

export type FaqTopicCardProps = {
  topic: FaqTopic;
  items: readonly FaqItem[];
  /** The question showing its answer, if it is in this topic. */
  openId: string | null;
  onToggle: (id: string) => void;
};

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  const answerId = useId();
  return (
    <li
      className={cn(
        'border-t border-border-faint transition-colors duration-base ease-standard',
        open && 'bg-neutral-50',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={onToggle}
        className={cn(
          pressable,
          'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 text-body-l font-semibold transition-colors duration-base ease-standard',
            open ? 'text-text-brand' : 'text-text-primary',
          )}
        >
          {item.question}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'size-4 shrink-0 transition-[rotate,color] duration-base ease-standard',
            open ? 'rotate-180 text-text-brand' : 'text-text-tertiary',
          )}
        />
      </button>
      {/* Opens and closes on the shared height glide (`toreview.md` §102); a closed answer is
          inert, so it is neither read nor tabbed into. */}
      <CollapseFade axis="vertical" open={open} inert={!open}>
        <div
          id={answerId}
          role="region"
          aria-label={item.question}
          aria-hidden={!open || undefined}
          className="px-4 pb-4 text-prose text-text-secondary"
        >
          {webAnswer(item)}
        </div>
      </CollapseFade>
    </li>
  );
}

/**
 * One topic's questions (577:7278-7410): its glyph, name and count, then each question, which
 * opens to its answer. One answer is open at a time across the page, as the board draws it.
 */
export function FaqTopicCard({ topic, items, openId, onToggle }: FaqTopicCardProps) {
  const titleId = useId();
  const Art = TOPIC_ART[topic];

  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-lg border border-border-card bg-surface-card shadow-card"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span aria-hidden className="flex w-10 shrink-0 justify-center">
          <Art className="h-auto max-h-9 w-10" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-title-l font-medium text-text-primary">
            {FAQ_TOPIC_LABEL[topic]}
          </h2>
          <p className="text-body-s text-text-tertiary">{answerCount(items.length)}</p>
        </div>
      </div>
      <ul>
        {items.map((item) => (
          <FaqRow
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </ul>
    </section>
  );
}
