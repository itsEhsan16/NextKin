import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { AssistantConversation, AssistantMessage, AssistantThreadSummary } from '../models';
import { repos, type AssistantSendInput } from '../repos';

import { qk } from './keys';

/**
 * NextKin V2 spec §7.16 — the assistant, and how a reply streams into the screen without
 * re-rendering the transcript.
 *
 * Two keys. `conversation` holds the message list; `message(id)` holds the ONE reply in flight.
 * The ticker writes only the second, one component subscribes to it, and the finished text lands
 * in the list exactly once, at the end — ~200 token writes re-render one leaf and the list once.
 * That is what the plan's "streaming appends without list jumps" bar comes down to.
 */

export function useAssistantConversation() {
  return useQuery({
    queryKey: qk.assistant.conversation(),
    queryFn: () => repos.assistant.getConversation(),
  });
}

/**
 * Sends a turn. Write-through: the repo hands back both messages, and they are appended to the
 * conversation cache the moment they arrive so the user's bubble shows without a refetch and the
 * reply's shell is on screen for the stream to fill. The subscription invalidation is the §13.3
 * meter: a refusal counts as a message, so it moves either way.
 */
export function useSendAssistantMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssistantSendInput) => repos.assistant.send(input),
    onSuccess: ({ user, reply }) => {
      queryClient.setQueryData<AssistantConversation>(qk.assistant.conversation(), (old) =>
        old
          ? {
              ...old,
              updatedAt: reply.createdAt,
              messages: [...old.messages, user, reply],
            }
          : old,
      );
      queryClient.setQueryData(qk.assistant.message(reply.id), reply);
      void queryClient.invalidateQueries({ queryKey: qk.user.subscription() });
      void queryClient.invalidateQueries({ queryKey: qk.assistant.threads() });
    },
  });
}

/**
 * The reply as it grows. Subscribes while the message is streaming and writes each tick into
 * its OWN key; on the terminal tick it writes the finished message into the conversation once,
 * so every other bubble — a `memo` over an immutable object — never re-renders for a token.
 *
 * Like the generation ticker, the stream only advances while something is subscribed: leaving
 * the screen mid-reply pauses it, coming back resumes it.
 */
export function useAssistantReply(messageId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.assistant.message(messageId),
    queryFn: async () => {
      const conversation = await repos.assistant.getConversation();
      const message = conversation.messages.find((item) => item.id === messageId);
      if (!message) throw new Error(`Message ${messageId} not found`);
      return message;
    },
    enabled: messageId.length > 0,
  });

  const liveId = query.data?.status === 'streaming' ? query.data.id : null;

  useEffect(() => {
    if (!liveId) return undefined;
    return repos.assistant.subscribe(liveId, (message) => {
      queryClient.setQueryData(qk.assistant.message(liveId), message);
      if (message.status !== 'streaming') {
        queryClient.setQueryData<AssistantConversation>(qk.assistant.conversation(), (old) =>
          old
            ? {
                ...old,
                updatedAt: message.createdAt,
                messages: old.messages.map((item) => (item.id === message.id ? message : item)),
              }
            : old,
        );
        // The History previews a chat's first answer, which has only now arrived.
        void queryClient.invalidateQueries({ queryKey: qk.assistant.threads() });
      }
    });
  }, [liveId, queryClient]);

  return query;
}

/** Clears the thread. The only destructive verb, and it touches nothing but the conversation. */
export function useClearAssistant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.assistant.clear(),
    onSuccess: (conversation) => {
      queryClient.setQueryData(qk.assistant.conversation(), conversation);
      queryClient.removeQueries({ queryKey: qk.assistant.messages() });
      void queryClient.invalidateQueries({ queryKey: qk.assistant.threads() });
    },
  });
}

/** The reply's row model, shared by the bubble that streams and the one that does not. */
export type AssistantReplyState = Pick<AssistantMessage, 'status' | 'refusal'>;

/** The web History (767:2): the current chat and the earlier ones, newest first. */
export function useAssistantThreads() {
  return useQuery({
    queryKey: qk.assistant.threads(),
    queryFn: () => repos.assistant.listThreads(),
  });
}

/** Reopens an earlier chat from the History. */
export function useOpenAssistantThread() {
  const queryClient = useQueryClient();
  const queryKey = qk.assistant.threads();
  return useMutation({
    mutationFn: (id: string) => repos.assistant.openThread(id),
    // The row lights up on the click, not after the round trip.
    onMutate: (id) => {
      queryClient.setQueryData<AssistantThreadSummary[]>(queryKey, (old) =>
        old?.map((row) => ({ ...row, current: row.id === id })),
      );
    },
    onSuccess: (conversation) => {
      queryClient.setQueryData(qk.assistant.conversation(), conversation);
      queryClient.removeQueries({ queryKey: qk.assistant.messages() });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });
}

/** "New chat": files the current one in the History and opens an empty one. */
export function useStartAssistantChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.assistant.startNew(),
    onSuccess: (conversation) => {
      queryClient.setQueryData(qk.assistant.conversation(), conversation);
      queryClient.removeQueries({ queryKey: qk.assistant.messages() });
      void queryClient.invalidateQueries({ queryKey: qk.assistant.threads() });
    },
  });
}
