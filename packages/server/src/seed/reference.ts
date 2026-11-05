import { sql } from 'kysely';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { PRICES_DEFAULT, ROUTING_DEFAULT } from '../ai/defaults';
import type { Database } from '../db/database';
import { PRICES_KEY, ROUTING_KEY } from '../ai/routing';
import { seedPrompts } from './prompts';
import { stableId } from './ids';

/**
 * Global reference data: plans, the current rubric, dataset versions, default settings. Written
 * through an admin session on the app role, the same path the Admin Portal will use (P12).
 */

/** Display names for the engines' skill categories, as the skills editor lists them. */
const SKILL_CATEGORY_NAMES: Record<string, string> = {
  language: 'Languages',
  framework: 'Frameworks',
  library: 'Libraries',
  database: 'Databases',
  cloud: 'Cloud',
  devops: 'DevOps',
  tool: 'Tools',
  methodology: 'Methodologies',
  practice: 'Practices',
  design: 'Design',
  domain: 'Domain skills',
};

/** The seed's admin identity; also seeded as a real user by seedAccounts. */
export const SEED_ADMIN_ID = stableId('account:admin');

/** The rubric new reports are scored under (engines `CURRENT_RUBRIC_ID`, `rubric-2`). */
export const CURRENT_RUBRIC_VERSION_ID = stableId('rubric:v2');

// Spec §13.2 indicative prices, in minor units. The mock's INR prices stay in the mock; the
// currency question is backend plan §4.6 conflict 2 (toreview §105).
const PLANS = [
  {
    id: 'free',
    tier: 'free',
    name: 'NextKin Free',
    period: null,
    prices: {},
    // §13.3. Interview sets are per generated resume; saved jobs and versions are caps, not meters.
    quotas: { generation: 3, ats_check: 3, cover_letter: 1, zero_resume: 1, interview_set_per_resume: 1, assistant_message_daily: 20, saved_jobs: 10, versions_visible: 3, docx: false },
  },
  {
    id: 'pro_monthly',
    tier: 'pro',
    name: 'NextKin Pro',
    period: 'month',
    prices: { USD: 1900, EUR: 1900, AUD: 2900 },
    quotas: { generation: 100, ats_check: 30, cover_letter: null, zero_resume: null, interview_set_per_resume: null, assistant_message_daily: 100, saved_jobs: null, versions_visible: 20, docx: true, priority_queue: true },
  },
  {
    id: 'pro_annual',
    tier: 'pro',
    name: 'NextKin Pro (annual)',
    period: 'year',
    // toreview §105.19: the midpoints of §13.2's annual bands.
    prices: { USD: 10900, EUR: 10900, AUD: 16500 },
    quotas: { generation: 100, ats_check: 30, cover_letter: null, zero_resume: null, interview_set_per_resume: null, assistant_message_daily: 100, saved_jobs: null, versions_visible: 20, docx: true, priority_queue: true },
  },
] as const;

export async function seedReference(db: Database): Promise<{ rubricVersionId: string }> {
  return db.withUser({ userId: SEED_ADMIN_ID, role: 'admin' }, async (tx) => {
    for (const plan of PLANS) {
      await tx
        .insertInto('plans')
        .values({ id: plan.id, tier: plan.tier, name: plan.name, period: plan.period, prices: JSON.stringify(plan.prices), quotas: JSON.stringify(plan.quotas) })
        .onConflict((oc) => oc.column('id').doUpdateSet({ name: plan.name, prices: JSON.stringify(plan.prices), quotas: JSON.stringify(plan.quotas) }))
        .execute();
    }
    // The price book's first version is the seeded Pro prices (migration 0054); staff add the next.
    const priceOf = (id: string) => JSON.stringify(PLANS.find((plan) => plan.id === id)?.prices ?? {});
    await tx.insertInto('price_book_versions').values({ version: 1, monthly: priceOf('pro_monthly'), annual: priceOf('pro_annual') }).onConflict((oc) => oc.column('version').doNothing()).execute();

    await tx.insertInto('kb_dataset_versions').values({ version: 1, notes: 'Seed dataset (empty until M2-11).' }).onConflict((oc) => oc.doNothing()).execute();
    await tx.insertInto('taxonomy_versions').values({ version: 1, notes: 'Seed taxonomy (empty until Q-02).' }).onConflict((oc) => oc.doNothing()).execute();

    // The skills editor's reviewed copy starts as the engines' compiled taxonomy (toreview §171.13).
    // Insert-only: a staff edit is never overwritten by a re-seed, and live scoring keeps reading the
    // compiled taxonomy until a release imports the reviewed copy.
    for (const category of [...new Set(TAXONOMY.skills.map((skill) => skill.category))]) {
      const name = SKILL_CATEGORY_NAMES[category] ?? category;
      await tx.insertInto('skill_categories').values({ id: category, name }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const skill of TAXONOMY.skills) {
      await tx
        .insertInto('skills')
        .values({ canonical_name: skill.name, aliases: [...skill.aliases], category_id: skill.category })
        .onConflict((oc) => oc.column('canonical_name').doNothing())
        .execute();
    }

    // Rubric v1: spec §7.8's weights (keywords 40, timeline 20, sections 15, formatting 15,
    // achievements 10) and the bands the apps use (strong ≥ 85, good ≥ 70, fair ≥ 55, weak below).
    const rubricVersionId = stableId('rubric:v1');
    await tx
      .insertInto('rubric_versions')
      .values({
        id: rubricVersionId,
        version: 'v1',
        weights: JSON.stringify({ keywords: 4000, timeline: 2000, sections: 1500, formatting: 1500, achievements: 1000 }),
        bands: JSON.stringify({ strong: 8500, good: 7000, fair: 5500 }),
        definitions: JSON.stringify({ keywordCredit: 'D-14 evidence tiers', noTotalWithoutJd: 'D-15' }),
        rationale: 'Spec §7.8 published weights. Calibration evidence arrives with Q-10.',
        is_current: false,
      })
      .onConflict((oc) => oc.column('version').doNothing())
      .execute();

    // Rubric v2 (engines `rubric-2`, toreview §129): v1's weights, bands and credit; a JD's years ask
    // is measured against at most the technology's age. It is the current method.
    await tx.updateTable('rubric_versions').set({ is_current: false }).where('version', '!=', 'v2').execute();
    await tx
      .insertInto('rubric_versions')
      .values({
        id: CURRENT_RUBRIC_VERSION_ID,
        version: 'v2',
        weights: JSON.stringify({ keywords: 4000, timeline: 2000, sections: 1500, formatting: 1500, achievements: 1000 }),
        bands: JSON.stringify({ strong: 8500, good: 7000, fair: 5500 }),
        definitions: JSON.stringify({ keywordCredit: 'D-14 evidence tiers', noTotalWithoutJd: 'D-15', yearsCappedAtTechAge: true }),
        rationale: 'v1 unchanged in weights, bands and credit. A JD asking more years of a technology than it has existed is measured against that ceiling.',
        is_current: true,
      })
      .onConflict((oc) => oc.column('version').doUpdateSet({ is_current: true }))
      .execute();

    // Kill switches and feature flags (P3-11). Everything on by default.
    const settings: Record<string, unknown> = {
      'features.assistant.enabled': true,
      'features.teaser.enabled': true,
      'features.job_search.enabled': true,
      'clients.minimum_version': { web: '0.0.0', ios: '0.0.0', android: '0.0.0' },
      [ROUTING_KEY]: ROUTING_DEFAULT,
      [PRICES_KEY]: PRICES_DEFAULT,
    };
    for (const [key, value] of Object.entries(settings)) {
      await tx
        .insertInto('app_settings')
        .values({ key, value: JSON.stringify(value), updated_by: SEED_ADMIN_ID, updated_at: sql<Date>`now()` })
        // A versioned setting (routing, prices) is replaced when the seed carries a newer version;
        // anything else, and a same-version setting changed locally, is left alone.
        .onConflict((oc) =>
          oc
            .column('key')
            .doUpdateSet({ value: sql`excluded.value`, updated_at: sql<Date>`now()` })
            .where(sql<boolean>`coalesce((app_settings.value->>'version')::int, 0) < coalesce((excluded.value->>'version')::int, 0)`),
        )
        .execute();
    }
    // Job providers (P11-01): the local fixture catalogue on; the real providers off until X-12
    // gives them keys. An admin's later change is left alone.
    for (const p of [
      { provider: 'fixture', enabled: true, priority: 10, limits: {} },
      { provider: 'adzuna', enabled: false, priority: 20, limits: { dailyCalls: 250 } },
      { provider: 'jsearch', enabled: false, priority: 30, limits: {} },
    ]) {
      await tx
        .insertInto('job_provider_configs')
        .values({ provider: p.provider, enabled: p.enabled, priority: p.priority, limits: JSON.stringify(p.limits) })
        .onConflict((oc) => oc.column('provider').doNothing())
        .execute();
    }
    await seedPrompts(tx);
    return { rubricVersionId: CURRENT_RUBRIC_VERSION_ID };
  });
}
