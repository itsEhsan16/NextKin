import { View } from 'react-native';

import type { JobLinkPreview } from '@/data/models';
import { FlowHero, type FlowArt } from '@/features/create/components/FlowHero';
import { EntryTile } from '@/features/profile/components/cards';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type CopiedLinkDialogBodyProps = {
  preview: JobLinkPreview;
  /** Which answer is being carried out: the job is added before either goes on. */
  busy: 'tailor' | 'save' | null;
  /** Why adding the job failed, said where the footnote sits. */
  failure?: string;
  onTailor: () => void;
  onSave: () => void;
  onDismiss: () => void;
};

export const COPIED_LINK_TITLE = 'Found a job link you copied';
/**
 * The board adds "Turn it off in Settings." There is no such switch (owner, 2026-10-04: no switch
 * for now), so the line says only what is true.
 */
const FOOTNOTE = 'We only check when you open NextKin.';

/** IL-T2 (661:46), the clay illustration (§211), fitted inside the board’s box, and where it sits in the dialog. */
const ART: FlowArt = {
  source: require('../../../../assets/illustrations/tailor/copied-link.webp'),
  w: 169.9,
  h: 182,
  shiftX: 0,
  toTitle: 8, // 661:46 → 634:642
};

// TAILOR 00c at 390 (634:633), in artboard units.
const PAD_X = 20 / 0.75;
const PAD_TOP = 16 / 0.75;
const PAD_BOTTOM = 18 / 0.75;
const CLOSE = 30 / 0.75; // 634:635
const ART_UNDER_CLOSE = 4 / 0.75; // the art starts 4 above the ✕ row's foot (661:46 vs 634:634)
const HERO_TO_LINK = 16 / 0.75; // 634:645
const LINK_RADIUS = 15 / 0.75; // 634:646
const LINK_PAD_X = 12 / 0.75;
const LINK_PAD_Y = 11 / 0.75;
const LINK_GAP = 12 / 0.75;
const LINK_TEXT_GAP = 2 / 0.75;
const LINK_TO_CTA = 18 / 0.75; // 634:653
const CTA_GAP = 10 / 0.75; // 634:660
const CTA_TO_NOT_NOW = 12 / 0.75; // 634:664
const NOT_NOW_H = 17 / 0.75;
const NOT_NOW_TO_NOTE = 10 / 0.75; // 634:666
const SPARKLE_W = 18 / 0.75; // 634:654
const SPARKLE_H = 17.6315 / 0.75;

/** "careers.swiggy.com/jobs/…" — the link as the user would recognise it, without the scheme. */
export const shownLink = (url: string): string =>
  url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

/**
 * TAILOR 00c (634:633): the drawing, "Found a job link you copied", the job the link names, and
 * the three answers — tailor a resume to it, just save it, or not now.
 */
export function CopiedLinkDialogBody({
  preview,
  busy,
  failure,
  onTailor,
  onSave,
  onDismiss,
}: CopiedLinkDialogBodyProps) {
  const { colors, sizes, s } = useTheme();
  const styles = useStyles();
  const link = shownLink(preview.url);

  return (
    <View style={styles.body}>
      <View style={styles.closeRow}>
        <IconButton
          icon="XClose"
          label="Close"
          variant="filled"
          size={s(CLOSE)}
          iconColor="textPrimary"
          onPress={onDismiss}
        />
      </View>

      <View style={styles.hero}>
        <FlowHero title={COPIED_LINK_TITLE} lede="Want a resume made for this job?" art={ART} />
      </View>

      <View
        accessible
        accessibilityLabel={`${preview.title} at ${preview.company}, ${link}`}
        style={[
          styles.link,
          {
            borderWidth: sizes.border,
            borderColor: colors.brandBorder,
            backgroundColor: colors.brandSurface,
          },
        ]}
      >
        <EntryTile tile={{ kind: 'letter', name: preview.company }} size="md" />
        <View style={styles.linkText}>
          <Text variant="label" numberOfLines={1}>
            {preview.title}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {link}
          </Text>
        </View>
        <Icon name="Link01" size="sm" color={colors.brand} />
      </View>

      <View style={styles.ctas}>
        <Button
          label="Tailor my resume to it"
          size="lg"
          block
          leading={<SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />}
          loading={busy === 'tailor'}
          disabled={busy === 'save'}
          onPress={onTailor}
        />
        <Button
          label="Just save the job"
          variant="ghost"
          size="lg"
          block
          leading={<Icon name="Bookmark" size="sm" color={colors.textPrimary} />}
          loading={busy === 'save'}
          disabled={busy === 'tailor'}
          onPress={onSave}
        />
      </View>

      <Pressable
        {...a11yButton('Not now', 'Close without adding the job')}
        feedback="subtle"
        hitSlop={hitSlopFor(s(NOT_NOW_H))}
        onPress={onDismiss}
        style={styles.notNow}
      >
        <Text variant="captionSemiBold" color="textSecondary" align="center">
          Not now
        </Text>
      </Pressable>

      <Text
        variant="micro"
        color={failure ? 'danger' : 'textTertiary'}
        align="center"
        accessibilityLiveRegion={failure ? 'polite' : undefined}
        style={styles.note}
      >
        {failure ?? FOOTNOTE}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  body: { paddingHorizontal: s(PAD_X), paddingTop: s(PAD_TOP), paddingBottom: s(PAD_BOTTOM) },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', zIndex: 1 },
  hero: { marginTop: -s(ART_UNDER_CLOSE) },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(LINK_GAP),
    marginTop: s(HERO_TO_LINK),
    paddingHorizontal: s(LINK_PAD_X),
    paddingVertical: s(LINK_PAD_Y),
    borderRadius: s(LINK_RADIUS),
  },
  linkText: { flex: 1, gap: s(LINK_TEXT_GAP) },
  ctas: { marginTop: s(LINK_TO_CTA), gap: s(CTA_GAP) },
  notNow: { marginTop: s(CTA_TO_NOT_NOW), alignSelf: 'center' },
  note: { marginTop: s(NOT_NOW_TO_NOTE) },
}));
