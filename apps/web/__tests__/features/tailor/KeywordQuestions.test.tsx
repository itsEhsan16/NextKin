import type { KeywordQuestion } from '@nextkin/shared/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KeywordQuestions, saidYes } from '@/features/tailor/flow/KeywordQuestions';
import type { TailorChoices } from '@/features/tailor/useTailorRun';

/** "Did you use these?" (toreview §206.3): only a yes adds anything, and a no takes it back. */

const question: KeywordQuestion = {
  keyword: 'Postman',
  where: 'r1',
  place: 'Backend Engineer, Kestrel Freight',
  line: 'Built REST endpoints for the billing service',
  by: 'model',
};

function choicesWith(places: TailorChoices['places'] = {}) {
  const togglePlace = jest.fn();
  const tick = jest.fn();
  return { choices: { places, togglePlace, tick } as unknown as TailorChoices, togglePlace, tick };
}

describe('the keyword questions', () => {
  it('asks beside the user’s own line, and starts at No', () => {
    const { choices } = choicesWith();
    render(<KeywordQuestions questions={[question]} choices={choices} />);
    expect(
      screen.getByText('Did you use Postman in Backend Engineer, Kestrel Freight?'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your resume says: “Built REST endpoints for the billing service”'),
    ).toBeInTheDocument();
    expect(saidYes(choices, question)).toBe(false);
  });

  it('a yes confirms it at that role as the user’s own word', async () => {
    const { choices, togglePlace, tick } = choicesWith();
    render(<KeywordQuestions questions={[question]} choices={choices} />);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Yes' }));
    expect(togglePlace).toHaveBeenCalledWith('Postman', 'r1', true);
    expect(tick).not.toHaveBeenCalled();
  });

  it('a no after a yes takes the keyword back out entirely', async () => {
    const { choices, togglePlace, tick } = choicesWith({
      Postman: { where: ['r1'], note: '', by: 'you' },
    });
    render(<KeywordQuestions questions={[question]} choices={choices} />);
    expect(saidYes(choices, question)).toBe(true);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'No' }));
    expect(tick).toHaveBeenCalledWith('Postman', false);
    expect(togglePlace).not.toHaveBeenCalled();
  });

  it('draws nothing when there is nothing to ask', () => {
    const { container } = render(
      <KeywordQuestions questions={[]} choices={choicesWith().choices} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
