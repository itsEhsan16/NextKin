import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { repos } from '../repos';

import { qk } from './keys';

/**
 * AI consent (ImBackendImplementationPlan P12-12): whether the user agreed to the current AI
 * provider list, and recording that they did. The consent dialog both apps show before the first
 * AI action reads and writes it; an AI call refused with `ConsentRequiredError` opens that dialog.
 */
export function useAiConsent() {
  return useQuery({ queryKey: qk.user.aiConsent(), queryFn: () => repos.user.getAiConsent() });
}

export function useGrantAiConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: string) => repos.user.grantAiConsent(version),
    onSuccess: (consent) => queryClient.setQueryData(qk.user.aiConsent(), consent),
  });
}
