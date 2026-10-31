import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { StateView } from '@/ui/StateView';

export const APP_ERROR_TITLE = 'Something went wrong';
export const APP_ERROR_MESSAGE = 'This screen ran into a problem. Try again to reload it.';
export const APP_ERROR_RETRY = 'Try again';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: Error | null };

/**
 * The one catch for render errors. Without it a throw in any screen unmounted the whole app: a red
 * screen in Expo Go, a closed app in a release build. It sits inside the providers, so the
 * fallback keeps safe area, gestures and the query client. "Try again" remounts the navigator,
 * which lands back on the first screen.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Reaches the Metro terminal in development, which is where a phone's errors are read.
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  override render() {
    if (this.state.error) return <AppErrorFallback onRetry={this.retry} />;
    return this.props.children;
  }
}

function AppErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.gutter,
        backgroundColor: colors.surfacePage,
      }}
    >
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title={APP_ERROR_TITLE}
        message={APP_ERROR_MESSAGE}
        actionLabel={APP_ERROR_RETRY}
        onAction={onRetry}
      />
    </View>
  );
}
