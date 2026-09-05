import { Linking } from 'react-native';

/** Structural stand-in for expo-web-browser; the enum is read off the module, never imported. */
type BrowserOptions = {
  presentationStyle?: string;
  dismissButtonStyle?: 'done' | 'close' | 'cancel';
};
type WebBrowserModule = {
  openBrowserAsync(url: string, options?: BrowserOptions): Promise<unknown>;
  WebBrowserPresentationStyle?: Record<string, string>;
};

let cached: WebBrowserModule | null | undefined;

/**
 * expo-web-browser is required lazily: @/lib is imported by every screen, so a static native
 * import would take every route (and Jest) down with it if the module is missing from the
 * runtime. Linking is core React Native, so it is a normal import and covers the fallback.
 */
function webBrowserModule(): WebBrowserModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-web-browser') as WebBrowserModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Open a link outside the app. The in-app sheet keeps the user in NextKin, so it is preferred;
 * without the module the system browser still opens, which is 'done' from the caller's side —
 * only a link nothing can handle is 'unavailable'.
 */
export async function openExternalUrl(url: string): Promise<'done' | 'unavailable'> {
  const module = webBrowserModule();
  if (module) {
    try {
      // The enum is a value export, so reading it off the lazily-required module keeps the
      // static import out; its PAGE_SHEET member is the string we would have hard-coded anyway.
      const pageSheet = module.WebBrowserPresentationStyle?.PAGE_SHEET ?? 'pageSheet';
      await module.openBrowserAsync(url, {
        presentationStyle: pageSheet,
        dismissButtonStyle: 'close',
      });
      return 'done';
    } catch {
      // Fall through to Linking rather than reporting failure on a URL the OS may still handle.
    }
  }
  try {
    await Linking.openURL(url);
    return 'done';
  } catch {
    return 'unavailable';
  }
}
