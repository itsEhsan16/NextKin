import type { MetadataRoute } from 'next';

/**
 * robots.txt (ImBackendImplementationPlan P11-07; V2 §7.14, §8.1). The public pages are crawlable;
 * the API, shared report links (a person's report, shared with people) and the dev pages are not.
 * The sitemap is the API's (`/sitemap.xml` is rewritten to it in next.config) and lists published
 * Skills Explorer entries only.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const origin = (process.env.APP_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/r/', '/dev/'] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
