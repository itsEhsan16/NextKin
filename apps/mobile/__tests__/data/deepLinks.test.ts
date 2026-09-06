import { activityFixture, notificationsFixture } from '@/data/mock';

/**
 * Every fixture deep link, checked against the route table.
 *
 * A `deepLink` is a plain string. When a placeholder key is retired the union shrinks and
 * `tsc` catches every typed reference — but not these, and four activity rows and one
 * notification pointed at `/placeholder/<key>` for phases after those screens had shipped,
 * landing on a blank "Coming soon". This is the net the type system cannot be.
 *
 * Keep the table in step with `app/`: a route that moves should fail here, not on a tap.
 */
const ROUTES: readonly RegExp[] = [
  /^\/jobs$/,
  /^\/jobs\/[\w-]+$/,
  /^\/jobs\/[\w-]+\/(company|criteria)$/,
  /^\/notifications(\/preferences)?$/,
  /^\/resumes$/,
  /^\/resumes\/new$/,
  /^\/resumes\/[\w-]+$/,
  /^\/resumes\/[\w-]+\/(score|rubric|fix)$/,
  /^\/resumes\/[\w-]+\/edit\/[\w-]+$/,
  /^\/create\/(tailor|jd-review|cover-letter|ats-check|zero-resume|upload|upload-review|import-linkedin)$/,
  /^\/generations\/[\w-]+$/,
  /^\/upgrade$/,
  /^\/support\/(help|contact)$/,
  /^\/legal\/(terms|privacy)$/,
  /^\/account\/(email|export)$/,
  /^\/profile\/(edit|skills|desired-roles|locations|experience|education|certifications|links)$/,
  /^\/profile\/(experience|education|certifications|links)\/[\w-]+$/,
  /^\/history$/,
  /^\/interview(\/[\w-]+)?$/,
  /^\/assistant$/,
];

const isKnownRoute = (href: string): boolean => ROUTES.some((route) => route.test(href));

describe('fixture deep links land on real routes', () => {
  it.each([
    ['activity', activityFixture.map((entry) => [entry.id, entry.deepLink] as const)],
    ['notifications', notificationsFixture.map((n) => [n.id, n.deepLink] as const)],
  ])('%s', (_name, links) => {
    for (const [id, href] of links) {
      if (href == null) continue;
      expect({ id, href, known: isKnownRoute(href) }).toEqual({ id, href, known: true });
      expect(href).not.toContain('/placeholder/');
    }
  });
});
