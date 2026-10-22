/**
 * Which client's boards the mock layer answers for.
 *
 * The two apps draw different job boards. Mobile's JOBS 01-05 artboards and the web boards (Figma
 * 304:2332 Jobs, 286:1234 Applications) name different listings, and the web Applications board's
 * 24 applications cannot share one list with the 12 mobile's JOBS 03 draws. So jobs and
 * applications are seeded per platform; every other fixture is shared.
 *
 * Hosts pick once, at module scope, before the first render — the same contract as
 * `configureMockMode`. The store seeds from the chosen platform the first time it is read and on
 * every reset. A mock-only concern: the real API has one catalogue, and no repo interface sees
 * this.
 */
export type MockPlatform = 'mobile' | 'web';

let platform: MockPlatform = 'mobile';

export function configureMockPlatform(next: MockPlatform): void {
  platform = next;
}

export function getMockPlatform(): MockPlatform {
  return platform;
}
