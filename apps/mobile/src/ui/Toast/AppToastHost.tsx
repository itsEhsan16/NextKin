import { Toast } from './Toast';
import { useAppToast } from './appToast';

/**
 * Renders `useAppToast` over the whole app. Mounted once, after the navigator in
 * `AppProviders`, so it paints above every screen, pushed or not.
 */
export function AppToastHost() {
  const message = useAppToast((state) => state.message);
  const tone = useAppToast((state) => state.tone);
  const hide = useAppToast((state) => state.hide);

  return <Toast visible={message != null} message={message ?? ''} tone={tone} onHide={hide} />;
}
