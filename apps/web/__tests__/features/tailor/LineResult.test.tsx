import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fallbackFigureDraft, type FigureDraft } from '@nextkin/shared/models';

import { LineResult } from '@/features/tailor/flow/LineResult';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const bullet = { roleId: 'role_web', index: 0, text: 'Built the checkout page.' };
const open = (draft: FigureDraft, onSave = jest.fn()) => {
  renderWithQuery(
    <LineResult
      resumeId="res_1"
      bullet={bullet}
      saved={undefined}
      draft={draft}
      onSave={onSave}
      onDone={jest.fn()}
    />,
  );
  return onSave;
};

describe('Add the result: nobody has to type (toreview §212)', () => {
  it('with no AI suggestion it says why and offers to ask again, with no box to fill in', async () => {
    const user = userEvent.setup();
    open({ ...fallbackFigureDraft(bullet.text), reason: 'failed' });
    expect(screen.getByRole('status')).toHaveTextContent('The AI didn’t answer this time.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this line' })).not.toBeInTheDocument();
    // Asking again brings the AI's line (the mock's), filled in and ready to use.
    await user.click(screen.getByRole('button', { name: 'Ask the AI again' }));
    await screen.findByRole('button', { name: /Time saved/ }, { timeout: SETTLE_MS.normal });
    expect(screen.getByRole('button', { name: 'Use this line' })).toBeEnabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('a server with no AI offers no retry, only writing it yourself', async () => {
    const user = userEvent.setup();
    open({ ...fallbackFigureDraft(bullet.text), reason: 'no_ai' });
    expect(screen.queryByRole('button', { name: 'Ask the AI again' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write it myself' }));
    expect(screen.getByRole('textbox')).toHaveValue(bullet.text);
  });

  it('a typed number that measures nothing is not a result, and says so', async () => {
    const user = userEvent.setup();
    open({ ...fallbackFigureDraft(bullet.text), reason: 'failed' });
    await user.click(screen.getByRole('button', { name: 'Write it myself' }));
    const box = screen.getByRole('textbox');
    await user.clear(box);
    await user.type(box, 'Built the checkout page, improving 10.');
    expect(screen.getByRole('button', { name: 'Use this line' })).toBeDisabled();
    expect(screen.getByText(/doesn’t say what it measures yet/)).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'Built the checkout page, cutting drop-off by 10%.');
    expect(screen.getByRole('button', { name: 'Use this line' })).toBeEnabled();
  });

  it('one AI figure and no picks: the line is filled, and a box appears only on "Change the figure"', async () => {
    const user = userEvent.setup();
    open({
      before: 'Built the checkout page, cutting drop-off by',
      after: '.',
      hint: '% fewer drop-offs',
      by: 'model',
      suggestion: 'about 20%',
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this line' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Change the figure' }));
    expect(screen.getByRole('textbox')).toHaveValue('about 20%');
  });
});
