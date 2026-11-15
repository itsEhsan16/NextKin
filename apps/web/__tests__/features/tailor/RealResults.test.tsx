import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';

import { RealResults } from '@/features/tailor/flow/RealResults';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const step = (index: number): PlanStep => ({
  id: `n${index}`,
  kind: 'number',
  title: 'Add the result',
  have: 'No measured result yet',
  worth: 0.1,
  basis: '',
  who: 'you',
  totalAfter: 7,
  bullet: { roleId: 'role_web', index, text: `Built feature ${index}.` },
});

describe('Add real results (toreview §149)', () => {
  it('lists every line without a result, and opens each on the AI’s best suggestion, to use or change', async () => {
    const user = userEvent.setup();
    const onFigure = jest.fn();
    renderWithQuery(
      <RealResults
        steps={[1, 2, 3, 4].map(step)}
        resumeId="res_1"
        figureOf={() => undefined}
        onFigure={onFigure}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Add the result' })).toHaveLength(4);

    const [first] = screen.getAllByRole('button', { name: 'Add the result' });
    await user.click(first!);
    const dialog = screen.getByRole('dialog', { name: 'Add the result' });
    // The AI's first result and its smallest amount are filled in to start (toreview §207): a
    // finished line, labelled as the AI's, that the user may use as it is.
    await within(dialog).findByRole(
      'button',
      { name: /Time saved/ },
      { timeout: SETTLE_MS.normal },
    );
    const use = within(dialog).getByRole('button', { name: 'Use this line' });
    expect(dialog).toHaveTextContent('Built feature 1, saving 2 hours of manual work a week.');
    expect(dialog).toHaveTextContent(
      'The AI’s suggestion. Keep it only if it’s true, or change it.',
    );
    expect(use).toBeEnabled();
    expect(onFigure).not.toHaveBeenCalled();
    // Changing it is one tap, and the label goes: it is the user's choice now.
    await user.click(within(dialog).getByRole('button', { name: /5 hours/ }));
    expect(dialog).not.toHaveTextContent('The AI’s suggestion');
    expect(dialog).toHaveTextContent('Built feature 1, saving 5 hours of manual work a week.');
    await user.click(use);
    expect(onFigure).toHaveBeenCalledWith(
      { roleId: 'role_web', index: 1, text: 'Built feature 1.' },
      'Built feature 1, saving 5 hours of manual work a week.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('draws nothing when every line has a result', () => {
    const { container } = renderWithQuery(
      <RealResults steps={[]} resumeId="res_1" figureOf={() => undefined} onFigure={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
