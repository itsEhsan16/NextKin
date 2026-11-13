import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';

import { RealResults } from '@/features/tailor/flow/RealResults';

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
  it('lists every line without a result, and finishes one by two picks in a dialog', async () => {
    const user = userEvent.setup();
    const onFigure = jest.fn();
    render(
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
    await user.click(within(dialog).getByRole('button', { name: 'Saved money' }));
    await user.click(within(dialog).getByRole('button', { name: '10%' }));
    await user.click(within(dialog).getByRole('button', { name: 'Use this line' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onFigure).toHaveBeenCalledWith(
      { roleId: 'role_web', index: 1, text: 'Built feature 1.' },
      'Built feature 1, cutting costs by about 10%.',
    );
  });

  it('draws nothing when every line has a result', () => {
    const { container } = render(
      <RealResults steps={[]} resumeId="res_1" figureOf={() => undefined} onFigure={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
