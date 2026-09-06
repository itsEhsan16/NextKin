import { newId, simulate } from '@/data/mock';
import type { FaqItem, LegalDoc, LegalDocKey, SupportTicket, TicketInput } from '@/data/models';

import { clone, type MockStore, NotFoundError } from './state';
import type { SupportRepo } from './types';

/**
 * NextKin V2 spec §7.14 (help and contact) and §8.5 (the legal documents) — the read-only help
 * content, plus the one thing this corner of the app writes.
 *
 * The FAQ and the legal documents are reference data: the mock returns the fixtures, and the real
 * API will return the same shapes from a CMS. Searching and filtering the FAQ is deliberately NOT
 * done here — the list is a dozen entries, the screen already holds the query and the topic, and a
 * round trip per keystroke would be a worse product for no gain. `listFaq` hands over the lot.
 */
export function createMockSupportRepo(store: MockStore): SupportRepo {
  return {
    listFaq: () =>
      simulate<FaqItem[]>(() => clone(store.state.faq), {
        // Empty mode means "no help content", which the screen renders as its own state rather
        // than as a failure — the same contract every other list in the app has.
        empty: () => [],
      }),

    getLegal: (key: LegalDocKey) =>
      simulate<LegalDoc>(() => {
        const doc: LegalDoc | undefined = store.state.legal[key];
        if (!doc) throw new NotFoundError('LegalDoc', key);
        return clone(doc);
      }),

    submitTicket: (input: TicketInput) =>
      simulate<SupportTicket>(() => {
        const ticket: SupportTicket = {
          id: newId('tkt'),
          topic: input.topic,
          message: input.message.trim(),
          // The account address, not one the form asked for: §7.14 replies to the account, and a
          // second address on the form would be one more thing to get wrong.
          email: store.state.user.email,
          createdAt: new Date().toISOString(),
        };
        store.state.tickets = [ticket, ...store.state.tickets];
        return clone(ticket);
      }),
  };
}
