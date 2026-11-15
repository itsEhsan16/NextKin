import type { FigureDraft, KeywordQuestion, TailorComparison } from '@nextkin/shared/models';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AcceptAll } from '@/features/tailor/flow/AcceptAll';
import type { TailorChoices } from '@/features/tailor/useTailorRun';

/**
 * "Accept all suggestions" (owner, D-25, toreview §211): nothing is accepted until the candidate
 * presses it; one press takes every keyword, every question and each line's suggested result.
 */

const mutateAsync = jest.fn<Promise<FigureDraft>, [{ text: string }]>();
jest.mock('@nextkin/shared/queries', () => ({ useDraftFigure: () => ({ mutateAsync }) }));

const comparison = {
  resumeId: 'r1',
  jdId: 'jd1',
  score: 59,
  improvements: [],
  keywords: [
    { label: 'React', onResume: true, source: 'required' },
    { label: 'KYC', onResume: false, source: 'required' },
  ],
} as TailorComparison;
const question: KeywordQuestion = { keyword: 'Postman', where: 'r1', place: 'Backend Engineer', line: 'Built REST endpoints', by: 'model' };
const bullets = [
  { roleId: 'r1', index: 0, text: 'Built the checkout' },
  { roleId: 'project:p1', index: 1, text: 'Wrote the docs' },
];

function choicesWith(state: { added?: string[]; places?: TailorChoices['places']; figures?: Record<string, string> } = {}) {
  const acceptAll = jest.fn();
  const resetKeywords = jest.fn();
  const choices = {
    choices: { fixes: [], experience: 'full', added: state.added ?? [], places: state.places ?? {}, figures: state.figures ?? {} },
    figureOf: (roleId: string, line: number) => state.figures?.[`${roleId}#${line}`],
    acceptAll,
    resetKeywords,
  } as unknown as TailorChoices;
  return { choices, acceptAll, resetKeywords };
}

describe('accept all suggestions', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('accepts nothing until pressed, then takes every keyword, question and suggested result', async () => {
    mutateAsync.mockImplementation(async ({ text }) =>
      text === 'Built the checkout'
        ? { before: 'Built the checkout, raising', after: '.', hint: 'what improved', by: 'model', suggestion: 'conversion by 5%' }
        : { before: 'Wrote the docs, improving', after: '.', hint: 'what improved', by: 'rules' },
    );
    const { choices, acceptAll } = choicesWith();
    render(<AcceptAll comparison={comparison} choices={choices} questions={[question]} bullets={bullets} />);
    expect(acceptAll).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept all suggestions' }));
    await waitFor(() => expect(acceptAll).toHaveBeenCalledTimes(1));
    expect(acceptAll).toHaveBeenCalledWith(comparison, {
      questions: [question],
      // The line the AI had no figure for is left for the candidate.
      lines: [{ roleId: 'r1', index: 0, text: 'Built the checkout, raising conversion by 5%.' }],
    });
  });

  it('once everything is accepted, offers to clear it', async () => {
    const { choices, resetKeywords } = choicesWith({
      added: ['KYC', 'Postman'],
      places: { Postman: { where: ['r1'], note: '', by: 'you' } },
      figures: { 'r1#0': 'Built the checkout, raising conversion by 5%.', 'project:p1#1': 'Wrote the docs 40 teams use.' },
    });
    render(<AcceptAll comparison={comparison} choices={choices} questions={[question]} bullets={bullets} />);
    expect(screen.getByText('Every suggestion is accepted')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear my choices' }));
    expect(resetKeywords).toHaveBeenCalled();
  });

  it('draws nothing when there is nothing to suggest', () => {
    const none = { ...comparison, keywords: [comparison.keywords[0]!] } as TailorComparison;
    const { container } = render(<AcceptAll comparison={none} choices={choicesWith().choices} questions={[]} bullets={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
