import { LogoMarkIllustration } from '@/ui/illustrations';

/**
 * The sign-in page's left half: the brand indigo washing down into white, the mark at the top and
 * one line at the foot. Decorative, so it is hidden from assistive tech, and it gives way to the
 * form alone below the laptop breakpoint.
 */
export function AuthBrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden flex-col justify-between overflow-hidden bg-surface-card p-14 lg:flex"
    >
      {/* The wash: solid brand at the top, a deeper corner, then fading out on a diagonal. */}
      <div className="absolute inset-0 bg-[linear-gradient(168deg,var(--color-brand-700)_0%,var(--color-brand-600)_34%,color-mix(in_oklab,var(--color-brand-600)_35%,transparent)_58%,transparent_82%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_100%_0%,color-mix(in_oklab,var(--color-border-selected)_55%,transparent),transparent_70%)]" />

      <div className="relative flex items-center gap-3">
        {/* The mark on a lit white sphere (owner, toreview §233): a highlight up and to the left,
            a lavender rim where it turns away, and a white halo so it glows on the indigo. */}
        <span className="relative flex size-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,var(--color-surface-card)_0%,var(--color-surface-card)_38%,var(--color-brand-100)_78%,var(--color-brand-200)_100%)] shadow-[0_0_14px_2px_color-mix(in_oklab,var(--color-surface-card)_70%,transparent),0_0_36px_10px_color-mix(in_oklab,var(--color-brand-200)_45%,transparent),inset_-3px_-4px_8px_color-mix(in_oklab,var(--color-brand-300)_45%,transparent)]">
          <LogoMarkIllustration className="h-[23px] w-[22px]" />
        </span>
        <span className="text-h2 font-bold text-text-inverse">NextKin</span>
      </div>

      <p className="relative max-w-[13ch] text-display-xl text-text-primary">
        Your next role starts with one resume.
      </p>
    </aside>
  );
}
