/**
 * The four lazy native wrappers in @/lib (share, openUrl, storeReview, clipboard). Each caches
 * its require() at module scope, so every test resets the registry, mocks the package, and then
 * requires the wrapper afresh — otherwise the first test's module would answer all of them.
 */

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('shareFile', () => {
  it('passes the mime type through and spells the iOS key UTI', async () => {
    const shareAsync = jest.fn(() => Promise.resolve());
    jest.resetModules();
    jest.doMock('expo-sharing', () => ({
      isAvailableAsync: () => Promise.resolve(true),
      shareAsync,
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
    const { shareFile } = require('@/lib/share') as typeof import('@/lib/share');

    const result = await shareFile('file:///tmp/resume.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Share résumé',
      uti: 'com.adobe.pdf',
    });

    expect(result).toBe('done');
    expect(shareAsync).toHaveBeenCalledWith('file:///tmp/resume.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Share résumé',
      UTI: 'com.adobe.pdf',
    });
  });

  it('reports unavailable without opening a sheet when sharing is not available', async () => {
    const shareAsync = jest.fn(() => Promise.resolve());
    jest.resetModules();
    jest.doMock('expo-sharing', () => ({
      isAvailableAsync: () => Promise.resolve(false),
      shareAsync,
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
    const { shareFile } = require('@/lib/share') as typeof import('@/lib/share');

    const result = await shareFile('file:///tmp/resume.pdf', { mimeType: 'application/pdf' });

    expect(result).toBe('unavailable');
    expect(shareAsync).not.toHaveBeenCalled();
  });
});

describe('shareText', () => {
  it('maps the core Share dismissal to "dismissed"', async () => {
    const share = jest.fn(() => Promise.resolve({ action: 'dismissedAction' }));
    jest.resetModules();
    jest.doMock('react-native/Libraries/Share/Share', () => ({
      __esModule: true,
      default: { share, sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
    const { shareText } = require('@/lib/share') as typeof import('@/lib/share');

    const result = await shareText('Frontend Developer at Google', { url: 'https://nextkin.app' });

    expect(result).toBe('dismissed');
    expect(share).toHaveBeenCalledWith({
      message: 'Frontend Developer at Google',
      title: undefined,
      url: 'https://nextkin.app',
    });
  });
});

describe('openExternalUrl', () => {
  it('opens the in-app browser as a page sheet with a close button', async () => {
    const openBrowserAsync = jest.fn(() => Promise.resolve({ type: 'opened' }));
    jest.resetModules();
    jest.doMock('expo-web-browser', () => ({
      openBrowserAsync,
      // Deliberately not the literal 'pageSheet' the wrapper falls back to: the assertion below
      // only passes if the enum was read off the module, as the SDK's PAGE_SHEET member would be.
      WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet-from-enum' },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
    const { openExternalUrl } = require('@/lib/openUrl') as typeof import('@/lib/openUrl');

    const result = await openExternalUrl('https://nextkin.app/jobs/1');

    expect(result).toBe('done');
    expect(openBrowserAsync).toHaveBeenCalledWith('https://nextkin.app/jobs/1', {
      presentationStyle: 'pageSheet-from-enum',
      dismissButtonStyle: 'close',
    });
  });
});

describe('requestStoreReview', () => {
  it('stays unavailable — and asks for nothing — when hasAction() is false', async () => {
    const requestReview = jest.fn(() => Promise.resolve());
    jest.resetModules();
    jest.doMock('expo-store-review', () => ({
      isAvailableAsync: () => Promise.resolve(true),
      hasAction: () => Promise.resolve(false),
      requestReview,
    }));
    const { requestStoreReview } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
      require('@/lib/storeReview') as typeof import('@/lib/storeReview');

    expect(await requestStoreReview()).toBe('unavailable');
    expect(requestReview).not.toHaveBeenCalled();
  });
});

describe('copyToClipboard', () => {
  it('writes the text to the system clipboard', async () => {
    const setStringAsync = jest.fn(() => Promise.resolve(true));
    jest.resetModules();
    jest.doMock('expo-clipboard', () => ({ setStringAsync }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh copy per test, see above.
    const { copyToClipboard } = require('@/lib/clipboard') as typeof import('@/lib/clipboard');

    expect(await copyToClipboard('NK-2931-AB')).toBe('done');
    expect(setStringAsync).toHaveBeenCalledWith('NK-2931-AB');
  });
});
