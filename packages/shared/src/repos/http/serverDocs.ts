import type { AdoptedDocument } from '../adopt';
import type { HttpClient } from './client';

/**
 * A server document as the mock library files it: the card, the body and the score panel if any.
 * Used to bridge a flow that stays on the mock (tailoring, a comparison) onto a server document.
 */
export async function fetchDocument(http: HttpClient, id: string): Promise<AdoptedDocument> {
  const [resume, content, score] = await Promise.all([
    http.request(`/resumes/${id}`),
    http.request(`/resumes/${id}/content`),
    http.request(`/resumes/${id}/score`).catch(() => undefined),
  ]);
  return { resume, content, ...(score ? { score } : {}) } as unknown as AdoptedDocument;
}
