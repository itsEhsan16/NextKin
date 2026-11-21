import { cn } from '@/lib/cn';

/**
 * A small pointer for the toolkit scenes, like the references' cursor. It renders where the scene
 * ends (its final frame); the scene's timeline moves it there from elsewhere.
 */
export function SceneCursor({ className }: { className?: string }) {
  return (
    <svg
      data-cursor
      aria-hidden
      viewBox="0 0 24 24"
      width={22}
      height={22}
      className={cn('pointer-events-none absolute z-10', className)}
    >
      <path
        d="M5 3.2v15.9c0 .6.7.9 1.1.5l3.6-3.6 2.4 5.4c.2.5.7.7 1.2.5l1.6-.7c.5-.2.7-.7.5-1.2l-2.4-5.3h5.1c.6 0 .9-.7.5-1.1L6.1 2.7C5.7 2.3 5 2.6 5 3.2Z"
        fill="#14162b"
        stroke="#ffffff"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Writes a counting number into `el` as `n` moves; for timelines. */
export function countInto(el: Element | undefined, suffix = '') {
  const state = { n: 0 };
  return {
    state,
    update: () => {
      if (el) el.textContent = `${Math.round(state.n)}${suffix}`;
    },
  };
}

/** The centre of `target` relative to the centre of `origin`, for moving a cursor between them. */
export function offsetBetween(origin: Element, target: Element) {
  const a = origin.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  return {
    x: b.left + b.width / 2 - (a.left + a.width / 2),
    y: b.top + b.height / 2 - (a.top + a.height / 2),
  };
}
