import { cn } from '@/lib/cn';
import { CheckCircleIcon, PersonIcon } from '@/ui/icons';

export type ProfileSoFarRow = {
  label: string;
  /** Absent until answered: the row shows a grey bar instead (807:46). */
  value?: string;
};

/**
 * "Your profile so far" (807:36): the answers given so far, each with a green tick, and a grey
 * bar for each still to come. It fills in as the user types, not when they continue. With six rows
 * (ONB 07) they sit a little closer, so the card and its art still fit one laptop window.
 */
export function ProfileSoFar({ rows }: { rows: ProfileSoFarRow[] }) {
  const dense = rows.length > 5;
  return (
    <section
      aria-label="Your profile so far"
      className="w-full rounded-lg border border-border-subtle bg-surface-card px-5 pb-2 pt-4 shadow-popover"
    >
      <h2 className="flex items-center gap-2 pb-2 text-title-l font-bold text-text-primary">
        <PersonIcon className="size-3 text-text-brand" />
        Your profile so far
      </h2>
      <dl>
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2 border-t border-border-subtle',
              dense ? 'min-h-9 py-1.5' : 'min-h-10 py-2',
            )}
          >
            <dt className="w-24 shrink-0 text-body-m font-medium text-text-tertiary">{label}</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              {value ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-body-m font-semibold text-text-primary animate-reveal">
                    {value}
                  </span>
                  <CheckCircleIcon
                    aria-hidden={false}
                    role="img"
                    aria-label="Answered"
                    className="size-3.5 shrink-0 text-success-600"
                  />
                </>
              ) : (
                <span
                  className="block h-1.5 w-24 rounded-full bg-neutral-100"
                  aria-label="Not answered yet"
                  role="img"
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
