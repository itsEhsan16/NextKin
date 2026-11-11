'use client';

import {
  RESUME_SECTION_LABEL,
  type AssistantMessage,
  type DocumentContent,
  type Generation,
  type ResumeContent,
  type ResumeSectionKey,
} from '@nextkin/shared/models';
import {
  useAssistantConversation,
  useResumeContent,
  useRewriteSection,
  useSendAssistantMessage,
  useStall,
  useUpdateResumeSection,
} from '@nextkin/shared/queries';
import { useEffect, useId, useRef, useState } from 'react';

import { MessageBubble } from '@/features/assistant/components/MessageBubble';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { Mail01, Send01 } from '@/ui/lineIcons';
import { NavAiAssistantIllustration, SparkleTipIllustration } from '@/ui/illustrations';
import { pressable } from '@/ui/pressable';

import { REWRITE_SECTIONS, sectionLines, sectionOf } from '../tailorLibrary';
import { CoverLetterCard } from './CoverLetterCard';

/** "Try asking", the assistant's own chip style: edits it makes, and questions it answers. */
const SUGGESTIONS: readonly string[] = [
  'Shorten my summary to remove filler words',
  'Use stronger action verbs for my latest experience',
  'Remove skills not related to this job',
  'Why is my ATS score what it is?',
  'What should I improve next for this job?',
];

/** An edit the AI makes to a section ("shorten…", "remove…"), as opposed to a question. */
export const isEditRequest = (text: string) =>
  /^(?:please\s+)?(?:make|rewrite|shorten|remove|add|use|change|improve|fix|cut|reword|tighten|drop|delete|replace|put|trim)\b/i.test(
    text.trim(),
  );

/**
 * An edit turn. `choose`: the words named no section, so the assistant asks which (audit TL-42).
 * `done` carries the section as it was, so the change shows as before/after and can be undone:
 * the rewrite is saved as a new version at once, and Undo saves the old text back as another.
 */
type EditState =
  | { state: 'choose' }
  | { state: 'working' }
  | { state: 'failed' }
  | { state: 'done'; before: DocumentContent | undefined; decided?: 'kept' | 'undone' | 'undoing' };

type Turn = { id: string; question: string } & (
  ({ kind: 'edit'; section?: ResumeSectionKey } & EditState) | { kind: 'ask'; replyId?: string }
);

const local = (
  id: string,
  role: AssistantMessage['role'],
  text: string,
  status: AssistantMessage['status'] = 'complete',
): AssistantMessage => ({
  id,
  role,
  text,
  status,
  // These bubbles never show their time; a fixed one keeps rendering pure.
  createdAt: '1970-01-01T00:00:00.000Z',
});

/**
 * "AI Resume Assistant" on the review (toreview §121, from the owner's mockup, in the assistant's
 * own design): a greeting, "Try asking" chips, Create cover letter, and one box. An edit request
 * rewrites one section from the resume's own lines (`useRewriteSection`); a question goes to the
 * assistant with this resume attached, and its answer shows here, as in the chat.
 */
export function ResumeAssistantPanel({
  generation,
  company,
}: {
  generation: Generation;
  company: string;
}) {
  const resumeId = generation.resumeId ?? '';
  const rewrite = useRewriteSection(resumeId);
  const restore = useUpdateResumeSection(resumeId);
  const content = useResumeContent(resumeId);
  const send = useSendAssistantMessage();
  const conversation = useAssistantConversation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [letterOpen, setLetterOpen] = useState(false);
  const inputId = useId();
  const nextId = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  // A new turn scrolls into view, so the answer is where the user is looking.
  useEffect(() => {
    const node = scroller.current;
    if (node && turns.length > 0) node.scrollTo?.({ top: node.scrollHeight, behavior: 'smooth' });
  }, [turns.length]);
  const busy = rewrite.isPending || send.isPending || restore.isPending;
  // The last question's reply arrives through the conversation; if it never does, say so (§131).
  const last = turns.at(-1);
  const awaiting =
    last?.kind !== 'edit' &&
    last?.replyId != null &&
    last.replyId !== 'failed' &&
    !conversation.data?.messages.some((m) => m.id === last.replyId);
  const stall = useStall(awaiting, last?.id, { slowMs: 20_000, failMs: 60_000 });

  const update = (id: string, patch: Record<string, unknown>) =>
    setTurns((all) => all.map((t) => (t.id === id ? ({ ...t, ...patch } as Turn) : t)));
  const runRewrite = async (id: string, section: ResumeSectionKey, instruction: string) => {
    update(id, { section, state: 'working' });
    // What the section said before, for the before/after and for Undo. Read it first if it
    // hasn't loaded yet: without it the change could not be undone.
    const before = content.data ?? (await content.refetch()).data;
    rewrite.mutate(
      { section, instruction },
      {
        onSuccess: () => update(id, { state: 'done', before }),
        onError: () => update(id, { state: 'failed' }),
      },
    );
  };
  const undo = (turn: Turn) => {
    if (turn.kind !== 'edit' || turn.state !== 'done' || !turn.section) return;
    const before = turn.before;
    if (!before || before.kind !== 'resume') return;
    const section = turn.section;
    update(turn.id, { decided: 'undoing' });
    restore.mutate(
      { section, value: (before as ResumeContent)[section] } as Parameters<
        typeof restore.mutate
      >[0],
      {
        onSuccess: () => update(turn.id, { decided: 'undone' }),
        onError: () => update(turn.id, { decided: undefined }),
      },
    );
  };
  const submit = (text: string) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    const id = `turn-${(nextId.current += 1)}`;
    setDraft('');
    if (isEditRequest(question)) {
      const section = sectionOf(question);
      if (!section) {
        setTurns((all) => [...all, { id, question, kind: 'edit', state: 'choose' }]);
        return;
      }
      setTurns((all) => [...all, { id, question, kind: 'edit', section, state: 'working' }]);
      void runRewrite(id, section, question);
    } else {
      setTurns((all) => [...all, { id, question, kind: 'ask' }]);
      send.mutate(
        { text: question, resumeId },
        {
          onSuccess: ({ reply }) => update(id, { replyId: reply.id }),
          onError: () => update(id, { replyId: 'failed' }),
        },
      );
    }
  };

  const replyOf = (turn: Turn): AssistantMessage => {
    if (turn.kind === 'edit') {
      if (turn.state === 'choose' || !turn.section)
        return local(`${turn.id}-r`, 'assistant', 'Which part should I change?');
      const label = RESUME_SECTION_LABEL[turn.section].toLowerCase();
      // Local turns are never 'streaming': that status makes the bubble fetch a reply by its id.
      if (turn.state === 'working')
        return local(`${turn.id}-r`, 'assistant', `Rewriting your ${label}…`);
      if (turn.state === 'failed')
        return local(
          `${turn.id}-r`,
          'assistant',
          `I couldn’t rewrite your ${label}. Try again, or ask in other words.`,
          'failed',
        );
      if (turn.decided === 'undone')
        return local(`${turn.id}-r`, 'assistant', `Undone: your ${label} is back as it was.`);
      return local(
        `${turn.id}-r`,
        'assistant',
        `I changed your ${label}, using only what your resume already says. Keep it, or undo it.`,
      );
    }
    if (turn.replyId === 'failed')
      return local(
        `${turn.id}-r`,
        'assistant',
        'That didn’t send. Check your connection and try again.',
        'failed',
      );
    const reply = conversation.data?.messages.find((m) => m.id === turn.replyId);
    if (reply) return reply;
    if (conversation.isError || (turn.id === last?.id && stall === 'stalled'))
      return local(
        `${turn.id}-r`,
        'assistant',
        'No reply came back. Check your connection and ask again.',
        'failed',
      );
    return local(
      `${turn.id}-r`,
      'assistant',
      turn.id === last?.id && stall === 'slow' ? 'Still thinking…' : '',
    );
  };

  const chip = cn(
    pressable,
    'flex min-h-8 items-center gap-1.5 rounded-full py-1.5 text-left border border-transparent bg-surface-muted pl-3 pr-3.5 text-body-s font-medium text-text-primary transition-colors duration-fast ease-standard not-disabled:hover:border-border-brand-strong not-disabled:hover:bg-surface-brand disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
  );

  // Laid out to fit the window (owner, toreview §122): the header with Cover letter and the box
  // always show; the suggestions and the conversation scroll between them.
  return (
    <section
      aria-labelledby="resume-assistant"
      className={cn(cardSurface, 'flex flex-col lg:min-h-0 lg:flex-1')}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-5 pb-2 pt-5">
        <NavAiAssistantIllustration aria-hidden className="h-auto w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id="resume-assistant" className="truncate text-body-l font-bold text-text-primary">
            AI Resume Assistant
          </h2>
          <p className="truncate text-caption-m text-text-tertiary">
            Knows this resume and the job
          </p>
        </div>
        <button
          type="button"
          aria-expanded={letterOpen}
          onClick={() => setLetterOpen((v) => !v)}
          className={cn(
            pressable,
            'flex h-control-sm shrink-0 items-center gap-1.5 rounded-full border px-3 text-body-s font-semibold transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            letterOpen
              ? 'border-brand-600 bg-brand-600 text-text-inverse hover:bg-brand-700'
              : 'border-border-brand-strong bg-brand-50 text-text-brand hover:bg-surface-brand-strong',
          )}
        >
          <Mail01 aria-hidden className="size-4 shrink-0" />
          Create cover letter
        </button>
      </div>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 [scrollbar-width:thin]"
      >
        {letterOpen && (
          <CoverLetterCard
            generation={generation}
            company={company}
            onClose={() => setLetterOpen(false)}
          />
        )}
        {turns.length > 0 && (
          <ul aria-label="Conversation" className="flex flex-col gap-3">
            {turns.flatMap((turn) => [
              <MessageBubble key={turn.id} message={local(turn.id, 'user', turn.question)} fresh />,
              <MessageBubble key={`${turn.id}-r`} message={replyOf(turn)} fresh />,
              ...(turn.kind === 'edit' && turn.state === 'choose'
                ? [
                    <li key={`${turn.id}-choose`}>
                      <ul aria-label="Choose a part" className="flex flex-wrap gap-2">
                        {REWRITE_SECTIONS.map((section) => (
                          <li key={section}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runRewrite(turn.id, section, turn.question)}
                              className={chip}
                            >
                              {RESUME_SECTION_LABEL[section]}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>,
                  ]
                : []),
              ...(turn.kind === 'edit' && turn.state === 'done' && turn.section
                ? [
                    <EditReview
                      key={`${turn.id}-diff`}
                      section={turn.section}
                      before={sectionLines(turn.before, turn.section)}
                      after={sectionLines(content.data, turn.section)}
                      decided={turn.decided}
                      canUndo={turn.before?.kind === 'resume' && turn === last}
                      onKeep={() => update(turn.id, { decided: 'kept' })}
                      onUndo={() => undo(turn)}
                    />,
                  ]
                : []),
            ])}
          </ul>
        )}
        {/* "Try asking" in full (owner, toreview §123): first thing in the panel, then under the
            conversation once it has started. */}
        <section aria-labelledby="review-try-asking" className="flex flex-col gap-2">
          <h3
            id="review-try-asking"
            className="flex items-center gap-2 text-caption-m font-semibold uppercase tracking-wide text-text-tertiary"
          >
            <SparkleTipIllustration aria-hidden className="h-auto w-4" />
            Try asking
          </h3>
          <ul className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(prompt)}
                  className={chip}
                >
                  <SparkleTipIllustration aria-hidden className="h-auto w-3 shrink-0" />
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-5 pb-5 pt-1">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          className="flex items-end gap-2 rounded-full border border-border-default bg-neutral-50/60 py-1.5 pl-3 pr-1.5 transition-[background-color,border-color,box-shadow] duration-base ease-standard focus-within:border-border-selected focus-within:bg-surface-card focus-within:ring-4 focus-within:ring-brand-100"
        >
          <label htmlFor={inputId} className="sr-only">
            Ask anything about your resume
          </label>
          <textarea
            id={inputId}
            rows={1}
            maxLength={300}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(draft);
              }
            }}
            placeholder="Ask anything about your resume…"
            className="max-h-24 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-body-m text-text-primary outline-none [field-sizing:content] placeholder:text-text-tertiary"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={busy || draft.trim().length < 3}
            className={cn(
              pressable,
              'flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-text-inverse hover:bg-brand-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            )}
          >
            <Send01 aria-hidden className="size-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

/**
 * The before/after of one AI rewrite, with Keep and Undo (audit TL-42, V2 §7.6: a change is a
 * new version, never a silent overwrite). Only the latest change can be undone: an older one
 * would put back text a later change already built on.
 */
function EditReview({
  section,
  before,
  after,
  decided,
  canUndo,
  onKeep,
  onUndo,
}: {
  section: ResumeSectionKey;
  before: string[];
  after: string[];
  decided?: 'kept' | 'undone' | 'undoing';
  canUndo: boolean;
  onKeep: () => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (decided === 'undone') return null;
  const label = RESUME_SECTION_LABEL[section];
  return (
    <li className="rounded-md border border-border-default bg-surface-card p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-sm text-left text-body-s font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        What changed in {label}
        <span className="text-caption-m font-medium text-text-tertiary">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className="mt-2 grid gap-2 text-body-s">
          <div>
            <p className="text-caption-m font-semibold uppercase tracking-wide text-text-tertiary">
              Before
            </p>
            <div className="mt-1 max-h-32 overflow-y-auto rounded-sm bg-danger-50/60 px-2 py-1.5 text-text-secondary line-through decoration-text-tertiary/60">
              {before.length ? before.map((line, i) => <p key={i}>{line}</p>) : <p>(empty)</p>}
            </div>
          </div>
          <div>
            <p className="text-caption-m font-semibold uppercase tracking-wide text-text-tertiary">
              After
            </p>
            <div className="mt-1 max-h-32 overflow-y-auto rounded-sm bg-success-surface px-2 py-1.5 text-text-primary">
              {after.length ? after.map((line, i) => <p key={i}>{line}</p>) : <p>(empty)</p>}
            </div>
          </div>
        </div>
      )}
      {decided === 'kept' ? (
        <p className="mt-2 text-caption-m font-medium text-success-text">Kept.</p>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            disabled={decided === 'undoing'}
            className={cn(
              pressable,
              'h-8 rounded-full bg-brand-600 px-3.5 text-body-s font-semibold text-text-inverse hover:bg-brand-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            )}
          >
            Keep
          </button>
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={decided === 'undoing'}
              className={cn(
                pressable,
                'h-8 rounded-full border border-border-default bg-surface-card px-3.5 text-body-s font-semibold text-text-primary hover:bg-surface-muted disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              {decided === 'undoing' ? 'Undoing…' : 'Undo'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
