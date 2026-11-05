import { z } from 'zod';

/**
 * The admin Content routes' responses (P12-03…P12-05), as `packages/server/src/http/routes/admin.ts`
 * returns them. The routes declare `z.unknown()`, so these are read off the services:
 * `services/admin/prompts.ts`, `technologies.ts` and `catalog.ts`, and the eval runner
 * `evals/promptEval.ts`. Unknown fields pass through, so a column added on the server doesn't break
 * the client. Dates arrive as ISO strings (Hono's `c.json` serialises the rows' `Date`s).
 */

// --- Prompts -------------------------------------------------------------------------------------

/** One version in `GET /admin/prompts` (`listPrompts`). `evaluated`: a passing eval is recorded. */
export const promptVersionWire = z
  .object({
    id: z.string(),
    version: z.number(),
    /** draft → staged → active; activating another archives the previous one. */
    status: z.string(),
    evaluated: z.boolean(),
    createdAt: z.string(),
    /** `{ system: string[] }` (`promptBodySchema`). */
    body: z.unknown().optional(),
  })
  .passthrough();

export type PromptVersionWire = z.infer<typeof promptVersionWire>;

export const promptsWire = z.object({
  data: z.array(
    z
      .object({
        name: z.string(),
        stage: z.string(),
        description: z.string().nullish(),
        /** Whether any eval covers this template (`EVALUATED_TEMPLATES`). */
        evaluated: z.boolean().optional(),
        versions: z.array(promptVersionWire),
      })
      .passthrough(),
  ),
});

export type PromptWire = z.infer<typeof promptsWire>['data'][number];

/**
 * `POST …/versions/{id}/evaluate` answers `{ id, status, createdAt }`; `GET …/evaluations/{id}`
 * (`getEvaluation`) adds `versionId`, `mode`, `report` and `finishedAt`.
 */
export const evaluationWire = z
  .object({
    id: z.string(),
    /** running | passed | failed | unsupported */
    status: z.string(),
    /** reference | recorded | live: only `live` measured the candidate prompt itself. */
    mode: z.string().nullish(),
    /** Absent from the 202 that starts it (Zod 4 makes a bare `z.unknown()` key required). */
    report: z.unknown().optional(),
    createdAt: z.string().optional(),
    finishedAt: z.string().nullish(),
  })
  .passthrough();

export type EvaluationWire = z.infer<typeof evaluationWire>;

/** assistant.classify's report: the scope set scored against its bar (`scoreScope`). */
export const scopeReportWire = z
  .object({ total: z.number(), correct: z.number(), accuracy: z.number(), bar: z.number() })
  .passthrough();

/** The golden-set gate's report (jd.extract, resume.generate, resume.revise): every failure in words. */
export const gateReportWire = z
  .object({ golden: z.string().optional(), failures: z.array(z.string()) })
  .passthrough();

/** An unsupported template, or an eval that couldn't run. */
export const messageReportWire = z.object({ message: z.string() }).passthrough();

// --- The Technology KB ---------------------------------------------------------------------------

/** One `technologies` row (`selectAll()`), as list, create, update and review return it. */
export const technologyWire = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    category: z.string(),
    aliases: z
      .array(z.string())
      .nullish()
      .transform((aliases) => aliases ?? []),
    release_year: z.number().nullish(),
    latest_version: z.string().nullish(),
    /** llm_seeded | admin_reviewed | published */
    review_status: z.string(),
    source_citation: z.string().nullish(),
    dataset_version: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export type TechnologyWire = z.infer<typeof technologyWire>;

/** `GET /admin/technologies`: at most 500 rows, by name. */
export const technologiesWire = z.object({ data: z.array(technologyWire) });

/** `GET /admin/kb/queue` (`reviewQueue`). */
export const kbQueueWire = z.object({
  /** Names the validator couldn't verify, most-seen first; `seeded` ones have a candidate entry. */
  candidates: z.array(
    z
      .object({
        name: z.string(),
        occurrences: z.number(),
        /** pending | seeded */
        status: z.string(),
        technologyId: z.string().nullish(),
      })
      .passthrough(),
  ),
  /** Users' open reports: what was disputed and why, never who sent them. */
  reports: z.array(
    z
      .object({
        id: z.string(),
        /** validation_flag | claim_dispute */
        kind: z.string(),
        /** A JSON object (`quality_flags.subject`); its keys aren't pinned yet. */
        subject: z.record(z.string(), z.unknown()),
        reason: z.string().nullish(),
        createdAt: z.string(),
      })
      .passthrough(),
  ),
});

export type KbQueueWire = z.infer<typeof kbQueueWire>;

/** `POST /admin/technologies/import`: the slugs imported, and each failed row with its reasons. */
export const kbImportWire = z.object({
  imported: z.array(z.string()),
  failed: z.array(z.object({ row: z.number(), errors: z.array(z.string()) }).passthrough()),
});

// --- Templates and the rubric --------------------------------------------------------------------

/** `GET /admin/templates` (`listTemplates`), by slug. */
export const templatesWire = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        /** Claimed by the design; publishing needs `certified_at` (the Q-06 parse-back pass). */
        ats_safe: z.boolean(),
        certified_at: z.string().nullish(),
        /** draft | published | archived */
        status: z.string(),
        updated_at: z.string(),
      })
      .passthrough(),
  ),
});

export type TemplateWire = z.infer<typeof templatesWire>['data'][number];

/** `rubric_versions.version` is text ("v2"); the portal numbers versions. */
const rubricVersion = z.union([
  z.number().int(),
  z
    .string()
    .regex(/^v?\d+$/i)
    .transform((v) => Number(v.replace(/^v/i, ''))),
]);

/** `GET /admin/rubric` (`listRubric`), newest first. Weights are basis points of the total. */
export const rubricWire = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        version: rubricVersion,
        weights: z.record(z.string(), z.number()),
        rationale: z.string().nullish(),
        evidence: z.string().nullish(),
        is_current: z.boolean(),
        created_at: z.string(),
      })
      .passthrough(),
  ),
});

// --- The portal's Content routes (`routes/adminContent.ts`; toreview §171.13) ---------------------

/** One skill (`services/admin/contentSkills.ts` `toWire`). */
export const skillWire = z
  .object({
    id: z.string(),
    name: z.string(),
    aliases: z.array(z.string()),
    parent: z.string(),
    categoryId: z.string().nullable(),
    /** Distinct people whose typed skills name it. */
    usedIn: z.number(),
    editedAt: z.string(),
    editedBy: z.string().nullable(),
  })
  .passthrough();

export type SkillWire = z.infer<typeof skillWire>;

export const skillPageWire = z.object({
  data: z.array(skillWire),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

/** `GET /admin/skills/overview`. Terms are listed only once two or more people typed them. */
export const skillsOverviewWire = z.object({
  stats: z.object({
    skills: z.number(),
    added30d: z.number(),
    aliases: z.number(),
    perSkill: z.number(),
    merges: z.number(),
    unmapped: z.number(),
  }),
  categories: z.array(z.object({ id: z.string(), name: z.string(), count: z.number() })),
  unmapped: z.array(z.object({ term: z.string(), seenIn: z.number() })),
  merges: z.array(
    z
      .object({
        id: z.string(),
        alias: z.string(),
        target: z.string(),
        seenIn: z.number(),
        firstSeen: z.string(),
      })
      .passthrough(),
  ),
});

/** `GET /admin/templates/usage`: resumes per template, and the template a copy is based on. */
export const templateUsageWire = z.object({
  data: z.array(z.object({ slug: z.string(), inUse: z.number(), basedOn: z.string().nullable() })),
});

/** `GET|PUT /admin/rubric/rationale`: the current version's rationale and its last editor. */
export const rationaleWire = z.object({
  data: z
    .object({
      version: z.string(),
      paragraphs: z.array(z.string()),
      evidence: z.string().nullable(),
      updatedBy: z.string().nullable(),
      updatedAt: z.string().nullable(),
    })
    .nullable(),
});

/** `GET /admin/kb/stats`: exact counts. */
export const kbStatsWire = z.object({ total: z.number(), added30d: z.number(), inReview: z.number() });

const promptWindowWire = z.object({
  evalPassRate: z.number().nullable(),
  evaluations: z.number(),
  costPerResumeUsd: z.number().nullable(),
  resumeRuns: z.number(),
});

/** `GET /admin/prompts/figures`: the last thirty days and the thirty before. */
export const promptFiguresWire = z.object({ current: promptWindowWire, previous: promptWindowWire });
