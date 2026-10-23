import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { aiConsentGrantSchema, aiConsentSchema, dataExportStatusSchema } from '@nextkin/shared/schemas/privacy';

import type { IdentityProvider } from '../../auth/ports/identity';
import { clearSessionCookie, type SessionStore } from '../../auth/sessions';
import type { Database } from '../../db/database';
import type { Logger } from '../../observability/logger';
import type { PaymentProvider } from '../../payments/types';
import * as consent from '../../services/consent';
import * as privacy from '../../services/privacy';
import type { StoragePort } from '../../storage/storage';
import type { ApiEnv } from '../env';
import { AppError } from '../errors';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Consent and data rights (spec §8.5, §11; ImBackendImplementationPlan P12-11, P12-12): the AI
 * consent that gates every AI action; the self-service data export; and account deletion, which
 * ends every session at once and is purged within a day.
 */

export interface PrivacyRouteDeps {
  db: Database;
  log: Logger;
  provider: PaymentProvider;
  idp?: IdentityProvider;
  sessions?: SessionStore;
  files?: { storage: StoragePort; exportsBucket: string };
}

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function privacyRoutes(deps: PrivacyRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;
  const files = () => {
    if (!deps.files) throw new AppError('UNAVAILABLE', 'Data exports are not available right now.');
    return { db, ...deps.files };
  };

  app.openapi(createRoute({ method: 'get', path: '/me/consents/ai', tags: ['privacy'], summary: 'Whether the user consented to the current AI provider list, and the list.', responses: { 200: ok('Consent.', aiConsentSchema), ...errs } }), async (c) =>
    c.json(checked(aiConsentSchema, await consent.getAiConsent(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/me/consents/ai', tags: ['privacy'], summary: 'Consent to the AI provider list the user was shown (its version).', request: { body: json(aiConsentGrantSchema) }, responses: { 200: ok('Consent.', aiConsentSchema), 409: { description: 'The list changed since it was shown (CONFLICT).' }, ...errs } }),
    async (c) => c.json(checked(aiConsentSchema, await consent.grantAiConsent(db, requireAuth(c).identity, c.req.valid('json').version)), 200),
  );

  app.openapi(createRoute({ method: 'delete', path: '/me/consents/ai', tags: ['privacy'], summary: 'Withdraw AI consent: no new AI work runs; what exists stays.', responses: { 200: ok('Consent.', aiConsentSchema), ...errs } }), async (c) =>
    c.json(checked(aiConsentSchema, await consent.withdrawAiConsent(db, requireAuth(c).identity)), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/me/data-export', tags: ['privacy'], summary: 'The latest data export: its state, and a fresh link while it is ready.', responses: { 200: ok('The export.', dataExportStatusSchema), ...errs } }), async (c) =>
    c.json(checked(dataExportStatusSchema, await privacy.getDataExport(files(), requireAuth(c).identity)), 200),
  );

  app.openapi(createRoute({ method: 'post', path: '/me/data-export', tags: ['privacy'], summary: 'Ask for an archive of everything NextKin keeps about the user; built by the worker.', responses: { 200: ok('The export.', dataExportStatusSchema), ...errs } }), async (c) =>
    c.json(checked(dataExportStatusSchema, await privacy.requestDataExport(files(), requireAuth(c).identity, c.get('requestId') ?? null)), 200),
  );

  app.openapi(createRoute({ method: 'delete', path: '/me', tags: ['privacy'], summary: 'Delete the account: every session ends now; everything is purged within a day.', responses: { 204: { description: 'Deleted.' }, ...errs } }), async (c) => {
    if (!deps.idp || !deps.sessions) throw new AppError('UNAVAILABLE', 'Account deletion is not available right now.');
    await privacy.deleteAccount({ db, idp: deps.idp, sessions: deps.sessions, provider: deps.provider, log: deps.log }, requireAuth(c).identity);
    c.header('Set-Cookie', clearSessionCookie());
    return c.body(null, 204);
  });

  return app;
}
