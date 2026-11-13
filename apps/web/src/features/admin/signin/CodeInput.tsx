'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

export const CODE_LENGTH = 6;

/** Every box filled with a digit. */
export const isComplete = (code: string) => /^\d{6}$/.test(code);

export type CodeInputProps = {
  /** Six positions, a space for an empty box: "472   ". `codeOf` reads the digits out. */
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are in, typed or pasted. */
  onComplete: (code: string) => void;
  invalid?: boolean;
  /** A code is being checked: the boxes hold still (read-only) but keep focus. */
  busy?: boolean;
  /** Changing it moves focus back to the first box, after a refused code. */
  focusKey?: number;
};

/**
 * The authenticator code (Figma 410:1659): six 48×56 boxes in two threes with a dash between, the
 * box in focus ringed in indigo with only the caret, an empty one showing a pale 0. Typing moves on, Backspace moves
 * back, and pasting a whole code fills every box. The browser can offer the code it received
 * (`one-time-code`).
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid,
  busy,
  focusKey = 0,
}: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const firstKey = useRef(focusKey);
  useEffect(() => {
    if (focusKey !== firstKey.current) refs.current[0]?.focus();
  }, [focusKey]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => (value[index] ?? ' ').trim());

  const setAt = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    const code = next.map((d) => d || ' ').join('');
    onChange(code);
    return code;
  };

  const fill = (text: string, from: number) => {
    if (busy) return;
    const incoming = text.replace(/\D/g, '').slice(0, CODE_LENGTH - from);
    if (!incoming) return;
    const next = digits.slice();
    incoming.split('').forEach((digit, offset) => {
      next[from + offset] = digit;
    });
    const code = next.map((d) => d || ' ').join('');
    onChange(code);
    const last = Math.min(from + incoming.length, CODE_LENGTH - 1);
    refs.current[last]?.focus();
    if (isComplete(code)) onComplete(code);
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (busy && event.key === 'Backspace') return;
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      setAt(index - 1, '');
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fill(event.clipboardData.getData('text'), index);
  };

  return (
    <div role="group" aria-label="6-digit code" className="flex items-center gap-1.5">
      {digits.map((digit, index) => (
        <span key={index} className="contents">
          {index === 3 && (
            <span aria-hidden className="text-admin-h1 font-medium tracking-title text-neutral-300">
              –
            </span>
          )}
          <input
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            readOnly={busy}
            aria-busy={busy || undefined}
            aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
            aria-invalid={invalid || undefined}
            placeholder="0"
            autoFocus={index === 0}
            onKeyDown={onKeyDown(index)}
            onPaste={onPaste(index)}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const typed = event.target.value.replace(/\D/g, '');
              if (typed.length > 1) {
                fill(typed, index);
                return;
              }
              const code = setAt(index, typed);
              if (!typed) return;
              if (index < CODE_LENGTH - 1) refs.current[index + 1]?.focus();
              if (isComplete(code)) onComplete(code);
            }}
            className={cn(
              'h-14 w-12 rounded-admin-md border bg-surface-card text-center text-display-l font-semibold tracking-heading text-text-primary caret-brand-600 shadow-xs outline-none transition-field duration-fast ease-standard placeholder:text-neutral-300 focus:placeholder:text-transparent',
              'focus:border-2 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/24',
              invalid ? 'border-danger-600' : 'border-neutral-300',
            )}
          />
        </span>
      ))}
    </div>
  );
}
