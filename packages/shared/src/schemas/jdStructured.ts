import { z } from 'zod';

/**
 * The structured reading over the wire (toreview §153), checked on both sides: the server validates
 * what it built before storing it, and the client validates what it reads.
 */

const quote = z.object({
  text: z.string().max(2000),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
const status = z.enum(['stated', 'interpreted', 'unclear']);
const fact = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, quotes: z.array(quote).max(12), status });
const text = fact(z.string().min(1).max(600));
const importance = z.enum(['required', 'preferred']);
const amount = z.number().finite().nonnegative();

const pay = z
  .object({
    component: z.enum(['base', 'fixed', 'variable', 'incentive', 'bonus', 'total', 'unknown']),
    min: amount.optional(),
    max: amount.optional(),
    currency: z.string().max(8).optional(),
    period: z.enum(['hour', 'day', 'week', 'month', 'year']).optional(),
  })
  .refine((p) => p.min === undefined || p.max === undefined || p.min <= p.max, 'min ≤ max');

const years = fact(z.number().finite().min(0).max(50));

export const jdStructuredSchema = z
  .object({
    schemaVersion: z.literal(2),
    identity: z.object({
      title: text.optional(),
      company: text.optional(),
      department: text.optional(),
      industry: text.optional(),
      employmentType: fact(
        z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']),
      ).optional(),
      seniority: fact(z.enum(['entry', 'mid', 'senior', 'lead'])).optional(),
      openings: fact(z.number().int().min(1).max(10000)).optional(),
      referenceId: text.optional(),
    }),
    summary: z.string().max(600).optional(),
    locations: z
      .array(
        fact(
          z.object({
            label: z.string().max(300),
            city: z.string().max(120).optional(),
            region: z.string().max(120).optional(),
            country: z.string().max(120).optional(),
          }),
        ),
      )
      .max(20),
    workMode: fact(z.enum(['onsite', 'remote', 'hybrid', 'field', 'flexible'])).optional(),
    schedule: z
      .array(
        text.extend({
          kind: z.enum([
            'days',
            'hours',
            'shift',
            'weekends',
            'overtime',
            'travel',
            'joining',
            'other',
          ]),
          daysPerWeek: z.number().int().min(1).max(7).optional(),
        }),
      )
      .max(20),
    compensation: z.object({
      statements: z.array(fact(pay)).max(10),
      range: fact(pay).optional(),
      negotiable: fact(z.boolean()).optional(),
    }),
    experience: z
      .object({
        minYears: years.optional(),
        maxYears: years.optional(),
        freshersOk: fact(z.boolean()).optional(),
        lines: z.array(text).max(20),
      })
      .refine(
        (e) => !e.minYears || !e.maxYears || e.minYears.value <= e.maxYears.value,
        'min ≤ max years',
      ),
    responsibilities: z.array(text.extend({ group: z.string().max(80).optional() })).max(60),
    skills: z
      .array(
        text.extend({
          category: z.enum([
            'language',
            'framework',
            'database',
            'cloud',
            'tool',
            'api',
            'domain',
            'soft',
            'other',
          ]),
          importance,
        }),
      )
      .max(80),
    education: z.array(text.extend({ importance })).max(20),
    languages: z
      .array(
        text.extend({
          importance,
          level: z.enum(['basic', 'intermediate', 'advanced', 'fluent', 'native']).optional(),
        }),
      )
      .max(10),
    benefits: z.array(text).max(40),
    eligibility: z
      .array(
        text.extend({
          kind: z.enum([
            'age',
            'work_authorization',
            'location',
            'gender',
            'background_check',
            'other',
          ]),
          sensitive: z.boolean(),
        }),
      )
      .max(20),
    company: z.object({ about: z.array(text).max(20), website: text.optional() }),
    application: z
      .array(
        text.extend({
          kind: z.enum(['method', 'url', 'email', 'deadline', 'documents', 'process']),
        }),
      )
      .max(20),
    extras: z.array(text).max(40),
    issues: z
      .array(
        z.object({
          kind: z.enum(['conflict', 'ambiguous', 'sensitive', 'expired']),
          field: z.string().max(40),
          note: z.string().max(500),
          quotes: z.array(quote).max(12),
          by: z.enum(['rules', 'model']),
        }),
      )
      .max(30),
    stats: z.object({
      kept: z.number().int().nonnegative(),
      dropped: z.number().int().nonnegative(),
      merged: z.number().int().nonnegative(),
    }),
  })
  .strict();
