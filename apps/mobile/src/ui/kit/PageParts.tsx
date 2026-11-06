import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Image } from 'expo-image';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { GradientWash } from '@/ui/GradientWash';
import { Icon, type LineIconName } from '@/ui/Icon';
import { ILLUSTRATIONS, type IllustrationName } from '@/ui/illustrations';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/**
 * The top of a tab or a main page (toreview §176): the soft lavender wash, a big title, one line
 * under it, and an optional trailing slot (an avatar, a bell, an add button). The wash sits behind
 * the page's first screenful only; the content below scrolls over plain page colour.
 */
export function PageHero({
  title,
  subtitle,
  eyebrow,
  trailing,
  children,
  wash = 0.4,
  style,
}: {
  title: string;
  subtitle?: string;
  /** A small line above the title: "Good morning", "12 saved". */
  eyebrow?: string;
  trailing?: ReactNode;
  /** Whatever belongs to the hero: a search field, chips, a summary card. */
  children?: ReactNode;
  /** How far down the wash reaches, as a share of the page (0 for none). */
  wash?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.hero, style]}>
      {wash > 0 ? <GradientWash depth={wash} /> : null}
      <View style={styles.row}>
        <View style={styles.text}>
          {eyebrow ? (
            <Text variant="callout" color="textSecondary">
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="title1" color="ink" {...a11yHeader(title)}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyLg" color="textSecondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

/** A heading for a group of cards: a title and an optional "See all" link with a chevron. */
export function KitSection({
  title,
  actionLabel = 'See all',
  onAction,
  children,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Text variant="title3" color="ink" {...a11yHeader(title)} style={styles.flex}>
          {title}
        </Text>
        {onAction ? (
          <Pressable
            feedback="subtle"
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}, ${title}`}
            hitSlop={u(12)}
            onPress={onAction}
            style={styles.link}
          >
            <Text variant="footnote" color="brand">
              {actionLabel}
            </Text>
            <Icon name="ChevronRight" size={u(14)} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One figure in a row of three: an icon, the value, a label ("3 · Missing"). */
export function StatTile({
  icon,
  value,
  label,
  tone = 'neutral',
  onPress,
}: {
  icon: LineIconName;
  value: string;
  label: string;
  tone?: 'neutral' | 'brand';
  onPress?: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const body = (
    <>
      <Icon name={icon} size={u(18)} color={colors.brand} />
      <Text variant="title3" color="ink" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="footnote" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const look = [
    styles.stat,
    { backgroundColor: tone === 'brand' ? colors.brandSurface : colors.surfaceSubtle },
  ];
  return onPress ? (
    <Pressable
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={look}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={look}>
      {body}
    </View>
  );
}

/** A redesign illustration by name, decorative, at a square size (390 units). */
export function Illustration({ name, size = 140 }: { name: IllustrationName; size?: number }) {
  const { u } = useTheme();
  // A sized box around the image: on web expo-image's own wrapper collapsed to no height (§178).
  return (
    <View style={{ width: u(size), height: u(size) }}>
      <Image
        source={ILLUSTRATIONS[name]}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        accessible={false}
      />
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  hero: { paddingTop: u(8), paddingBottom: u(20), gap: u(16) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: u(12) },
  text: { flex: 1, gap: u(6) },
  trailing: { paddingTop: u(4) },
  children: { gap: u(12) },
  section: { gap: u(12) },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  flex: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2) },
  stat: {
    flex: 1,
    gap: u(2),
    paddingHorizontal: u(12),
    paddingVertical: u(12),
    borderRadius: u(16),
  },
}));
