import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'NextKin',
  slug: 'nextkin',
  owner: 'nextkin-edu',
  version: '0.1.0',
  scheme: 'nextkin',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FFFFFF',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.nextkin.app',
  },
  android: {
    package: 'com.nextkin.app',
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
