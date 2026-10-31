import type { ExpoConfig } from 'expo/config';

// A staging or production profile sets NEXTKIN_REQUIRE_BACKEND, so a build that would ship the
// sample data and accept any password fails here instead of reaching someone's phone.
if (process.env.NEXTKIN_REQUIRE_BACKEND === 'true') {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  if (process.env.EXPO_PUBLIC_DATA_SOURCE !== 'http' || !url.startsWith('https://')) {
    throw new Error(
      'This build profile needs the real backend: set EXPO_PUBLIC_DATA_SOURCE=http and an https EXPO_PUBLIC_API_BASE_URL.',
    );
  }
}

const config: ExpoConfig = {
  name: 'NextKin',
  slug: 'nextkin',
  owner: 'nextkin-edu',
  version: '0.1.0',
  scheme: 'nextkin',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Light only: the app has no dark mode, so the phone's dark theme must not reach it.
  userInterfaceStyle: 'light',
  backgroundColor: '#FFFFFF',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.nextkin.app',
  },
  android: {
    package: 'com.nextkin.app',
    // Saved resumes live in the app's storage; they shouldn't leave the phone in a device backup.
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
      },
    ],
  ],
  extra: { eas: { projectId: '3573538a-72e7-4602-8167-8ffee307795e' } },
  experiments: { typedRoutes: true },
};

export default config;
