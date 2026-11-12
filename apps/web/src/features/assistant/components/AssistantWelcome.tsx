import Image from 'next/image';

import { cn } from '@/lib/cn';
import { PlusIcon } from '@/ui/icons';
import { pressableLift } from '@/ui/pressable';

import { STARTERS } from '../assistantLibrary';
import { PromptChips } from './PromptChips';

/**
 * An empty chat (768:3): the robot at its laptop, the greeting, the four topics and "Try asking".
 * A topic starts a question in the composer; a prompt asks its question outright.
 */
export function AssistantWelcome({
  firstName,
  onStart,
  onAsk,
  busy,
}: {
  firstName: string | undefined;
  onStart: (draft: string) => void;
  onAsk: (prompt: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col items-center text-center">
      {/* "Illustration (from mobile ASSISTANT 02)", a raster on the board. */}
      <Image
        loading="eager"
        src="/illustrations/v2/assistant-welcome.webp"
        alt=""
        width={558}
        height={560}
        className="h-[120px] w-[160px] object-contain [@media(max-height:860px)]:h-[72px] [@media(max-height:860px)]:w-[96px]"
      />
      <h2 className="mt-3 text-hero text-text-primary">
        {firstName ? `Hi ${firstName}, how can I help?` : 'How can I help?'}
      </h2>
      <p className="mt-2 max-w-[560px] text-body-l text-text-secondary">
        Ask about your job search, resumes, ATS scores and interviews. I advise — I never change
        your documents.
      </p>

      <ul
        aria-label="Topics"
        className="mt-6 [@media(max-height:860px)]:mt-4 grid w-full max-w-[560px] grid-cols-2 gap-3.5"
      >
        {STARTERS.map(({ key, label, draft, Art }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onStart(draft)}
              className={cn(
                pressableLift,
                'group flex h-16 w-full [@media(max-height:860px)]:h-14 items-center gap-3 rounded-xl border border-border-default bg-surface-card pl-2.5 pr-3 text-left shadow-card',
                'hover:border-border-brand-strong hover:shadow-popover',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center">
                <Art className="h-auto max-h-11 w-11" />
              </span>
              <span className="min-w-0 flex-1 text-title-l font-semibold text-text-primary">
                {label}
              </span>
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-default text-text-secondary transition-colors duration-press ease-standard group-hover:border-border-brand-strong group-hover:text-text-brand"
              >
                <PlusIcon className="size-3" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 w-full [@media(max-height:860px)]:mt-4">
        <PromptChips onAsk={onAsk} disabled={busy} align="center" />
      </div>
    </div>
  );
}
