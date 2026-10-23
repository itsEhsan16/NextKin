import type { Job } from '@nextkin/shared/models';

/** About — real company fields already on `Job` (`companyAbout`/`companyIndustry`/`companySize`/
    `companyWebsite`), the same ones mobile's Company screen already surfaces; not drawn on this
    board, but not fabricated either. */
export function JobAboutTab({ job }: { job: Job }) {
  return (
    <div>
      {job.companyAbout && <p className="text-body-l text-text-secondary">{job.companyAbout}</p>}

      <dl className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2 text-body-s">
          <dt className="w-24 shrink-0 text-text-tertiary">Industry</dt>
          <dd className="text-text-primary">{job.companyIndustry}</dd>
        </div>
        <div className="flex gap-2 text-body-s">
          <dt className="w-24 shrink-0 text-text-tertiary">Size</dt>
          <dd className="text-text-primary">{job.companySize}</dd>
        </div>
        <div className="flex gap-2 text-body-s">
          <dt className="w-24 shrink-0 text-text-tertiary">Website</dt>
          <dd>
            <a
              href={`https://${job.companyWebsite}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              {job.companyWebsite}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  );
}
