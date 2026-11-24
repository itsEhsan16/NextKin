import type { ResumeFit } from '@nextkin/shared/schemas/resumeFit';

/** What a fit did, said plainly (G17): nothing reworded, and how many bullets went if any did. */
export function fitMessage(fit: ResumeFit): string {
  if (fit.status === 'done') {
    if (!fit.changed) return 'It already fits on one page.';
    return fit.dropped > 0
      ? `Now one page: ${fit.dropped} ${fit.dropped === 1 ? 'line or skill' : 'lines or skills'} this job doesn’t ask for left out. Your score is unchanged and nothing was reworded.`
      : 'Now one page, with tighter spacing. Nothing was left out.';
  }
  if (fit.status === 'failed') {
    if (fit.reason === 'cannot_fit')
      return 'It doesn’t fit on one page without lowering your score, so we left it as it is.';
    if (fit.reason === 'changed_meanwhile')
      return 'The resume changed while we were fitting it. Try again.';
    return 'Fitting isn’t available right now. Try again in a moment.';
  }
  return 'Fitting it to one page…';
}
