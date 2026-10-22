import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { userSchema } from '@nextkin/shared/schemas/account';
import { profileSchema } from '@nextkin/shared/schemas/profile';
import { resumeCardSchema } from '@nextkin/shared/schemas/resumeEdit';
import { applyChoicesSchema, presignRequestSchema, presignResponseSchema, resumeParseSchema, teaserSchema, uploadSchema } from '@nextkin/shared/schemas/uploads';
import type { Database } from '../../db/database';
import { setAvatar, type AvatarSigner } from '../../services/account';
import { applyParse, getParse, startParse } from '../../services/resumeParse';
import { createResumeFromParse } from '../../services/resumeImport';
import { claimTeaser, confirmTeaser, getTeaser, presignTeaser, type TeaserDeps } from '../../services/teaser';
import { confirmUpload, getUpload, presignUpload, type UploadDeps } from '../../services/uploads';
import type { ApiEnv } from '../env';
import { etagFor } from '../etag';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Uploads, resume parsing, the avatar and the anonymous teaser (spec §11; ImBackendImplementationPlan
 * P7). A file goes presign → POST straight to storage → confirm → scanned in the background; a parse
 * waits for a clean scan, then reads, extracts and verifies, and its draft waits for the user.
 */

export interface UploadRouteDeps {
  db: Database;
  uploads: UploadDeps;
  teaser: TeaserDeps;
  signAvatar: AvatarSigner;
}

const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });
const tooLarge = { 413: { description: 'Larger than the limit (PAYLOAD_TOO_LARGE).' } };

export function uploadRoutes(deps: UploadRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: 'post',
      path: '/uploads/presign',
      tags: ['uploads'],
      summary: 'Get a presigned POST for one file: the size, type and key are fixed by its policy.',
      request: { body: json(presignRequestSchema) },
      responses: { 201: ok('POST the file here, then confirm.', presignResponseSchema), ...tooLarge, ...authErrors, ...commonErrors },
    }),
    async (c) => c.json(checked(presignResponseSchema, await presignUpload(deps.uploads, requireAuth(c).identity, c.req.valid('json'))), 201),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/uploads/{id}/confirm', tags: ['uploads'], summary: 'The file has been POSTed: scan it.', request: { params: idParam }, responses: { 200: ok('Scanning.', uploadSchema), 409: { description: 'The file has not arrived.' }, ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(uploadSchema, await confirmUpload(deps.uploads, requireAuth(c).identity, c.req.valid('param').id, c.get('requestId'))), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/uploads/{id}', tags: ['uploads'], summary: 'An upload and its scan status.', request: { params: idParam }, responses: { 200: ok('The upload.', uploadSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(uploadSchema, await getUpload(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/resume-parse',
      tags: ['resume-parse'],
      summary: 'Start reading an uploaded resume into a draft. It waits for a clean scan.',
      request: { body: json(z.object({ uploadId: z.string().max(100) }).strict()) },
      responses: { 202: ok('Started.', resumeParseSchema), 409: { description: 'The upload is not confirmed.' }, 422: { description: 'The file cannot be read (UNREADABLE_FILE).' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(resumeParseSchema, await startParse(db, requireAuth(c).identity, c.req.valid('json').uploadId, c.get('requestId'))), 202),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/resume-parse/{id}', tags: ['resume-parse'], summary: 'Poll a parse: its status, then its draft and findings.', request: { params: idParam }, responses: { 200: ok('The parse.', resumeParseSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(resumeParseSchema, await getParse(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/resume-parse/{id}/apply',
      tags: ['resume-parse'],
      summary: 'Confirm the draft into the profile, per section: keep, merge (default) or replace.',
      request: { params: idParam, body: json(applyChoicesSchema) },
      responses: { 200: { description: 'The profile.', headers: { ETag: { schema: { type: 'string' as const } } }, content: { 'application/json': { schema: profileSchema } } }, 409: { description: 'Not ready.' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => {
      const loaded = await applyParse(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json'));
      c.header('ETag', etagFor(loaded.rowVersion));
      return c.json(checked(profileSchema, loaded.profile), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/resume-parse/{id}/resume',
      tags: ['resume-parse'],
      summary: 'Put the uploaded resume in the library, as the user wrote it. Repeating it returns the same resume.',
      request: { params: idParam },
      responses: { 201: ok('The resume.', resumeCardSchema), 409: { description: 'Not ready.' }, 422: { description: 'No resume to use in the file (UNREADABLE_FILE).' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(resumeCardSchema, await createResumeFromParse(db, requireAuth(c).identity, c.req.valid('param').id)), 201),
  );

  app.openapi(
    createRoute({ method: 'put', path: '/me/avatar', tags: ['account'], summary: 'Use a clean image upload as the profile photo.', request: { body: json(z.object({ uploadId: z.string().max(100) }).strict()) }, responses: { 200: ok('The user.', userSchema), 409: { description: 'Not scanned clean.' }, ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(userSchema, await setAvatar(db, requireAuth(c).identity, c.req.valid('json').uploadId, deps.signAvatar)), 200),
  );

  // The anonymous teaser (§4.1): no session needed, limited per IP.
  const teaserPresign = presignRequestSchema.omit({ purpose: true });
  app.openapi(
    createRoute({ method: 'post', path: '/teaser/presign', tags: ['teaser'], summary: 'Anonymous: get a presigned POST for one resume (limited per IP).', request: { body: json(teaserPresign) }, responses: { 201: ok('POST the file here, then confirm.', presignResponseSchema), ...tooLarge, ...commonErrors } }),
    async (c) => c.json(checked(presignResponseSchema, await presignTeaser(deps.teaser, c.get('clientIp'), c.req.valid('json'))), 201),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/teaser/{id}/confirm', tags: ['teaser'], summary: 'Anonymous: the file has been POSTed; scan and analyse it.', request: { params: idParam }, responses: { 200: ok('Scanning.', teaserSchema), ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(teaserSchema, await confirmTeaser(deps.teaser, c.req.valid('param').id)), 200),
  );
  app.openapi(
    createRoute({ method: 'get', path: '/teaser/{id}', tags: ['teaser'], summary: 'Anonymous: the findings (D-15: no total score without a JD).', request: { params: idParam }, responses: { 200: ok('The teaser.', teaserSchema), ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(teaserSchema, await getTeaser(deps.teaser, c.req.valid('param').id)), 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/teaser/{id}/claim', tags: ['teaser'], summary: 'Keep the teaser file in the signed-in account, as a clean upload ready to parse.', request: { params: idParam }, responses: { 200: ok('The upload.', uploadSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(uploadSchema, await claimTeaser(deps.teaser, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  return app;
}
