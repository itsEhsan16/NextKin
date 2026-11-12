import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreditPill } from '@/ui/CreditPill';
import { InfoTip } from '@/ui/InfoTip';
import { ringToneFor } from '@/ui/ScoreRing';
import { ScoreVerdict } from '@/ui/ScoreVerdict';
import { SCORE_TONE } from '@/ui/scoreTone';

/** Redesign R3c: one honest score scale, and the hints that go with it. */
describe('the score scale', () => {
  it('gives every band its own colour, and Good a grey surface with an indigo arc', () => {
    expect(ringToneFor('strong')).toBe('success');
    expect(ringToneFor('good')).toBe('brand');
    expect(ringToneFor('fair')).toBe('warning');
    expect(ringToneFor('weak')).toBe('danger');
    const surfaces = Object.values(SCORE_TONE).map((tone) => tone.surface);
    expect(new Set(surfaces).size).toBe(4);
  });
});

describe('ScoreVerdict', () => {
  it('shows a number only with its band word', () => {
    render(<ScoreVerdict variant="panel" kind="resume" score={72} band="good" />);
    expect(
      screen.getByRole('img', { name: 'NextKin Score, Good match: 72 out of 100' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Good match' })).toBeInTheDocument();
  });

  it('draws no ring and no number without a job description (D-15)', () => {
    render(
      <ScoreVerdict
        variant="panel"
        kind="resume"
        state="no-jd"
        addJobHref={'/create/build' as never}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Add a job to score')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a job' })).toHaveAttribute(
      'href',
      '/create/build',
    );
  });

  it('says what evidence is missing instead of guessing (D-14)', () => {
    render(
      <ScoreVerdict
        variant="panel"
        kind="resume"
        state="insufficient"
        missingEvidence="Add dates to 2 roles"
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Not enough evidence yet')).toBeInTheDocument();
    expect(screen.getByText('Add dates to 2 roles')).toBeInTheDocument();
  });

  it('marks partly met reasons apart from met ones', () => {
    render(
      <ScoreVerdict
        variant="panel"
        kind="match"
        score={64}
        band="fair"
        reasons={[
          { kind: 'met', label: 'Figma' },
          { kind: 'partial', label: 'Design systems' },
          { kind: 'missing', label: 'Product strategy' },
        ]}
      />,
    );
    expect(screen.getByText('(met)', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText('(partly: listed, not shown in a dated role)', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText('(missing)', { exact: false })).toBeInTheDocument();
  });

  it('renders no badge or pill without a band', () => {
    const { container } = render(
      <>
        <ScoreVerdict variant="badge" kind="match" score={90} />
        <ScoreVerdict variant="pill" kind="match" />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('hints', () => {
  it('opens an InfoTip on a tap, not only on hover', async () => {
    render(<InfoTip label="How credits work">Credits reset on the 1st.</InfoTip>);
    await userEvent.click(screen.getByRole('button', { name: 'How credits work' }));
    expect((await screen.findAllByText('Credits reset on the 1st.')).length).toBeGreaterThan(0);
  });

  it('keeps spending neutral, and only "none left" in the paid colour', () => {
    const { rerender } = render(<CreditPill state="cost" text="Uses 1 generation" />);
    expect(screen.getByText('Uses 1 generation')).toHaveClass('bg-surface-muted');
    rerender(
      <CreditPill state="none" text="No generations left" upgradeHref={'/settings' as never} />,
    );
    expect(screen.getByText('No generations left')).toHaveClass('bg-surface-paid');
    expect(screen.getByRole('link', { name: 'Upgrade' })).toBeInTheDocument();
  });
});
