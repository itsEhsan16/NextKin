import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

const base = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://nextkin_app:pw@127.0.0.1:5432/nextkin',
  VALKEY_URL: 'redis://127.0.0.1:6379',
  CURSOR_SECRET: 'Zq3v9Kp2Wm8Xr4Ty7Ub1Nc6Hd5Fg0JsQe8Lw',
  STAFF_TOTP_KEY: 'Hk4m8Qw2Zr6Tb9Yp3Nd7Xc1Vf5Gj0Ls2Ue',
};

describe('loadConfig', () => {
  it('accepts a minimal local configuration and applies defaults', () => {
    const config = loadConfig(base);
    expect(config.IDENTITY_ADAPTER).toBe('local');
    expect(config.LLM_ROUTE).toBe('recorded');
    expect(config.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('names every missing or invalid variable at once', () => {
    try {
      loadConfig({
        APP_ENV: 'local',
        VALKEY_URL: 'not a url',
        CURSOR_SECRET: 'x'.repeat(40),
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const { problems } = error as ConfigError;
      expect(problems.some((p) => p.startsWith('DATABASE_URL'))).toBe(true);
      expect(problems.some((p) => p.startsWith('VALKEY_URL'))).toBe(true);
    }
  });

  it('rejects an unknown environment name', () => {
    expect(() => loadConfig({ ...base, APP_ENV: 'prod' })).toThrow(ConfigError);
  });

  describe('L3: local stand-ins never reach staging or production', () => {
    const cloud = {
      ...base,
      IDENTITY_ADAPTER: 'cognito',
      SCAN_ADAPTER: 'guardduty',
      OCR_ADAPTER: 'textract',
      EMAIL_ADAPTER: 'ses',
      LLM_ROUTE: 'claudeAws',
      JOBS_ADAPTER: 'providers',
      PAYMENT_ADAPTER: 'stripe',
      STRIPE_SECRET_KEY: 'sk_test_config',
      STRIPE_WEBHOOK_SECRET: 'whsec_config',
      SECRETS_ADAPTER: 'aws',
    };

    it('accepts a configuration made only of cloud adapters', () => {
      expect(loadConfig({ ...cloud, APP_ENV: 'production' }).APP_ENV).toBe('production');
    });

    it.each(['staging', 'production'])('refuses the local identity provider in %s', (APP_ENV) => {
      expect(() => loadConfig({ ...cloud, APP_ENV, IDENTITY_ADAPTER: 'local' })).toThrow(/IDENTITY_ADAPTER=local is a local stand-in/);
    });

    it.each(['staging', 'production'])('refuses extra trusted origins (local tunnels) in %s', (APP_ENV) => {
      expect(() =>
        loadConfig({
          ...cloud,
          APP_ENV,
          APP_EXTRA_ORIGINS: 'https://*.trycloudflare.com',
        }),
      ).toThrow(/APP_EXTRA_ORIGINS \(local tunnels\) is refused/);
    });

    it('reads extra trusted origins locally, and refuses one that is not an origin', () => {
      expect(
        loadConfig({
          ...base,
          APP_EXTRA_ORIGINS: 'https://*.trycloudflare.com, https://demo.example',
        }).APP_EXTRA_ORIGINS,
      ).toEqual(['https://*.trycloudflare.com', 'https://demo.example']);
      expect(loadConfig(base).APP_EXTRA_ORIGINS).toEqual([]);
      expect(() => loadConfig({ ...base, APP_EXTRA_ORIGINS: 'https://evil.example/path' })).toThrow(ConfigError);
    });

    it('refuses the direct Claude API route (D-23 is local-only) and endpoint overrides', () => {
      try {
        loadConfig({
          ...cloud,
          APP_ENV: 'production',
          LLM_ROUTE: 'claudeDirect',
          S3_ENDPOINT: 'http://127.0.0.1:8333',
        });
        expect.unreachable();
      } catch (error) {
        const { problems } = error as ConfigError;
        expect(problems).toHaveLength(2);
      }
    });

    it('refuses a placeholder cursor secret and a spoofable IP header', () => {
      try {
        loadConfig({
          ...cloud,
          APP_ENV: 'production',
          CURSOR_SECRET: 'local-cursor-secret-change-me-0000000000',
          TRUSTED_IP_HEADER: 'x-forwarded-for',
        });
        expect.unreachable();
      } catch (error) {
        const { problems } = error as ConfigError;
        expect(problems.some((p) => p.startsWith('CURSOR_SECRET'))).toBe(true);
        expect(problems.some((p) => p.startsWith('STAFF_TOTP_KEY'))).toBe(false);
        expect(problems.some((p) => p.startsWith('TRUSTED_IP_HEADER'))).toBe(true);
      }
    });

    it('allows stand-ins in local, test and dev', () => {
      for (const APP_ENV of ['local', 'test', 'dev']) {
        expect(loadConfig({ ...base, APP_ENV }).IDENTITY_ADAPTER).toBe('local');
      }
    });
  });
});
