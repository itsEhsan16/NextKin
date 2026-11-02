import { render, screen } from '@testing-library/react';
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
  it('lists lines without a result, three at first, and finishes one by two picks', async () => {
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
    expect(screen.getAllByRole('button', { name: 'Add the result' })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(screen.getAllByRole('button', { name: 'Add the result' })).toHaveLength(4);

    const [first] = screen.getAllByRole('button', { name: 'Add the result' });
    await user.click(first!);
    await user.click(screen.getAllByRole('button', { name: 'Saved money' })[0]!);
    await user.click(screen.getAllByRole('button', { name: '10%' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Use this line' })[0]!);
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
