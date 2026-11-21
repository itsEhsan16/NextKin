import { createMockRepos, createRepos, parseDataSources } from '@/data/repos';
import { createHttpClient } from '@nextkin/shared/repos';

/**
 * A release build runs code Expo Go never does: `__DEV__` is false, so a mistake here shows up
 * first as an app that closes on launch, on someone else's phone. These are the checks a phone
 * can't make for us.
 */

type Profile = { env?: Record<string, string>; android?: { buildType?: string } };
type AppConfig = {
  name: string;
  version: string;
  android: { blockedPermissions?: string[] };
  plugins: (string | [string, Record<string, unknown>])[];
};
const pluginNames = (config: AppConfig) =>
  config.plugins.map((p) => (typeof p === 'string' ? p : p[0]));

const eas = require('../../eas.json') as { build: Record<string, Profile> };

const appConfig = (env: Record<string, string | undefined>) => {
  const saved = { ...process.env };
  for (const [key, value] of Object.entries({
    NEXTKIN_REQUIRE_BACKEND: undefined,
    EXPO_PUBLIC_DATA_SOURCE: undefined,
    EXPO_PUBLIC_API_BASE_URL: undefined,
    SENTRY_AUTH_TOKEN: undefined,
    ...env,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- it reads the environment as it loads.
    return require('../../app.config').default as AppConfig;
  } finally {
    process.env = saved;
  }
};

describe('a release build', () => {
  it('starts on the full backend: nothing is left for production to refuse', () => {
    const http = createHttpClient({ baseUrl: 'https://api.test', client: 'web', fetch: jest.fn() });
    const config = {
      sources: parseDataSources('http'),
      http,
      uploader: async () => {},
      adopt: () => {},
      adoptJob: () => {},
      environment: 'production' as const,
    };
    expect(() => createRepos(config, createMockRepos())).not.toThrow();
  });

  it('staging points at a real backend, over https', () => {
    const env = eas.build.staging?.env;
    expect(env?.EXPO_PUBLIC_DATA_SOURCE).toBe('http');
    expect(env?.EXPO_PUBLIC_API_BASE_URL).toMatch(/^https:\/\//);
    expect(() => appConfig(env ?? {})).not.toThrow();
  });

  it('production refuses to build without a backend, rather than shipping sample data', () => {
    expect(eas.build.production?.env?.NEXTKIN_REQUIRE_BACKEND).toBe('true');
    expect(() => appConfig(eas.build.production?.env ?? {})).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
    expect(() =>
      appConfig({
        NEXTKIN_REQUIRE_BACKEND: 'true',
        EXPO_PUBLIC_DATA_SOURCE: 'mock',
        EXPO_PUBLIC_API_BASE_URL: 'https://api.test',
      }),
    ).toThrow();
    expect(() =>
      appConfig({
        NEXTKIN_REQUIRE_BACKEND: 'true',
        EXPO_PUBLIC_DATA_SOURCE: 'http',
        EXPO_PUBLIC_API_BASE_URL: 'http://192.168.1.2:3000',
      }),
    ).toThrow();
  });

  it('leaves Expo Go and the preview build alone', () => {
    expect(appConfig({}).name).toBe('NextKin');
    expect(eas.build.preview?.env).toBeUndefined();
  });

  it('is ready for Google Play: an app bundle, a store version, and the web pages it links to', () => {
    const production = eas.build.production;
    expect(production?.android?.buildType).toBe('app-bundle');
    // Without it the legal and billing links fall back to the API host (src/lib/webUrl.ts).
    expect(production?.env?.EXPO_PUBLIC_WEB_URL).toMatch(/^https:\/\//);
    expect(appConfig({}).version).toMatch(/^[1-9]\d*\.\d+\.\d+$/);
  });

  it('asks Android for no permission it never uses', () => {
    const blocked = appConfig({}).android.blockedPermissions ?? [];
    for (const permission of [
      'SYSTEM_ALERT_WINDOW',
      'RECORD_AUDIO',
      'CAMERA',
      'WRITE_EXTERNAL_STORAGE',
    ]) {
      expect(blocked).toContain(`android.permission.${permission}`);
    }
  });

  it('shrinks the release build, and only wires Sentry uploads when a token is there', () => {
    const plain = appConfig({});
    expect(pluginNames(plain)).toContain('expo-build-properties');
    expect(pluginNames(plain)).not.toContain('@sentry/react-native/expo');
    expect(pluginNames(appConfig({ SENTRY_AUTH_TOKEN: 'x' }))).toContain(
      '@sentry/react-native/expo',
    );
  });

  it('gives Android a notification icon of its own, so a push never shows a white square', () => {
    const plugin = appConfig({}).plugins.find(
      (p): p is [string, Record<string, unknown>] =>
        Array.isArray(p) && p[0] === 'expo-notifications',
    );
    expect(plugin?.[1].icon).toBe('./assets/notification-icon.png');
  });
});
