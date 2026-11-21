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

/**
 * The five faces `useAppReady` loads, embedded in the native build so the first frame does not
 * wait on a runtime font load behind the splash (§244). The family names are the file names, the
 * same names `useFonts` registers, so text renders the same in Expo Go (runtime load) and a build.
 */
const EMBEDDED_FONTS = [
  '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf',
  '@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf',
  '@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf',
  '@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf',
  '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
  // The app's tsconfig has React Native's `require`, not Node's; this file runs in Node.
].map((font) => (require as unknown as { resolve: (id: string) => string }).resolve(font));

const config: ExpoConfig = {
  name: 'NextKin',
  slug: 'nextkin',
  owner: 'nextkin-edu',
  // The store version name; the build number (versionCode) is EAS's, auto-incremented (eas.json).
  version: '1.0.0',
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
    // Permissions the app never uses, which Expo's modules would otherwise add to the manifest.
    // Each one is a line on the Play Data safety form and a reason for a policy warning. The photo
    // picker (expo-image-picker) uses the system picker, which needs no storage permission.
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
    // A file secret on EAS; absent in Expo Go, which can't receive a push anyway.
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    // R8 shrinks and obfuscates the release build's Java/Kotlin, and unused resources are
    // dropped: a smaller download and less to load on a low-memory phone. Target SDK stays the
    // Expo 58 default (36), which is what Play requires.
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    // Readable stack traces: uploads source maps and debug symbols to Sentry at build time. Only
    // when the build has a token, so a build without a Sentry account still succeeds.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          [
            '@sentry/react-native/expo',
            {
              organization: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
            },
          ] as [string, Record<string, unknown>],
        ]
      : []),
    'expo-router',
    ['expo-font', { fonts: EMBEDDED_FONTS }],
    'expo-sqlite',
    'expo-secure-store',
    // Native only: a development or release build. Daily screen work in Expo Go ignores it.
    // The status-bar icon Android draws for a push: the brand mark, white on transparent, 96px
    // (toreview §245). Without one Android shows a plain white square. The colour tints it.
    [
      'expo-notifications',
      { icon: './assets/notification-icon.png', color: '#4733F9', defaultChannel: 'default' },
    ],
    // A job shared from a browser or another app: a link, or the job's text.
    [
      'expo-sharing',
      {
        android: { enabled: true, singleShareMimeTypes: ['text/plain'] },
        ios: {
          enabled: true,
          activationRule: { supportsWebUrlWithMaxCount: 1, supportsText: true },
        },
      },
    ],
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
