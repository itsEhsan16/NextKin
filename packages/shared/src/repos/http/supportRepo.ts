import type { FaqItem, LegalDoc, SupportTicket } from '../../models/support';
import type { SupportRepo } from '../types';
import type { HttpClient } from './client';

/**
 * `SupportRepo` over `/api/v1/support` (ImBackendImplementationPlan P12-13). The FAQ and the legal
 * documents are the published content versions; a ticket is emailed to the support inbox with the
 * request id, so a reply can find the request.
 */
export function createHttpSupportRepo(http: HttpClient): SupportRepo {
  return {
    listFaq: async () => ((await http.request('/support/faq')) as { data: FaqItem[] }).data,
    getLegal: async (doc) => (await http.request(`/support/legal/${doc}`)) as LegalDoc,
    submitTicket: async (input) => (await http.request('/support/tickets', { body: input })) as SupportTicket,
  };
}
