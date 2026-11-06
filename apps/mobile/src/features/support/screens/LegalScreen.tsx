import { useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';

import { LEGAL_DOC_TITLE, type LegalDocKey } from '@/data/models';
import { useLegal } from '@/data/queries';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { openExternalUrl, useReducedMotion, WEB_URL } from '@/lib';
import { useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { LegalContents } from '../components/LegalContents';
import { LegalSections } from '../components/LegalSections';
import { LegalSkeleton } from '../components/LegalSkeleton';
import { LegalStamp } from '../components/LegalStamp';
import { SupportHero } from '../components/SupportHero';
import { useSupportActions } from '../hooks/useSupportActions';

export type LegalScreenProps = { doc?: LegalDocKey };

const OPEN_LABEL = 'Open on the web';

/** Said on the page, not through a toast: nothing hosts one above a pushed screen. */
const OPEN_FAILED = 'Nothing on this device could open the web copy.';

// LEGAL 01 / LEGAL 02 at 390 (577:8876 / 580:2), in artboard units.
const HEADER_TO_HERO = 10 / 0.75;
const ART_TO_TITLE = 12 / 0.75;
const HERO_TO_CONTENTS = 26 / 0.75;
const CONTENTS_TO_SECTIONS = 14 / 0.75;
/** A jumped-to card stops this far under the header, not flush against its fade. */
const JUMP_MARGIN = 12 / 0.75;

/** Each document's hero drawing: the Profile row icon, 64 and 60 wide (577:8885 / 580:11). */
const LEGAL_ART: Record<LegalDocKey, { art: ListRowArt; width: number }> = {
  terms: { art: PROFILE_ROW_ART.terms, width: 64 / 0.75 },
  privacy: { art: PROFILE_ROW_ART.privacy, width: 60 / 0.75 },
};

/**
 * The canonical addresses. The document itself carries its `url`, and that is what is used
 * whenever it loaded — this is the fallback for the one state that needs it most: §8.5 is an
 * obligation, so "the server is down" must not be the same thing as "you cannot read the terms".
 */
const LEGAL_URL: Record<LegalDocKey, string> = {
  terms: `${WEB_URL}/legal/terms`,
  privacy: `${WEB_URL}/legal/privacy`,
};

/**
 * A legal document, readable in-product (V2 §8.5) rather than only on the web, drawn as LEGAL 01
 * (577:8876) and LEGAL 02 (580:2): a hero with the stamp and the intro, a contents card whose
 * rows scroll to their section, then one numbered card per section.
 *
 * The route validates the parameter and hands over `undefined` for anything that is not one of
 * the two documents, so the screen splits before the query: hooks cannot run conditionally, and
 * fetching a document nobody asked for to satisfy that rule would be the wrong trade.
 */
export function LegalScreen({ doc }: LegalScreenProps) {
  if (!doc) return <MissingDocument />;
  return <LegalDocument doc={doc} />;
}

function MissingDocument() {
  const { spacing } = useTheme();
  const actions = useSupportActions();

  return (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Legal" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <StateView
        icon="File06"
        title="That document doesn't exist"
        actionLabel="Go back"
        onAction={actions.goBack}
      />
    </Screen>
  );
}

function LegalDocument({ doc }: { doc: LegalDocKey }) {
  const { spacing, s } = useTheme();
  const actions = useSupportActions();
  const legal = useLegal(doc);
  const reduced = useReducedMotion();

  const [notice, setNotice] = useState<string | null>(null);

  // Where each section card sits in the scroll content: the body's top, the list's top inside it,
  // and each card's top inside the list. onLayout only ever reports against the parent.
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const bodyY = useRef(0);
  const listY = useRef(0);
  const sectionY = useRef<number[]>([]);

  const jumpTo = (index: number) => {
    const y = bodyY.current + listY.current + (sectionY.current[index] ?? 0) - s(JUMP_MARGIN);
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduced });
  };

  const openOnWeb = () => {
    setNotice(null);
    void openExternalUrl(legal.data?.url ?? LEGAL_URL[doc]).then((result) => {
      // `openExternalUrl` reports rather than throws, so a link nothing can handle would
      // otherwise be a press that did nothing at all.
      if (result !== 'unavailable') return;
      setNotice(OPEN_FAILED);
      AccessibilityInfo.announceForAccessibility(OPEN_FAILED);
    });
  };

  const failed = !legal.isPending && (legal.isError || !legal.data);

  // The hero stands in every state: the header row leaves its title slot empty, so the hero's
  // title is what still names the document when it failed to load.
  const page = (children: ReactNode) => (
    <Screen
      wash
      scroll
      scrollRef={scrollRef}
      edges={['top', 'bottom']}
      header={
        <ScreenHeader
          title={LEGAL_DOC_TITLE[doc]}
          showTitle={false}
          onBack={actions.goBack}
          trailing={<IconButton icon="LinkExternal01" label={OPEN_LABEL} onPress={openOnWeb} />}
        />
      }
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <SupportHero
        art={LEGAL_ART[doc].art}
        artWidth={LEGAL_ART[doc].width}
        artGap={ART_TO_TITLE}
        title={LEGAL_DOC_TITLE[doc]}
      >
        {failed ? null : <LegalStamp updatedAt={legal.data?.updatedAt} intro={legal.data?.intro} />}
      </SupportHero>
      {notice ? (
        <Text
          variant="caption"
          color="danger"
          align="center"
          accessibilityLiveRegion="polite"
          style={{ marginTop: spacing[3] }}
        >
          {notice}
        </Text>
      ) : null}
      <View
        style={{ marginTop: s(HERO_TO_CONTENTS) }}
        onLayout={(event: LayoutChangeEvent) => {
          bodyY.current = event.nativeEvent.layout.y;
        }}
      >
        {children}
      </View>
    </Screen>
  );

  if (legal.isPending) return page(<LegalSkeleton />);

  // There is no empty state: both documents are static content, so "nothing here" can only ever
  // mean the fetch failed — which is the state below, with the web copy still one press away.
  if (legal.isError || !legal.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this document"
        message="Check your connection and try again, or read the published copy on the web."
        actionLabel="Try again"
        onAction={() => void legal.refetch()}
        secondaryLabel={OPEN_LABEL}
        onSecondary={openOnWeb}
      />,
    );
  }

  const document = legal.data;

  return page(
    <>
      <LegalContents sections={document.sections} onJump={jumpTo} />
      <View
        style={{ marginTop: s(CONTENTS_TO_SECTIONS) }}
        onLayout={(event: LayoutChangeEvent) => {
          listY.current = event.nativeEvent.layout.y;
        }}
      >
        <LegalSections
          sections={document.sections}
          onSectionLayout={(index, y) => {
            sectionY.current[index] = y;
          }}
        />
      </View>
    </>,
  );
}
