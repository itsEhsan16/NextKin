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

function Harness({ tab = 'missing' }: { tab?: 'missing' | 'optional' }) {
  const choices = useTailorChoices();
  return <KeywordPanel comparison={comparison} choices={choices} tab={tab} />;
}

const list = () => screen.getByRole('list', { name: /keywords$/ });
const names = () =>
  within(list())
    .getAllByRole('checkbox')
    .map((b) => b.getAttribute('aria-label'));

describe('KeywordPanel', () => {
  it('splits required from optional, with nothing ticked and each row priced', () => {
    const { rerender } = render(<Harness />);
    expect(names()).toEqual(['React', 'Jira', 'Agile']);
    expect(within(list()).getByText('+0.5')).toBeInTheDocument();
    expect(within(list()).getByText('—')).toBeInTheDocument();
    // One "select all", in the table's head; no search box and no second bar under the table.
    expect(screen.getAllByRole('checkbox', { name: /^Select every keyword shown/ })).toHaveLength(
      1,
    );
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByText(/keywords? selected/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull();

    rerender(<Harness tab="optional" />);
    expect(names()).toEqual(['teamwork']);
  });

  it('filters by category', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const kinds = screen.getByRole('group', { name: 'Keyword kinds' });
    await user.click(within(kinds).getByRole('button', { name: /Tools & platforms/ }));
    expect(names()).toEqual(['Jira']);

    await user.click(within(kinds).getByRole('button', { name: /^All/ }));
    expect(names()).toEqual(['React', 'Jira', 'Agile']);
  });

  it('selects every row shown from the table’s head, clears with it, and shows where a placed tick goes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const all = screen.getByRole('checkbox', { name: 'Select every keyword shown (3)' });
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Jira' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Agile' })).toBeChecked();
    // React was picked a place in the resume; Jira fits nowhere, so it has no picker.
    expect(screen.getAllByRole('button', { name: /AI adds it to: Engineer · Acme/ })).toHaveLength(
      1,
    );

    // The same box clears them.
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: 'React' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Agile' })).not.toBeChecked();
  });
});
