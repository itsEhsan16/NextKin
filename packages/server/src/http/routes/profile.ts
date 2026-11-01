import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { profileLinkInputSchema } from '@nextkin/shared/schemas/settings';
import {
  certificationInputSchema,
  confirmFactsSchema,
  educationInputSchema,
  experienceInputSchema,
  preferencesPatchSchema,
  profileDraftSchema,
  profilePatchSchema,
  profileSchema,
  skillsInputSchema,
} from '@nextkin/shared/schemas/profile';
import type { IdempotencyStore } from '../../cache/stores';
import type { Database } from '../../db/database';
import * as profile from '../../services/profile';
import type { LoadedProfile } from '../../services/profileRead';
import type { ApiEnv } from '../env';
import { etagFor, requireIfMatch } from '../etag';
import { idempotent, requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError, writeErrors } from './common';

/**
 * `/api/v1/profile` (spec §11; ImBackendImplementationPlan P5-04). Every response is the whole
 * profile with its ETag, so a client always holds the current version after any write. Identity
 * and preference writes need If-Match; entry creates honour Idempotency-Key.
 */

export interface ProfileDeps {
  db: Database;
  idempotency: IdempotencyStore;
}

const etagHeader = { ETag: { description: 'The profile version, for If-Match.', schema: { type: 'string' as const } } };
const whole = (description: string) => ({ description, headers: etagHeader, content: { 'application/json': { schema: profileSchema } } });
const body = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const ifMatch = z.object({ 'if-match': z.string().optional() });
const idParam = z.object({ id: z.string().max(100) });

function respond(c: Context<ApiEnv>, loaded: LoadedProfile) {
  c.header('ETag', etagFor(loaded.rowVersion));
  return c.json(checked(profileSchema, loaded.profile), 200);
}

function created(c: Context<ApiEnv>, loaded: LoadedProfile) {
  c.header('ETag', etagFor(loaded.rowVersion));
  return c.json(checked(profileSchema, loaded.profile), 201);
}

type Section = {
  path: 'experience' | 'education' | 'certifications' | 'links';
  table: 'experience' | 'education' | 'certifications' | 'profile_links';
  what: string;
  input: z.ZodType;
  create: (db: Database, identity: Parameters<typeof profile.getProfile>[1], value: never) => Promise<LoadedProfile>;
  replace: (db: Database, identity: Parameters<typeof profile.getProfile>[1], id: string, value: never) => Promise<LoadedProfile>;
};

const SECTIONS: Section[] = [
  { path: 'experience', table: 'experience', what: 'Experience', input: experienceInputSchema, create: profile.entries.createExperience, replace: profile.entries.replaceExperience },
  { path: 'education', table: 'education', what: 'Education', input: educationInputSchema, create: profile.entries.createEducation, replace: profile.entries.replaceEducation },
  { path: 'certifications', table: 'certifications', what: 'Certification', input: certificationInputSchema, create: profile.entries.createCertification, replace: profile.entries.replaceCertification },
  { path: 'links', table: 'profile_links', what: 'ProfileLink', input: profileLinkInputSchema, create: profile.entries.createLink, replace: profile.entries.replaceLink },
];

export function profileRoutes(deps: ProfileDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;

  // Auth first on every write, so an anonymous request never claims an idempotency key.
  app.use('/profile/*', async (c, next) => {
    if (c.req.method !== 'GET') requireAuth(c);
    await next();
  });

  app.openapi(
    createRoute({ method: 'get', path: '/profile', tags: ['profile'], summary: 'The whole profile, with derived completeness and next steps.', responses: { 200: whole('The profile.'), ...authErrors, ...commonErrors } }),
    async (c) => respond(c, await profile.getProfile(db, requireAuth(c).identity)),
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/profile',
      tags: ['profile'],
      summary: 'Change identity fields (headline, location, years, phone, bio, tagline). Requires If-Match.',
      request: { headers: ifMatch, body: body(profilePatchSchema) },
      responses: { 200: whole('The profile.'), ...authErrors, ...writeErrors, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      const current = await profile.getProfile(db, identity);
      requireIfMatch(c.req.valid('header')['if-match'], current.rowVersion);
      return respond(c, await profile.updateIdentity(db, identity, current.rowVersion, c.req.valid('json')));
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/profile/preferences',
      tags: ['profile'],
      summary: 'Merge job preferences. Requires If-Match.',
      request: { headers: ifMatch, body: body(preferencesPatchSchema) },
      responses: { 200: whole('The profile.'), ...authErrors, ...writeErrors, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      const current = await profile.getProfile(db, identity);
      requireIfMatch(c.req.valid('header')['if-match'], current.rowVersion);
      return respond(c, await profile.updatePreferences(db, identity, current.rowVersion, c.req.valid('json')));
    },
  );

  for (const section of SECTIONS) {
    app.on('POST', `/profile/${section.path}`, idempotent(deps.idempotency, { required: false }));
    app.openapi(
      createRoute({
        method: 'post',
        path: `/profile/${section.path}`,
        tags: ['profile'],
        summary: `Add a ${section.what} entry (server-issued id). Honours Idempotency-Key.`,
        request: { headers: z.object({ 'idempotency-key': z.string().optional() }), body: body(section.input) },
        responses: { 201: whole('The profile, with the new entry.'), ...authErrors, ...writeErrors, ...commonErrors },
      }),
      async (c) => created(c, await section.create(db, requireAuth(c).identity, c.req.valid('json') as never)),
    );
    app.openapi(
      createRoute({
        method: 'put',
        path: `/profile/${section.path}/{id}`,
        tags: ['profile'],
        summary: `Replace a ${section.what} entry in place.`,
        request: { params: idParam, body: body(section.input) },
        responses: { 200: whole('The profile.'), ...authErrors, ...notFoundError, ...commonErrors },
      }),
      async (c) => respond(c, await section.replace(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json') as never)),
    );
    app.openapi(
      createRoute({
        method: 'delete',
        path: `/profile/${section.path}/{id}`,
        tags: ['profile'],
        summary: `Remove a ${section.what} entry.`,
        request: { params: idParam },
        responses: { 200: whole('The profile, without the entry.'), ...authErrors, ...notFoundError, ...commonErrors },
      }),
      async (c) => respond(c, await profile.entries.remove(db, requireAuth(c).identity, section.table, c.req.valid('param').id, section.what)),
    );
  }

  app.openapi(
    createRoute({
      method: 'put',
      path: '/profile/skills',
      tags: ['profile'],
      summary: 'Replace the whole skill list, in order.',
      request: { body: body(skillsInputSchema) },
      responses: { 200: whole('The profile.'), ...authErrors, ...commonErrors },
    }),
    async (c) => respond(c, await profile.replaceSkills(db, requireAuth(c).identity, c.req.valid('json').skills)),
  );

  app.on('POST', '/profile/draft', idempotent(deps.idempotency, { required: false }));
  app.openapi(
    createRoute({
      method: 'post',
      path: '/profile/draft',
      tags: ['profile'],
      summary: 'Commit the accepted rows of a parsed upload (deduplicated). Honours Idempotency-Key.',
      request: { headers: z.object({ 'idempotency-key': z.string().optional() }), body: body(profileDraftSchema) },
      responses: { 200: whole('The profile.'), ...authErrors, ...writeErrors, ...commonErrors },
    }),
    async (c) => respond(c, await profile.applyDraft(db, requireAuth(c).identity, c.req.valid('json'))),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/profile/confirm',
      tags: ['profile'],
      summary: 'Make facts read from a resume the person\'s own word: one row, or every row of a kind.',
      request: { body: body(confirmFactsSchema) },
      responses: { 200: whole('The profile.'), ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => respond(c, await profile.confirmFacts(db, requireAuth(c).identity, c.req.valid('json'))),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/profile/next-steps/{id}/complete',
      tags: ['profile'],
      summary: 'Next steps are derived from missing data: this changes nothing and answers with the profile.',
      request: { params: idParam },
      responses: { 200: whole('The profile.'), ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => respond(c, await profile.completeNextStep(db, requireAuth(c).identity, c.req.valid('param').id)),
  );

  return app;
}
