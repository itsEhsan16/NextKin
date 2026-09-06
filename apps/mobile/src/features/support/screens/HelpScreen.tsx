import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  FAQ_TOPIC_LABEL,
  FAQ_TOPIC_ORDER,
  SUPPORT_REPLY_WINDOW,
  type FaqItem,
  type FaqTopic,
} from '@/data/models';
import { useFaq } from '@/data/queries';
import { useDebouncedValue } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FilterChip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SearchField } from '@/ui/SearchField';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { FaqList } from '../components/FaqList';
import { HelpSkeleton } from '../components/HelpSkeleton';
import { faqCountLine, filterFaq, supportTopicForFaqTopic } from '../faqSearch';
import { useSupportActions } from '../hooks/useSupportActions';

const CONTACT_CTA = 'Message support';
/** Distinct from the footer card's button so a state view's two routes are never ambiguous. */
const CONTACT_SECONDARY = 'Message support instead';
/** Stable identity, so the filter memo is not recomputed by `?? []` minting a new array. */
const NO_ITEMS: readonly FaqItem[] = [];

/**
 * HELP & FAQ (V2 §7.14), reached from Profile → Support. No artboard covers it (plan §8, phase
 * 9G), so it is assembled from the built primitives only: the search field the Jobs and Resumes
 * headers wear, the filter chips the Filters sheet wears, and the carded accordion the published
 * score rubric wears.
 *
 * The FAQ is a dozen entries the repo hands over whole, so the search runs in memory against
 * `faqSearch.ts` rather than over the wire; only the value that reaches it is debounced, so the
 * field itself stays fully controlled.
 */
export function HelpScreen() {
  const { spacing } = useTheme();
  const actions = useSupportActions();
  const faq = useFaq();

  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<FaqTopic | undefined>(undefined);
  /**
   * One row open at a time, not many. The list sits under a search field and a topic row, so an
   * accordion that kept everything open would push the answer being read off the bottom of the
   * page and lose the reader's place; an FAQ is read one answer at a time. The open id survives a
   * change of query on purpose — an answer you opened and then searched within stays open.
   */
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  const debouncedQuery = useDebouncedValue(query);
  const all = faq.data ?? NO_ITEMS;
  const items = useMemo(
    () => filterFaq(all, { topic, query: debouncedQuery }),
    [all, topic, debouncedQuery],
  );

  const clearSearch = () => {
    setQuery('');
    setTopic(undefined);
  };

  const contact = () => actions.openContact(supportTopicForFaqTopic(topic));

  const page = (children: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Help & FAQ" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
    >
      {children}
    </Screen>
  );

  if (faq.isPending) return page(<HelpSkeleton />);

  if (faq.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load help"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void faq.refetch()}
        secondaryLabel={CONTACT_SECONDARY}
        onSecondary={contact}
      />,
    );
  }

  // (a) The repo has no help content at all. Not a failure and not a search result — there is
  //     nothing to search, so the field and the chips are not drawn either. The way out is still
  //     a person: §7.14 answers by message whether or not the FAQ loaded.
  if (all.length === 0) {
    return page(
      <StateView
        icon="life-ring"
        title="Help is unavailable right now"
        message={`We can't show the FAQ at the moment. Write to us and we'll answer directly. ${SUPPORT_REPLY_WINDOW}`}
        actionLabel={CONTACT_CTA}
        onAction={contact}
      />,
    );
  }

  return page(
    <>
      <View style={{ gap: spacing[3] }}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search help"
          accessibilityLabel="Search help"
        />
        <View style={[styles.chips, { gap: spacing[2] }]}>
          <FilterChip
            variant="filter"
            label="All"
            accessibilityLabel="All topics"
            selected={topic === undefined}
            onPress={() => setTopic(undefined)}
          />
          {FAQ_TOPIC_ORDER.map((key) => (
            <FilterChip
              key={key}
              variant="filter"
              label={FAQ_TOPIC_LABEL[key]}
              selected={topic === key}
              onPress={() => setTopic(topic === key ? undefined : key)}
            />
          ))}
        </View>
      </View>

      <Text variant="caption" color="textTertiary">
        {faqCountLine(items.length, all.length)}
      </Text>

      {/*
        (b) The FAQ loaded but this search or topic matched none of it. Deliberately a different
        state from (a): the search field above stays on screen so the query can be edited, the
        title names what was typed, and "Clear search" puts the whole list back.
      */}
      {items.length === 0 ? (
        <StateView
          icon="search"
          title={
            debouncedQuery.trim().length > 0
              ? `No answers matched "${debouncedQuery.trim()}"`
              : 'No answers in this topic'
          }
          message="Try a different word, or put the topic back to All."
          actionLabel="Clear search"
          onAction={clearSearch}
          secondaryLabel={CONTACT_SECONDARY}
          onSecondary={contact}
        />
      ) : (
        <FaqList
          items={items}
          openId={openId}
          onToggle={(id) => setOpenId((open) => (open === id ? undefined : id))}
        />
      )}

      <Card style={{ gap: spacing[3] }}>
        <Text variant="section" accessibilityRole="header">
          Still stuck?
        </Text>
        <Text variant="prose" color="textSecondary">
          {`Tell us what happened and we'll take a look. ${SUPPORT_REPLY_WINDOW}`}
        </Text>
        <Button label={CONTACT_CTA} icon="envelope" onPress={contact} />
      </Card>
    </>,
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
