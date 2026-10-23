/**
 * The phone sign-in's backdrop (owner's mockup, 2026-10-23): a pale brand disc in the top-right
 * corner and a deeper wash in the bottom-left, each crossed by a hairline arc carrying a brand
 * dot. Decorative only, and gone from the laptop breakpoint, where the brand panel takes over.
 */
export function AuthMobileDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-50" />
      <div className="absolute -bottom-40 -left-28 size-96 rounded-full bg-[radial-gradient(circle_at_30%_70%,color-mix(in_oklab,var(--color-border-selected)_40%,transparent),var(--color-brand-50)_70%)]" />

      <svg
        viewBox="0 0 200 200"
        fill="none"
        className="absolute -right-2 top-0 size-52 text-border-brand-strong"
      >
        <path d="M2 0C14 70 70 110 150 140C175 150 190 165 202 180" stroke="currentColor" />
        <circle cx="137" cy="135" r="5" className="fill-brand-600" />
      </svg>
      <svg
        viewBox="0 0 200 120"
        fill="none"
        className="absolute bottom-0 right-6 h-36 w-60 text-border-brand-strong"
      >
        <path d="M0 22C60 12 110 30 150 62C170 78 185 98 196 122" stroke="currentColor" />
        <circle cx="140" cy="55" r="6" className="fill-brand-600" />
      </svg>
    </div>
  );
}
