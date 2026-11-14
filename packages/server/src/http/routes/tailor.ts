import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { figureDraftRequestSchema, figureDraftSchema, keywordQuestionsRequestSchema, keywordQuestionsSchema } from '@nextkin/shared/schemas/jd';

import { draftFigure, type FigureDraftDeps } from '../../services/figureDraft';
import { askKeywordQuestions } from '../../services/keywordQuestions';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Tailoring helpers the fix plan calls while the user answers it (toreview §129). "Add the result":
 * one bullet of one of the user's resumes, rewritten around a gap for its real figure.
 */
export function tailorRoutes(deps: FigureDraftDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.openapi(
    createRoute({
      method: 'post',
      path: '/tailor/figure-draft',
      tags: ['tailor'],
      summary: 'A bullet rewritten around a gap where the user writes its real result. The AI never writes a figure into the line; it may offer one guess apart, which the user must choose.',
      request: { body: { required: true, content: { 'application/json': { schema: figureDraftRequestSchema } } } },
      responses: {
        200: { description: 'The draft.', content: { 'application/json': { schema: figureDraftSchema } } },
        ...authErrors,
        ...notFoundError,
        ...commonErrors,
      },
    }),
    async (c) => c.json(checked(figureDraftSchema, await draftFigure(deps, requireAuth(c).identity, c.req.valid('json'))), 200),
  );
  app.openapi(
    createRoute({
      method: 'post',
      path: '/tailor/keyword-questions',
      tags: ['tailor'],
      summary: 'Questions about keywords the job asks for that the resume does not show, each beside the resume line that hints at it. Nothing is added to a resume here; only the candidate’s "yes" does that, through the run.',
      request: { body: { required: true, content: { 'application/json': { schema: keywordQuestionsRequestSchema } } } },
      responses: {
        200: { description: 'The questions.', content: { 'application/json': { schema: keywordQuestionsSchema } } },
        ...authErrors,
        ...notFoundError,
        ...commonErrors,
      },
    }),
    async (c) => c.json(checked(keywordQuestionsSchema, { questions: await askKeywordQuestions(deps, requireAuth(c).identity, c.req.valid('json')) }), 200),
  );
  return app;
}
