import { describe, expect, it } from 'vitest';
import { trustedOrigins } from '../src/http/origins';

describe('trusted origins (toreview §131.10)', () => {
  const trusted = trustedOrigins('http://localhost:3000', ['https://*.trycloudflare.com', 'https://demo.example']);

  it('trusts the app origin, exact extras and one DNS label under a pattern', () => {
    expect(trusted('http://localhost:3000')).toBe(true);
    expect(trusted('https://demo.example')).toBe(true);
    expect(trusted('https://worcester-racks-reduction-clarke.trycloudflare.com')).toBe(true);
  });

  it('trusts nothing a pattern was not written for', () => {
    expect(trusted('https://trycloudflare.com')).toBe(false); // no label for the *
    expect(trusted('https://a.b.trycloudflare.com')).toBe(false); // two labels
    expect(trusted('https://evil.trycloudflare.com.attacker.example')).toBe(false);
    expect(trusted('http://worcester.trycloudflare.com')).toBe(false); // the scheme is part of it
    expect(trusted('https://localhost:3000')).toBe(false);
    expect(trusted('https://demo.example.attacker.example')).toBe(false);
  });

  it('without extras, only the app origin', () => {
    const only = trustedOrigins('http://localhost:3000');
    expect(only('http://localhost:3000')).toBe(true);
    expect(only('https://x.trycloudflare.com')).toBe(false);
  });
});
