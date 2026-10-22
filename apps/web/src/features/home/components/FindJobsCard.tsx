import Link from 'next/link';

/**
 * The indigo promo beside Quick Start (286:294), at the compact density: 200 wide, the art at
 * ~70% and centred, clear of the title. `min-h` keeps it a tile when the row stacks below `xl`.
 */
export function FindJobsCard() {
  return (
    <Link
      href="/jobs"
      className="relative flex min-h-[186px] w-[200px] shrink-0 flex-col justify-end overflow-hidden rounded-xl bg-brand-600 p-4 transition-opacity duration-press ease-standard hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art, no optimisation to do */}
      <img
        src="/illustrations/find-jobs.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-2 h-[110px] w-[161px] -translate-x-1/2"
      />
      <span className="relative text-h2 text-text-inverse">Find Jobs</span>
      <span className="relative mt-0.5 text-body-s text-brand-on-dark">
        Search millions of jobs
      </span>
      <span
        aria-hidden
        className="absolute bottom-4 right-4 flex size-7 items-center justify-center rounded-full bg-neutral-0 text-body-m text-text-brand"
      >
        ›
      </span>
    </Link>
  );
}
