import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Button, type ButtonVariant } from '@/ui/Button';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/**
 * The app's card kit (toreview §173, app-wide since §176), first, drawn from the Figma page "📱 Create flows
 * 2026-11": a white card with a soft lift, a round icon tile, a status pill, a tappable row and
 * the sticky footer. Shadows are never clipped: no piece here sets `overflow: hidden`.
 */

export function FlowCard({
  children,
  style,
  flat = false,
  highlight = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** No lift: a card nested in a list, or a settled state. */
  flat?: boolean;
  /** The brand outline of the card being worked on. */
  highlight?: boolean;
}) {
  const { colors, shadows, sizes, u } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: u(24),
          borderWidth: highlight ? sizes.border * 1.5 : sizes.border,
          borderColor: highlight ? colors.brand : colors.borderSoft,
          padding: u(16),
        },
        flat ? null : shadows.soft,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function IconTile({
  name,
  size = 40,
  tone = 'brand',
}: {
  name: LineIconName;
  /** Diameter at 390. */
  size?: number;
  tone?: 'brand' | 'solid' | 'success' | 'neutral' | 'card';
}) {
  const { colors, u } = useTheme();
  const looks: Record<typeof tone, readonly [string, string]> = {
    brand: [colors.brandSurface, colors.brand],
    solid: [colors.brand, colors.textOnBrand],
    success: [colors.successSurface, colors.success],
    neutral: [colors.surfaceSubtle, colors.textSecondary],
    card: [colors.surfaceCard, colors.ink],
  };
  const look = looks[tone];
  return (
    <View
      style={{
        width: u(size),
        height: u(size),
        borderRadius: u(size / 2),
        backgroundColor: look[0],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={u(size * 0.5)} color={look[1]} />
    </View>
  );
}

export function StatusPill({
  label,
  tone = 'success',
  icon,
}: {
  label: string;
  tone?: 'success' | 'warning' | 'brand' | 'neutral';
  icon?: LineIconName;
}) {
  const { colors, u } = useTheme();
  const look: Record<'success' | 'warning' | 'brand' | 'neutral', [string, ColorToken]> = {
    success: [colors.successSurface, 'success'],
    warning: [colors.warningSurface, 'warningStrong'],
    brand: [colors.brandSurface, 'brand'],
    neutral: [colors.surfaceSubtle, 'textSecondary'],
  };
  const [bg, fg] = look[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: u(4),
        paddingHorizontal: u(10),
        paddingVertical: u(4),
        borderRadius: u(999),
        backgroundColor: bg,
      }}
    >
      {icon ? <Icon name={icon} size={u(14)} color={colors[fg]} /> : null}
      <Text variant="eyebrow" color={fg}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** A row in a card: icon tile, title, one line, and a trailing piece (chevron by default). */
export function FlowRow({
  icon,
  title,
  body,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  icon: LineIconName;
  title: string;
  body?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const content = (
    <>
      <IconTile name={icon} size={36} />
      <View style={styles.rowText}>
        <Text variant="bodyLgStrong" color="ink">
          {title}
        </Text>
        {body ? (
          <Text variant="footnote" color="textSecondary">
            {body}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? <Icon name="ChevronRight" size="sm" color={colors.iconMuted} /> : null)}
    </>
  );
  return onPress ? (
    <Pressable
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={styles.row}
    >
      {content}
    </Pressable>
  ) : (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? (body ? `${title}, ${body}` : title)}
      style={styles.row}
    >
      {content}
    </View>
  );
}

export function FlowDivider() {
  const { colors, sizes } = useTheme();
  return <View style={{ height: sizes.border, backgroundColor: colors.borderSoft }} />;
}

export type FlowAction = {
  label: string;
  onPress: () => void;
  icon?: LineIconName;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
};

/** The sticky footer: one primary pill (optionally a narrow secondary beside it) and one note. */
export function FlowFooter({
  primary,
  secondary,
  note,
  noteTone = 'neutral',
  inset = false,
}: {
  primary: FlowAction;
  secondary?: FlowAction;
  note?: string;
  noteTone?: 'neutral' | 'danger';
  /** Pad itself, for a screen whose footer slot has no padding of its own (the run views). */
  inset?: boolean;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const leading = (action: FlowAction, color: string) =>
    action.icon ? <Icon name={action.icon} size={u(20)} color={color} /> : undefined;
  return (
    <View style={[styles.footer, inset ? styles.inset : null]}>
      <View style={styles.footerRow}>
        {secondary ? (
          <Button
            label={secondary.label}
            variant={secondary.variant ?? 'outline'}
            size="xl"
            disabled={secondary.disabled}
            leading={leading(secondary, colors.ink)}
            onPress={secondary.onPress}
            style={styles.secondary}
          />
        ) : null}
        <Button
          label={primary.label}
          variant={primary.variant ?? 'primary'}
          size="xl"
          block
          loading={primary.loading}
          disabled={primary.disabled}
          leading={leading(primary, colors.textOnDark)}
          haptic="medium"
          onPress={primary.onPress}
          style={styles.primary}
        />
      </View>
      {note ? (
        <Text
          variant="footnote"
          color={noteTone === 'danger' ? 'danger' : 'textTertiary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** A section heading with an optional icon and one line under it. */
export function FlowSection({
  title,
  body,
  icon,
  children,
}: {
  title: string;
  body?: string;
  icon?: LineIconName;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {icon ? <Icon name={icon} size="md" color={colors.brand} /> : null}
        <Text variant="title3" color="ink" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {body ? (
        <Text variant="callout" color="textSecondary">
          {body}
        </Text>
      ) : null}
      {children ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(12) },
  rowText: { flex: 1, gap: u(2) },
  footer: { gap: u(10) },
  inset: { paddingHorizontal: u(24), paddingTop: u(12), paddingBottom: u(8) },
  footerRow: { flexDirection: 'row', gap: u(12) },
  secondary: { minWidth: u(120) },
  primary: { flex: 1 },
  section: { gap: u(4) },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  sectionBody: { marginTop: u(12) },
}));
