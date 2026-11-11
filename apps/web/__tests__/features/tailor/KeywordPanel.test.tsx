import type { TailorComparison } from '@nextkin/shared/models';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KeywordPanel } from '@/features/tailor/flow/KeywordPanel';
import { useTailorChoices } from '@/features/tailor/useTailorRun';

/** "Choose keywords to add" (owner's mockup, 2026-11-11). Synthetic. */

const comparison: TailorComparison = {
  resumeId: 'r1',
  jdId: 'jd1',
  score: 56,
  improvements: [],
  places: [{ id: 'role_a', label: 'Engineer · Acme' }],
  picks: { React: ['role_a'] },
  plan: {
    score: 5.6,
    parts: [],
    steps: [
      {
        id: 'k1',
        kind: 'keyword',
        title: 'React',
        have: '',
        worth: 0.5,
        basis: '',
        who: 'you',
        keyword: 'React',
      },
      {
        id: 'k2',
        kind: 'keyword',
        title: 'Jira',
        have: '',
        worth: 0.2,
        basis: '',
        who: 'you',
        keyword: 'Jira',
      },
    ],
  },
  keywords: [
    { label: 'TypeScript', onResume: true, source: 'required' },
    { label: 'React', onResume: false, source: 'required', top: true },
    { label: 'Jira', onResume: false, source: 'required' },
    { label: 'Agile', onResume: false, source: 'required' },
    { label: 'teamwork', onResume: false, source: 'description', kind: 'soft' },
  ],
};

function Harness() {
  const choices = useTailorChoices();
  return <KeywordPanel comparison={comparison} choices={choices} />;
}

const list = () => screen.getByRole('list', { name: /keywords$/ });
const names = () =>
  within(list())
    .getAllByRole('checkbox')
    .map((b) => b.getAttribute('aria-label'));

describe('KeywordPanel', () => {
  it('splits required from optional, with nothing ticked and each row priced', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Missing keywords (3)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(names()).toEqual(['React', 'Jira', 'Agile']);
    expect(within(list()).getByText('+0.5')).toBeInTheDocument();
    expect(within(list()).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('0 keywords selected')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Optional keywords (1)' }));
    expect(names()).toEqual(['teamwork']);
  });

  it('filters by category and by search, and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const rail = screen.getByRole('navigation', { name: 'Keyword categories' });
    await user.click(within(rail).getAllByRole('button', { name: /Tools & platforms/ })[0]!);
    expect(names()).toEqual(['Jira']);

    await user.click(within(rail).getAllByRole('button', { name: /^All/ })[0]!);
    await user.type(screen.getByRole('searchbox', { name: 'Search keywords' }), 'zz');
    expect(screen.getByText('No keyword matches “zz”.')).toBeInTheDocument();
  });

  it('selects only the rows shown, clears, and shows where a placed tick goes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('searchbox', { name: 'Search keywords' }), 'r');
    expect(names()).toEqual(['React', 'Jira']);
    await user.click(screen.getByRole('checkbox', { name: 'Select all (2)' }));
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Jira' })).toBeChecked();
    expect(screen.getByText('2 keywords selected')).toBeInTheDocument();
    // React was picked a place in the resume; Jira fits nowhere, so it has no picker.
    expect(screen.getAllByRole('button', { name: /AI adds it to: Engineer · Acme/ })).toHaveLength(
      1,
    );

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText('0 keywords selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'React' })).not.toBeChecked();
  });
});
