import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { BulletRows } from '@/features/resumes/components/sections/BulletRows';

/** Holds the bullets the way the section editor does, so edits round-trip through props. */
function Harness({ initial }: { initial: string[] }) {
  const [bullets, setBullets] = useState(initial);
  return (
    <BulletRows
      entryId="exp1"
      entryName="Role 1"
      bullets={bullets}
      onChange={setBullets}
      errors={{}}
    />
  );
}

const valueOf = (n: number) =>
  screen.getByLabelText(`Role 1, bullet ${n}`).props.value as string | undefined;

describe('BulletRows', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('removes the bullet that was tapped, keeping the others and their order', async () => {
    await render(<Harness initial={['First', 'Second', 'Third']} />);

    await fireEvent.press(screen.getByLabelText('Remove bullet 2 of Role 1'));

    expect(screen.queryByLabelText('Role 1, bullet 3')).toBeNull();
    expect(valueOf(1)).toBe('First');
    expect(valueOf(2)).toBe('Third');
  });

  it('adds an empty bullet at the end', async () => {
    await render(<Harness initial={['First']} />);

    await fireEvent.press(screen.getByLabelText('Add bullet'));

    expect(valueOf(1)).toBe('First');
    expect(valueOf(2)).toBe('');
  });
});
