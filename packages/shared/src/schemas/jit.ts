import { z } from 'zod';

/**
 * Importing this module turns off zod's compiled (JIT) parsers. zod probes for them with
 * `Function("")` the first time it parses an object; under a Content-Security-Policy without
 * `'unsafe-eval'` (the web app's, `apps/web/src/lib/securityHeaders.ts`) the probe is refused and
 * every page files a CSP violation, although zod then falls back to this same interpreted path.
 * A side effect at import, because the first parse can happen while other modules are still
 * importing: import it before anything that uses a schema. Mobile does not need it (Hermes has no
 * CSP).
 */
z.config({ jitless: true });
