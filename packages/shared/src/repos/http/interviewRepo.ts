import type { InterviewSet } from '../../models/interview';
import { interviewSetListSchema, interviewSetOrNullSchema, interviewSetSchema } from '../../schemas/interview';
import type { InterviewRepo } from '../types';
import type { HttpClient } from './client';
import { isServerId } from './jdRepo';

/**
 * `InterviewRepo` over `/api/v1/interview/question-sets` (ImBackendImplementationPlan P11-08). Every
 * method is served. A set keeps the id space its run started in: a set the server wrote has a UUID,
 * and one the mock wrote (a run from a document only the mock has) stays in the mock store and is
 * read, marked and deleted there; the list shows both, newest first.
 */
const set = (data: unknown) => interviewSetSchema.parse(data) as InterviewSet;
const BASE = '/interview/question-sets';

export function createHttpInterviewRepo(http: HttpClient, mock: InterviewRepo): InterviewRepo {
  return {
    async list() {
      const server = interviewSetListSchema.parse(await http.request(BASE)).data as InterviewSet[];
      // The mock's own runs only: its seeded examples are the server's now (seed/personas.ts).
      const local = (await mock.list()).filter((s) => s.generationId && !isServerId(s.generationId));
      return [...server, ...local].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    get: async (id) => (isServerId(id) ? set(await http.request(`${BASE}/${id}`)) : mock.get(id)),
    async getByGeneration(generationId) {
      if (!isServerId(generationId)) return mock.getByGeneration(generationId);
      return interviewSetOrNullSchema.parse(await http.request(`${BASE}/by-generation/${generationId}`)).set as InterviewSet | null;
    },
    markQuestion: async (setId, questionId, mark) =>
      isServerId(setId) ? set(await http.request(`${BASE}/${setId}/questions/${encodeURIComponent(questionId)}/mark`, { method: 'PUT', body: { mark } })) : mock.markQuestion(setId, questionId, mark),
    resetMarks: async (setId) => (isServerId(setId) ? set(await http.request(`${BASE}/${setId}/reset`, { method: 'POST' })) : mock.resetMarks(setId)),
    async remove(id) {
      if (!isServerId(id)) return mock.remove(id);
      await http.request(`${BASE}/${id}`, { method: 'DELETE' });
    },
  };
}
