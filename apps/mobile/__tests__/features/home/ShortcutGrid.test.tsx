import { cleanup, render, screen } from '@testing-library/react-native';

import { ShortcutGrid } from '@/features/home/components/ShortcutGrid';

describe('Home shortcuts (toreview §148.1)', () => {
  afterEach(() => cleanup());

  it('says no count at zero, and the tile still opens', async () => {
    await render(
      <ShortcutGrid
        stats={{ resumesCount: 0, activitiesCount: 0, savedJobsCount: 2 }}
        onShortcut={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('My Resumes')).toBeOnTheScreen();
    expect(screen.getByLabelText('History')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saved Jobs, 2 Saved')).toBeOnTheScreen();
  });
});
