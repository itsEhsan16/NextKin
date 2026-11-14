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
  it('lists every line without a result, and finishes one in a dialog fitted to the line', async () => {
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
    // The line with its gap, and the AI's guess offered apart (the mock's draft).
    const guess = await within(dialog).findByRole(
      'button',
      { name: "Use the AI's guess: about 20%" },
      { timeout: SETTLE_MS.normal },
    );
    const use = within(dialog).getByRole('button', { name: 'Use this line' });
    expect(use).toBeDisabled();
    await user.click(guess);
    await user.click(use);
    expect(onFigure).toHaveBeenCalledWith(
      { roleId: 'role_web', index: 1, text: 'Built feature 1.' },
      'Built feature 1, improving about 20%.',
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
