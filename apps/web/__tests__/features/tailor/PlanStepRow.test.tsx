import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';

import { PlanStepRow } from '@/features/tailor/flow/PlanStepRow';
import { renderWithQuery } from '../../../testSupport/render';

/** The fix plan's steps (owner, toreview §129): the AI places a skill; it drafts the result line. */

const places = [
  { id: 'role_web', label: 'Full-Stack Developer · Webcros' },
  { id: 'role_old', label: 'Intern · Acme' },
];
const keyword: PlanStep = {
  id: 'k',
  kind: 'keyword',
  title: 'Add Git',
  have: 'Not on your resume',
  worth: 0.2,
  basis: '',
  who: 'you',
  keyword: 'Git',
  importance: 'required',
  totalAfter: 6.3,
  where: 'role_web',
};
const number: PlanStep = {
  id: 'n',
  kind: 'number',
  title: 'Add the result',
  have: 'No measured result yet',
  worth: 0.1,
  basis: '',
  who: 'you',
  totalAfter: 7.5,
  bullet: { roleId: 'role_web', index: 0, text: 'Built the checkout in Next.js.' },
};

function row(step: PlanStep, extra: Partial<Parameters<typeof PlanStepRow>[0]> = {}) {
  const props = {
    step,
    index: 0,
    added: [] as string[],
    places,
    where: undefined,
    placedBy: undefined,
    resumeId: 'res_1',
    figure: undefined,
    onToggle: jest.fn(),
    onPlace: jest.fn(),
    onFigure: jest.fn(),
    ...extra,
  };
  renderWithQuery(
    <ul>
      <PlanStepRow {...props} />
    </ul>,
  );
  return props;
}

describe('PlanStepRow', () => {
  beforeEach(() => resetMockRepos());

  it('"I have this" takes the AI’s pick of role', async () => {
    const user = userEvent.setup();
    const props = row(keyword);
    await user.click(screen.getByRole('button', { name: 'I have this' }));
    expect(props.onPlace).toHaveBeenCalledWith('Git', 'role_web', 'ai');
    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it('shows the AI’s pick once ticked, and lets the user choose another or Skills only', async () => {
    const user = userEvent.setup();
    const props = row(keyword, { added: ['Git'], where: 'role_web', placedBy: 'ai' });
    expect(screen.getByText('AI places it in: Full-Stack Developer · Webcros')).toBeInTheDocument();
    expect(screen.getByText(/Counts in full/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /AI places it in/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Intern · Acme' }));
    expect(props.onPlace).toHaveBeenCalledWith('Git', 'role_old', 'you');
  });

  it('"Add the result" builds the line from two picks, with nothing picked for them', async () => {
    const user = userEvent.setup();
    const props = row(number);
    await user.click(screen.getByRole('button', { name: 'Add the result' }));
    const use = screen.getByRole('button', { name: 'Use this line' });
    expect(use).toBeDisabled();
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Made it faster' }));
    expect(use).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '25%' }));
    expect(
      screen.getByText('Built the checkout in Next.js, cutting the time it took by about 25%.'),
    ).toBeInTheDocument();
    await user.click(use);
    expect(props.onFigure).toHaveBeenCalledWith(
      'Built the checkout in Next.js, cutting the time it took by about 25%.',
    );
  });

  it('"Something else" drafts the line; the user fills only the figure', async () => {
    const user = userEvent.setup();
    const props = row(number);
    await user.click(screen.getByRole('button', { name: 'Add the result' }));
    await user.click(screen.getByRole('button', { name: 'Something else' }));
    const input = await screen.findByRole('textbox', { name: /The result/ }, { timeout: 4000 });
    expect(screen.getByRole('button', { name: 'Use this line' })).toBeDisabled();
    await user.type(input, 'page load time by 30%');
    await user.click(screen.getByRole('button', { name: 'Use this line' }));
    expect(props.onFigure).toHaveBeenCalledWith(
      'Built the checkout in Next.js, improving page load time by 30%.',
    );
  });
});
