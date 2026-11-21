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
        {/* The mark on a soft white spread, the same art as the landing nav's logo (owner,
            2026-11-21). The slot is the star itself; the glow overflows it (see LandingNav). */}
        <span className="relative size-9 shrink-0 translate-y-px">
          <img
            src="/landing/logo-mark-glow.svg"
            alt=""
            className="absolute max-w-none"
            style={{ top: '-79.7%', left: '-81.3%', width: '272.7%', height: '272.7%' }}
          />
        </span>
        <span className="text-h2 font-bold text-text-inverse">NextKin</span>
      </div>

      <p className="relative max-w-[13ch] text-display-xl text-text-primary">
        Your next role starts with one resume.
      </p>
    </aside>
  );
}
