import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';

import { MoreFixes, ShowInRole } from '@/features/tailor/flow/PlanExtras';
import { RealResults } from '@/features/tailor/flow/RealResults';
import type { TailorChoices } from '@/features/tailor/useTailorRun';
import { renderWithQuery } from '../../../testSupport/render';

/** The fix plan inside Enhance (owner, toreview §161), in place of the old table (§129). */

const places = [
  { id: 'role_web', label: 'Full-Stack Developer · Webcros' },
  { id: 'role_old', label: 'Intern · Acme' },
];
const evidence: PlanStep = {
  id: 'ev',
  kind: 'evidence',
  title: 'Show Claude Code in a role',
  have: 'Only in your skills list — half credit',
  worth: 0.1,
  basis: '',
  who: 'you',
  keyword: 'Claude Code',
  importance: 'required',
  need: 'Rapid prototyping: ship MVPs fast',
};
const contact: PlanStep = {
  id: 'sec',
  kind: 'section',
  title: 'Add an email, and a phone number or location',
  have: 'Missing or too short',
  worth: 0.3,
  basis: 'What re-scoring with it gives',
  who: 'you',
};
const wording: PlanStep = {
  ...contact,
  id: 'w',
  kind: 'wording',
  title: 'Use the job’s words',
  who: 'ai',
  worth: 0.2,
};
const keyword: PlanStep = {
  ...evidence,
  id: 'k',
  kind: 'keyword',
  title: 'Add Docker',
  keyword: 'Docker',
};
const number: PlanStep = {
  id: 'n',
  kind: 'number',
  title: 'Add the result',
  have: 'No measured result yet',
  worth: 0.1,
  basis: '',
  who: 'you',
  bullet: { roleId: 'role_web', index: 0, text: 'Built the checkout in Next.js.' },
};

function choicesWith(extra: Partial<TailorChoices> = {}) {
  return {
    added: [],
    places: {},
    placeKeyword: jest.fn(),
    setAdded: jest.fn(),
    ...extra,
  } as unknown as TailorChoices;
}

describe('the plan inside Enhance', () => {
  beforeEach(() => resetMockRepos());

  it('"Show these in a role" places a skill-list skill where the user says, as theirs', async () => {
    const user = userEvent.setup();
    const choices = choicesWith();
    renderWithQuery(
      <ShowInRole steps={[keyword, evidence, number]} places={places} choices={choices} />,
    );
    const row = screen.getByText('Claude Code').closest('li')!;
    expect(within(row).getByText('Required')).toBeInTheDocument();
    expect(within(row).getByText('+0.1')).toBeInTheDocument();
    // Only the skill-list step: keywords are capsules and results have their own list.
    expect(screen.queryByText('Docker')).toBeNull();
    await user.click(within(row).getByRole('button', { name: 'Say where you used it' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Intern · Acme' }));
    expect(choices.placeKeyword).toHaveBeenCalledWith('Claude Code', 'role_old', 'you');
  });

  it('"Skills only" takes the skill back', async () => {
    const user = userEvent.setup();
    const choices = choicesWith({
      added: ['Claude Code', 'Git'],
      places: { 'Claude Code': { where: 'role_web', note: '', by: 'you' } },
    });
    renderWithQuery(<ShowInRole steps={[evidence]} places={places} choices={choices} />);
    await user.click(screen.getByRole('button', { name: /Used in: Full-Stack Developer/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Skills only/ }));
    expect(choices.setAdded).toHaveBeenCalledWith(['Git']);
  });

  it('"More to raise your score" lists the other steps with who does each and what it adds', () => {
    renderWithQuery(
      <MoreFixes steps={[keyword, evidence, number, contact, wording]} resumeId="res_1" />,
    );
    const mine = screen.getByText(contact.title).closest('li')!;
    expect(within(mine).getByText('You fix it')).toBeInTheDocument();
    expect(within(mine).getByText('+0.3')).toBeInTheDocument();
    expect(within(mine).getByRole('link', { name: 'Fix in the editor' })).toHaveAttribute(
      'target',
      '_blank',
    );
    const ai = screen.getByText(wording.title).closest('li')!;
    expect(within(ai).getByText('AI does it')).toBeInTheDocument();
    expect(within(ai).queryByRole('link')).toBeNull();
    for (const covered of ['Add Docker', 'Show Claude Code in a role', 'Add the result'])
      expect(screen.queryByText(covered)).toBeNull();
  });

  it('"Add the result" builds the line from two picks, with nothing picked for them', async () => {
    const user = userEvent.setup();
    const onFigure = jest.fn();
    renderWithQuery(
      <RealResults
        steps={[number]}
        resumeId="res_1"
        figureOf={() => undefined}
        onFigure={onFigure}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add the result' }));
    const use = screen.getByRole('button', { name: 'Use this line' });
    expect(use).toBeDisabled();
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Made it faster' }));
    expect(use).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '25%' }));
    await user.click(use);
    expect(onFigure).toHaveBeenCalledWith(
      number.bullet,
      'Built the checkout in Next.js, cutting the time it took by about 25%.',
    );
  });

  it('"Something else" drafts the line; the user fills only the figure', async () => {
    const user = userEvent.setup();
    const onFigure = jest.fn();
    renderWithQuery(
      <RealResults
        steps={[number]}
        resumeId="res_1"
        figureOf={() => undefined}
        onFigure={onFigure}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add the result' }));
    await user.click(screen.getByRole('button', { name: 'Something else' }));
    const input = await screen.findByRole('textbox', { name: /The result/ }, { timeout: 4000 });
    await user.type(input, 'page load time by 30%');
    await user.click(screen.getByRole('button', { name: 'Use this line' }));
    expect(onFigure).toHaveBeenCalledWith(
      number.bullet,
      'Built the checkout in Next.js, improving page load time by 30%.',
    );
  });
});
