import { contentSecurityPolicy, pageSecurityHeaders, storageOrigins } from '@/lib/securityHeaders';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `));

describe('page security headers', () => {
  it('forbids framing both ways', () => {
    const headers = pageSecurityHeaders({ dev: false });
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(directive(headers['Content-Security-Policy']!, 'frame-ancestors')).toBe(
      "frame-ancestors 'none'",
    );
    expect(directive(headers['Content-Security-Policy']!, 'frame-src')).toBe("frame-src 'none'");
  });

  it('allows scripts only from this origin, and eval only in development', () => {
    expect(directive(contentSecurityPolicy({ dev: false }), 'script-src')).toBe(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(directive(contentSecurityPolicy({ dev: true }), 'script-src')).toContain(
      "'unsafe-eval'",
    );
  });

  it('lets the browser read a picked file (blob:) and reach local storage, and keeps plain-http requests unrewritten there', () => {
    const csp = contentSecurityPolicy({ dev: false, s3Endpoint: 'http://127.0.0.1:8333' });
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' blob: http://127.0.0.1:8333");
    expect(directive(csp, 'img-src')).toContain('http://127.0.0.1:8333');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('uses S3 in the cloud, upgrades insecure requests, and adds a separate API origin', () => {
    expect(storageOrigins({ awsRegion: 'us-west-2' })).toEqual([
      'https://*.s3.us-west-2.amazonaws.com',
      'https://*.s3.amazonaws.com',
    ]);
    const csp = contentSecurityPolicy({
      dev: false,
      awsRegion: 'us-east-1',
      apiBaseUrl: 'https://api.example.test/api/v1',
    });
    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' blob: https://*.s3.us-east-1.amazonaws.com https://*.s3.amazonaws.com https://api.example.test",
    );
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('never allows plugins or a foreign <base>, and sends nosniff', () => {
    const headers = pageSecurityHeaders({ dev: false });
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("base-uri 'self'");
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
