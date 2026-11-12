import { render, screen } from '@testing-library/react';

import { MatchBadge } from '@/features/jobs/components/MatchBadge';
import { MATCH_TONE } from '@/features/jobs/matchTone';
import { sectionOf } from '@/features/tailor/tailorLibrary';
import { ringToneFor } from '@/ui/ScoreRing';

/** R0 of the web redesign (doc/redesign/06-roadmap.md): scores never flatter by default. */
describe('honest score defaults', () => {
  it('draws no match badge without a band, instead of a green "strong" (JB-03)', () => {
    const { container } = render(<MatchBadge score={0.62} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws a weak match apart from a fair one (JB-03)', () => {
    render(<MatchBadge score={0.3} band="weak" />);
    expect(screen.getByText('30% Match')).toHaveClass(MATCH_TONE.weak.surface);
    expect(MATCH_TONE.weak.surface).not.toBe(MATCH_TONE.fair.surface);
  });

  it('colours a score ring by its band, never green by default (RS-35)', () => {
    expect(ringToneFor('strong')).toBe('success');
    // Good is a grey track with an indigo arc (owner, 2026-11-12), not Strong's green.
    expect(ringToneFor('good')).toBe('brand');
    expect(ringToneFor('fair')).toBe('warning');
    expect(ringToneFor('weak')).toBe('danger');
  });

  it('names no section for a request that names none, so the assistant asks (TL-42)', () => {
    expect(sectionOf('Make the dates consistent')).toBeNull();
    expect(sectionOf('Shorten my summary')).toBe('summary');
    expect(sectionOf('Remove skills not related to this job')).toBe('skills');
    expect(sectionOf('Use stronger action verbs for my latest experience')).toBe('experience');
  });
});
