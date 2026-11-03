'use client';

import { FAQ_TOPIC_LABEL, FAQ_TOPIC_ORDER, type FaqTopic } from '@nextkin/shared/models';
import { queryPhase, useFaq } from '@nextkin/shared/queries';
import { useMemo, useState } from 'react';

import { SettingsIllustration } from '@/features/settings/components/SettingsIllustration';
import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';
import { PageHeader } from '@/navigation/PageHeader';
import { fieldBox } from '@/ui/fieldBox';
import { SearchIcon } from '@/ui/icons';
import { HelpFaqIllustration, SettingsLightbulbIllustration } from '@/ui/illustrations';
import { pageFrameInBar } from '@/ui/pageFrame';
import { PillTabs } from '@/ui/PillTabs';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { FaqTopicCard } from '../components/FaqTopicCard';
import { MessageSupportCard } from '../components/MessageSupportCard';
import { PolicyCard } from '../components/PolicyCard';
import {
  answerCount,
  DEFAULT_OPEN,
  HELP_COLUMNS,
  matchesSearch,
  type HelpFilter,
} from '../helpLibrary';
import { useReveal } from '@/lib/useReveal';

const FILTERS: readonly { id: HelpFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...FAQ_TOPIC_ORDER.map((topic) => ({ id: topic, label: FAQ_TOPIC_LABEL[topic] })),
];

/**
 * Help & support (563:4), which replaced its coming-soon page: find an answer on the left,
 * searched and filtered in memory over the shared FAQ, and on the right a message to support and
 * the two legal documents. The header art is a placeholder on the board (IL-W3); until it is
 * drawn, the Settings character at her laptop stands in (`illustrations-needed.md`).
 */
export function HelpScreen() {
  const faq = useFaq();
  const [filter, setFilter] = useState<HelpFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(DEFAULT_OPEN);
  // The answers fade in as they load, and again when a topic pill changes them; typing in the
  // search narrows them in place, since a fade per keystroke would only flicker (§102).
  const loaded = useReveal(Boolean(faq.data));
  const switched = useReveal(true, filter);

  const items = useMemo(() => faq.data ?? [], [faq.data]);
  const counts = useMemo(() => {
    const result = { all: items.length } as Record<HelpFilter, number>;
    for (const topic of FAQ_TOPIC_ORDER) {
      result[topic] = items.filter((item) => item.topic === topic).length;
    }
    return result;
  }, [items]);

  const shown = items.filter(
    (item) => (filter === 'all' || item.topic === filter) && matchesSearch(item, query),
  );
  const byTopic = (topic: FaqTopic) => shown.filter((item) => item.topic === topic);

  return (
    <div className={cn(pageFrameInBar, 'flex flex-col gap-6 pb-10')}>
      <PageHeader
        eyebrow="Help & support"
        title="How can we help?"
        subtitle="Search the answers below, or message support if you're still stuck."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="find-an-answer" className={cn(cardSurface, cardPad)}>
            <div className="flex items-center gap-4">
              <HelpFaqIllustration aria-hidden className="h-auto w-12 shrink-0" />
              <div>
                <h2 id="find-an-answer" className="text-title-l text-text-primary">
                  Find an answer
                </h2>
                <p className="text-body-s text-text-tertiary">{answerCount(items.length)}</p>
              </div>
            </div>
            <label
              className={cn(
                fieldBox,
                'mt-5 h-control-lg gap-2.5 px-3.5 focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100',
              )}
            >
              <SearchIcon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
              <input
                type="search"
                aria-label="Search help"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search help"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-tertiary"
              />
            </label>
            <PillTabs
              tabs={FILTERS}
              active={filter}
              counts={faq.data ? counts : undefined}
              onChange={setFilter}
              label="Help topics"
              className="mt-4"
            />
          </section>

          {queryPhase(faq) === 'error' ? (
            <StateView
              tone="danger"
              title="Couldn't load the answers"
              message="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => void faq.refetch()}
            />
          ) : !faq.data ? (
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-6">
                <Skeleton className="h-64 rounded-lg" />
                <Skeleton className="h-52 rounded-lg" />
              </div>
              <div className="flex flex-col gap-6">
                <Skeleton className="h-52 rounded-lg" />
                <Skeleton className="h-40 rounded-lg" />
                <Skeleton className="h-40 rounded-lg" />
              </div>
            </div>
          ) : shown.length === 0 ? (
            <StateView
              title="No answers match"
              message="Try another word, or message support and we'll answer you directly."
              className={cn(cardSurface, 'py-12')}
            />
          ) : (
            <div
              key={filter}
              className={cn(
                'grid grid-cols-1 items-start gap-6 md:grid-cols-2',
                (loaded || switched) && 'animate-reveal',
              )}
            >
              {HELP_COLUMNS.map((column, index) => (
                <div key={index} className="flex min-w-0 flex-col gap-6">
                  {column.map((topic) => {
                    const topicItems = byTopic(topic);
                    if (topicItems.length === 0) return null;
                    return (
                      <FaqTopicCard
                        key={topic}
                        topic={topic}
                        items={topicItems}
                        openId={openId}
                        onToggle={(id) => setOpenId((open) => (open === id ? null : id))}
                      />
                    );
                  })}
                  {index === 0 && (
                    <div className="flex items-center gap-4 rounded-lg bg-surface-brand px-6 py-5">
                      <SettingsLightbulbIllustration aria-hidden className="h-auto w-10 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-body-m font-semibold text-text-primary">
                          Search reads the answers too
                        </p>
                        <p className="text-body-s text-text-tertiary">
                          Try “watermark” to find the export answer.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The art stands on the support card, as Settings stands it on its card, so it takes no
            height of its own and the cards start right under the header (577:6581). Scaled to
            88px so it stays below the bar's controls on a header this short. */}
        <div className="relative flex min-w-0 flex-col gap-6">
          <SettingsIllustration className="absolute bottom-full right-2.5 hidden h-[88px] w-[225px] xl:block" />
          <MessageSupportCard />
          <PolicyCard doc="terms" />
          <PolicyCard doc="privacy" />
        </div>
      </div>
    </div>
  );
}
