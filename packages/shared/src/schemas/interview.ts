import { z } from 'zod';

import type { InterviewSet } from '../models/interview';

/** Interview practice sets on the wire (ImBackendImplementationPlan P11-08; V2 §7.15). */

export const interviewMarkSchema = z.enum(['unmarked', 'confident', 'needs_work']);

export const interviewQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(['behavioural', 'technical']),
  prompt: z.string().min(1).max(1000),
  answer: z.string().max(4000),
  talkingPoints: z.array(z.string().max(600)).max(8),
  skill: z.string().max(120).optional(),
  mark: interviewMarkSchema,
});

export const interviewSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.enum(['resume', 'standalone']),
  resumeId: z.string().optional(),
  jdId: z.string().optional(),
  jobId: z.string().optional(),
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  generationId: z.string().optional(),
  regeneratedFromId: z.string().optional(),
  questions: z.array(interviewQuestionSchema).max(40),
  createdAt: z.string(),
});

export const interviewSetListSchema = z.object({ data: z.array(interviewSetSchema) });
export const interviewSetOrNullSchema = z.object({ set: interviewSetSchema.nullable() });
export const interviewMarkBodySchema = z.object({ mark: interviewMarkSchema }).strict();

type _SetMatches = z.infer<typeof interviewSetSchema> extends InterviewSet ? true : never;
export const INTERVIEW_SET_SHAPE_MATCHES: _SetMatches = true;
