import { useMutation, useQuery } from '@tanstack/react-query';

import type { LegalDocKey, TicketInput } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * Help and contact (the Support rows on Figma PROFILE 02; the spec has no help section) and the
 * legal documents (V2 §8.5).
 *
 * The FAQ and the two documents are reference content: they do not change while the app is open,
 * so both are plain queries with no invalidation anywhere. Sending a message is the only write,
 * and it invalidates nothing either — the mock has no inbox to refresh, and the real API will not
 * change anything the app is showing.
 */

/** The whole FAQ; the help screen searches and filters it in memory. */
export function useFaq() {
  return useQuery({
    queryKey: qk.support.faq(),
    queryFn: () => repos.support.listFaq(),
  });
}

/** One legal document, with the "last updated" stamp §8.5 asks it to carry. */
export function useLegal(doc: LegalDocKey) {
  return useQuery({
    queryKey: qk.support.legal(doc),
    queryFn: () => repos.support.getLegal(doc),
  });
}

/**
 * Sends a support message. Not optimistic: there is nothing on screen to update
 * ahead of the server, and a message that quietly failed after showing "Sent" would be the one
 * failure a support form must never have.
 */
export function useSubmitTicket() {
  return useMutation({
    mutationFn: (input: TicketInput) => repos.support.submitTicket(input),
  });
}
