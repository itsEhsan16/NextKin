import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { LEGAL_DOC_TITLE, type LegalDocKey } from '@/data/models';
import { useLegal } from '@/data/queries';
import { formatShortDate, openExternalUrl } from '@/lib';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { LegalSections } from '../components/LegalSections';
import { LegalSkeleton } from '../components/LegalSkeleton';
import { useSupportActions } from '../hooks/useSupportActions';

export type LegalScreenProps = { doc?: LegalDocKey };

const OPEN_LABEL = 'Open on the web';

/** Said on the page, not through a toast: nothing hosts one above a pushed screen. */
const OPEN_FAILED = 'Nothing on this device could open the web copy.';

/**
 * The canonical addresses. The document itself carries its `url`, and that is what is used
 * whenever it loaded — this is the fallback for the one state that needs it most: §8.5 is an
 * obligation, so "the server is down" must not be the same thing as "you cannot read the terms".
 */
const LEGAL_URL: Record<LegalDocKey, string> = {
  terms: 'https://nextkin.app/legal/terms',
  privacy: 'https://nextkin.app/legal/privacy',
};

/**
 * A legal document, readable in-product (V2 §8.5) rather than only on the web. No artboard covers
 * it (plan §8, phase 9G), so it is assembled from the built primitives only.
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
  const actions = useSupportActions();

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Legal" onBack={actions.goBack} />}
    >
      <StateView
        icon="file-alt"
        title="That document doesn't exist"
        actionLabel="Go back"
        onAction={actions.goBack}
      />
    </Screen>
  );
}

function LegalDocument({ doc }: { doc: LegalDocKey }) {
  const { spacing } = useTheme();
  const actions = useSupportActions();
  const legal = useLegal(doc);

  const [notice, setNotice] = useState<string | null>(null);

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

  const page = (children: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={
        <ScreenHeader
          title={LEGAL_DOC_TITLE[doc]}
          onBack={actions.goBack}
          trailing={<IconButton icon="external-link-alt" label={OPEN_LABEL} onPress={openOnWeb} />}
        />
      }
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
    >
      {notice ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {children}
    </Screen>
  );

  if (legal.isPending) return page(<LegalSkeleton />);

  // There is no empty state: both documents are static content, so "nothing here" can only ever
  // mean the fetch failed — which is the state below, with the web copy still one press away.
  if (legal.isError || !legal.data) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
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
      <View style={{ gap: spacing[3] }}>
        <Text variant="caption" color="textTertiary">
          {`Last updated ${formatShortDate(document.updatedAt)}`}
        </Text>
        <Text variant="prose" color="textBody" selectable>
          {document.intro}
        </Text>
      </View>

      <LegalSections sections={document.sections} />
    </>,
  );
}
