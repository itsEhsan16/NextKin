import type { ResumeFit } from '@nextkin/shared/schemas/resumeFit';

/** What a fit did, said plainly (G17): nothing reworded, and how many bullets went if any did. */
export function fitMessage(fit: ResumeFit): string {
  if (fit.status === 'done') {
    if (!fit.changed) return 'It already fits on one page.';
    return fit.dropped > 0
      ? `Now one page: ${fit.dropped} ${fit.dropped === 1 ? 'bullet' : 'bullets'} that named nothing this job asks for left out. Nothing was reworded.`
      : 'Now one page, with tighter spacing. Nothing was left out.';
  }
  if (fit.status === 'failed') {
    if (fit.reason === 'cannot_fit')
      return 'It doesn’t fit on one page without losing whole roles, so we left it as it is.';
    if (fit.reason === 'changed_meanwhile')
      return 'The resume changed while we were fitting it. Try again.';
    return 'Fitting isn’t available right now. Try again in a moment.';
  }
  return 'Fitting it to one page…';
}
