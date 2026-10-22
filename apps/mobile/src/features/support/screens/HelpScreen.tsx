import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  FAQ_TOPIC_LABEL,
  FAQ_TOPIC_ORDER,
  SUPPORT_REPLY_WINDOW,
  type FaqItem,
  type FaqTopic,
} from '@/data/models';
import { useFaq } from '@/data/queries';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { useDebouncedValue } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SearchField } from '@/ui/SearchField';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { FaqList } from '../components/FaqList';
import { HelpSkeleton } from '../components/HelpSkeleton';
import { StillStuckCard } from '../components/StillStuckCard';
import { SupportHero } from '../components/SupportHero';
import { faqHeroLine, filterFaq, supportTopicForFaqTopic } from '../faqSearch';
import { useSupportActions } from '../hooks/useSupportActions';

const TITLE = 'Help & FAQ';
const CONTACT_CTA = 'Message support';
/** Distinct from the footer card's button so a state view's two routes are never ambiguous. */
const CONTACT_SECONDARY = 'Message support instead';
/** Stable identity, so the filter memo is not recomputed by `?? []` minting a new array. */
const NO_ITEMS: readonly FaqItem[] = [];

// SUPPORT 01 at 390 (577:6129), in artboard units.
const HEADER_TO_HERO = 8 / 0.75;
const HERO_ART_W = 60 / 0.75;
const ART_TO_TITLE = 12 / 0.75;
const TITLE_TO_LEDE = 8 / 0.75;
const LEDE_SKELETON_W = 190 / 0.75;
const LEDE_SKELETON_H = 18 / 0.75;
const HERO_TO_SEARCH = 18 / 0.75;
const SEARCH_TO_CHIPS = 12 / 0.75;
const CHIP_GAP_X = 7 / 0.75;
const CHIP_GAP_Y = 8 / 0.75;
const CHIPS_TO_LIST = 18 / 0.75;
const LIST_TO_STUCK = 18 / 0.75;

/**
 * HELP & FAQ, drawn as SUPPORT 01 (577:6129) and reached from the Support rows on PROFILE 02. The
 * spec has no help section — §7.14 is Skills Explorer, a public web surface. A hero names the page
 * and how much help there is, then the search field, the topic chips, one carded group of
 * questions per topic, and the "Still stuck?" card that hands over to a person.
 *
 * The FAQ is a dozen entries the repo hands over whole, so the search runs in memory against
 * `faqSearch.ts` rather than over the wire; only the value that reaches it is debounced, so the
 * field itself stays fully controlled.
 */
export function HelpScreen() {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useSupportActions();
  const faq = useFaq();

  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<FaqTopic | undefined>(undefined);
  /**
   * One row open at a time, not many. The list sits under a search field and a topic row, so an
   * accordion that kept everything open would push the answer being read off the bottom of the
   * page and lose the reader's place; an FAQ is read one answer at a time. The open id survives a
   * change of query on purpose — an answer you opened and then searched within stays open.
   *
   * `undefined` means the reader has not touched the list yet, and then the first question is
   * open, as the board draws it (577:6183); `null` is a reader who closed everything.
   */
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);

  const debouncedQuery = useDebouncedValue(query);
  const all = faq.data ?? NO_ITEMS;
  const items = useMemo(
    () => filterFaq(all, { topic, query: debouncedQuery }),
    [all, topic, debouncedQuery],
  );
  const shownOpen = openId === undefined ? all[0]?.id : (openId ?? undefined);

  const clearSearch = () => {
    setQuery('');
    setTopic(undefined);
  };

  const contact = () => actions.openContact(supportTopicForFaqTopic(topic));

  let lede: ReactNode = null;
  if (faq.isPending) {
    lede = <Skeleton width={s(LEDE_SKELETON_W)} height={s(LEDE_SKELETON_H)} style={styles.lede} />;
  } else if (all.length > 0) {
    lede = (
      <Text variant="captionRegular" color="textSecondary" align="center" style={styles.lede}>
        {faqHeroLine(all, items.length)}
      </Text>
    );
  }

  // The hero stands in every state: the header row leaves its title slot empty, so the hero is
  // the only thing on the page that says where the reader is.
  const page = (children: ReactNode) => (
    <Screen
      scroll
      keyboard
      edges={['top', 'bottom']}
      header={<ScreenHeader title={TITLE} showTitle={false} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <SupportHero
        art={PROFILE_ROW_ART.help}
        artWidth={HERO_ART_W}
        artGap={ART_TO_TITLE}
        title={TITLE}
      >
        {lede}
      </SupportHero>
      <View style={styles.body}>{children}</View>
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
  //     a person: a person answers by message whether or not the FAQ loaded.
  if (all.length === 0) {
    return page(
      <StateView
        icon="life-ring"
        title="Help is unavailable right now"
        message={SUPPORT_REPLY_WINDOW}
        actionLabel={CONTACT_CTA}
        onAction={contact}
      />,
    );
  }

  return page(
    <>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search help"
        accessibilityLabel="Search help"
      />
      <View style={styles.chips}>
        <FilterChip
          variant="select"
          label="All"
          accessibilityLabel="All topics"
          selected={topic === undefined}
          onPress={() => setTopic(undefined)}
        />
        {FAQ_TOPIC_ORDER.map((key) => (
          <FilterChip
            key={key}
            variant="select"
            label={FAQ_TOPIC_LABEL[key]}
            selected={topic === key}
            onPress={() => setTopic(topic === key ? undefined : key)}
          />
        ))}
      </View>

      {/*
        (b) The FAQ loaded but this search or topic matched none of it. Deliberately a different
        state from (a): the search field above stays on screen so the query can be edited, the
        title names what was typed, and "Clear search" puts the whole list back.
      */}
      <View style={styles.list}>
        {items.length === 0 ? (
          <StateView
            icon="search"
            title={
              debouncedQuery.trim().length > 0
                ? `No answers matched "${debouncedQuery.trim()}"`
                : 'No answers in this topic'
            }
            actionLabel="Clear search"
            onAction={clearSearch}
          />
        ) : (
          <FaqList
            items={items}
            openId={shownOpen}
            onToggle={(id) => setOpenId(shownOpen === id ? null : id)}
          />
        )}
      </View>

      <View style={styles.stuck}>
        <StillStuckCard label={CONTACT_CTA} onPress={contact} />
      </View>
    </>,
  );
}

const useStyles = scaledSheet((s) => ({
  lede: { marginTop: s(TITLE_TO_LEDE) },
  body: { marginTop: s(HERO_TO_SEARCH) },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: s(CHIP_GAP_X),
    rowGap: s(CHIP_GAP_Y),
    marginTop: s(SEARCH_TO_CHIPS),
  },
  list: { marginTop: s(CHIPS_TO_LIST) },
  stuck: { marginTop: s(LIST_TO_STUCK) },
}));
