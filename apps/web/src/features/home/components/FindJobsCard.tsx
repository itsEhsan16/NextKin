import Link from 'next/link';

/**
 * The indigo promo beside Quick Start (286:294), at the compact density: 200 wide, the art at
 * ~70% and centred, clear of the title. `min-h` keeps it a tile when the row stacks below `xl`.
 */
export function FindJobsCard() {
  return (
    <Link
      href="/jobs"
      className="relative flex min-h-[186px] w-[220px] shrink-0 flex-col justify-end overflow-hidden rounded-lg bg-brand-600 p-6 shadow-card transition-[box-shadow,translate] duration-base ease-standard hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art, no optimisation to do */}
      <img
        src="/illustrations/v2/find-jobs.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-2 h-[110px] w-auto -translate-x-1/2 object-contain"
      />
      <span className="relative text-h2 text-text-inverse">Find Jobs</span>
      <span className="relative mt-0.5 text-body-s text-brand-on-dark">
        {/* A scale claim with no source in the claims register (HM-08). */}
        Browse jobs matched to your profile
      </span>
    </Link>
  );
}
