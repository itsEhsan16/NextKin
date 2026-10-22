'use client';

import type { AssistantMessage } from '@nextkin/shared/models';
import { Fragment, useEffect, useRef, useState } from 'react';

import { formatDayLabel as dayLabel } from '@/lib/format';
import { MessageBubble } from './MessageBubble';

/** How close to the foot counts as "reading the latest", so a reply growing below is followed. */
const FOLLOW_SLACK = 160;

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The conversation (769:457) under its day dividers (769:583), held to the foot of the canvas the
 * way the board sets it.
 *
 * It follows the newest turn (`toreview.md` §102): whenever the list grows — a turn arriving, or a
 * reply streaming in token by token — the chat scrolls with it, gliding unless reduced motion is
 * asked for. Only while the reader is already at the foot, though: someone who has scrolled up to
 * re-read an answer is left where they are. Turns that arrive after the chat opened pop in; the
 * ones it opened with are simply there.
 */
export function Transcript({ messages }: { messages: AssistantMessage[] }) {
  const list = useRef<HTMLOListElement>(null);
  const [openedWith] = useState(() => new Set(messages.map((message) => message.id)));

  useEffect(() => {
    const node = list.current;
    const scroller = node?.closest<HTMLElement>('[data-chat-scroller]');
    if (!node || !scroller) return undefined;

    // Opening a chat lands on its latest turn at once.
    scroller.scrollTop = scroller.scrollHeight;
    let lastHeight = node.offsetHeight;

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const grew = node.offsetHeight - lastHeight;
      lastHeight = node.offsetHeight;
      if (grew <= 0) return;
      const fromFoot = scroller.scrollHeight - grew - scroller.scrollTop - scroller.clientHeight;
      if (fromFoot > FOLLOW_SLACK) return;
      scroller.scrollTo({
        top: scroller.scrollHeight,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <ol ref={list} aria-label="Conversation" className="flex flex-col gap-4">
      {messages.map((message, index) => {
        const label = dayLabel(message.createdAt);
        const previous = messages[index - 1];
        const newDay = !previous || dayLabel(previous.createdAt) !== label;
        return (
          <Fragment key={message.id}>
            {newDay && (
              <li aria-hidden className="flex justify-center">
                <span className="rounded-full bg-surface-muted px-3 py-1 text-caption-m text-text-tertiary">
                  {label}
                </span>
              </li>
            )}
            <MessageBubble message={message} fresh={!openedWith.has(message.id)} />
          </Fragment>
        );
      })}
    </ol>
  );
}
