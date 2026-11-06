import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet } from '@/theme';
import { GradientWash } from '@/ui/GradientWash';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export type AuthShellProps = {
  title: string;
  /** One short line under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form: usually the "Have an account?" link. */
  footer?: ReactNode;
  /** Hide the back arrow (a screen nobody should leave by going back). */
  noBack?: boolean;
};

/**
 * The shell every signed-out form shares (toreview.md §172): a soft wash, a back arrow, a big
 * title with one line under it, the form, and a footer. One layout, so the forms read as one flow.
 */
export function AuthShell({ title, subtitle, children, footer, noBack = false }: AuthShellProps) {
  const router = useRouter();
  const styles = useStyles();

  return (
    <Screen keyboard scroll edges={['top', 'bottom']} padded={false} footer={footer}>
      <GradientWash depth={0.4} />
      <View style={styles.body}>
        {noBack ? (
          <View style={styles.backSpace} />
        ) : (
          <IconButton
            icon="ArrowLeft"
            label="Go back"
            variant="outline"
            onPress={() => router.back()}
            style={styles.back}
          />
        )}
        <View accessible {...a11yHeader(title)} style={styles.heading}>
          <Text variant="title1" color="ink">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyLg" color="textSecondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  body: { paddingHorizontal: u(24), paddingTop: u(8), paddingBottom: u(24) },
  back: { alignSelf: 'flex-start' },
  backSpace: { height: u(44) },
  heading: { marginTop: u(24), marginBottom: u(28), gap: u(8) },
}));
