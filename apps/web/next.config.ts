import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

// The backend's configuration lives in the repository-root .env (one file for web, worker and
// migrations — `.env.example`). Next only reads apps/web/.env*, so load the root file in
// development. Production never reads a file: ECS injects the environment.
const rootEnv = join(process.cwd(), '../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // A second dev server (a verification run, a parallel session) needs its own build directory:
  // Next locks the one a running server uses. Unset, it is the default `.next`.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  // @nextkin/shared ships TypeScript source with no build step, so Next has to compile it.
  // That is deliberate: a prebuilt package would strip the 'worklet' directives Metro needs on
  // the mobile side, and would put a build between an edit and both apps seeing it.
  // @nextkin/server is TypeScript source too; the /api/v1 catch-all mounts it (V2 §9.3).
  // @nextkin/engines (the scoring and validation engines shared and the server both import) is the
  // same.
  transpilePackages: ['@nextkin/shared', '@nextkin/server', '@nextkin/engines'],

  // The dev server refuses its own scripts and hot reload to any host but localhost, so a page
  // opened through a Cloudflare quick tunnel (sharing a local build for a test) never hydrates and
  // sits on its placeholders. Dev only; a production build ignores this.
  allowedDevOrigins: ['*.trycloudflare.com'],

  // Native-adjacent server libraries are required at runtime, not bundled.
  serverExternalPackages: ['pg', 'pino'],

  // V2 9.5: the standalone server is what the ECS image runs.
  output: 'standalone',

  // V2 9.2: the built-in gzip buffers streamed responses, which would break the SSE progress
  // channel (7.6) and the assistant's token stream (7.16). CloudFront compresses instead.
  compress: false,

  // No framework banner on pages (P13-01; a ZAP baseline flags it). The API never sent one.
  poweredByHeader: false,

  typedRoutes: true,

  // The Account page became Profile (476:4, `toreview.md` §91); old links and bookmarks land there.
  async redirects() {
    return [{ source: '/account', destination: '/profile', permanent: false }];
  },

  // P11-07: the sitemap is built by the API from the published Skills Explorer entries.
  async rewrites() {
    return [{ source: '/sitemap.xml', destination: '/api/v1/public/sitemap.xml' }];
  },
};

export default nextConfig;
