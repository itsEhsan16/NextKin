import { cleanup, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { DocumentContent, Resume } from '@/data/models';
import { mockStore, resetMockRepos } from '@/data/repos';
import { EditorHero } from '@/features/resumes/components/EditorHero';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const WHY = 'Add a job to see a score. We don’t guess.';

async function renderHero(over: Partial<Resume>, content?: DocumentContent) {
  const resume = mockStore.state.resumes[0];
  if (!resume) throw new Error('no fixture resume');
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditorHero
        resume={{ ...resume, ...over }}
        {...(content ? { content } : {})}
        onOpenScore={jest.fn()}
        onOpenRubric={jest.fn()}
        onOpenVersions={jest.fn()}
      />
    </SafeAreaProvider>,
  );
}

// D-15: no total without a job. The page says why, rather than leaving a blank to wonder about.
describe('EditorHero with no score', () => {
  beforeEach(() => resetMockRepos());
  afterEach(async () => {
    await cleanup();
  });

  it('says what a score needs', async () => {
    await renderHero({ atsScore: undefined });
    expect(screen.getByText('Not scored yet')).toBeOnTheScreen();
    expect(screen.getByText(WHY)).toBeOnTheScreen();
  });

  it('says nothing once there is a score', async () => {
    await renderHero({ atsScore: 72 });
    expect(screen.queryByText(WHY)).toBeNull();
  });

  it('says nothing on a cover letter, which is never scored', async () => {
    await renderHero({ atsScore: undefined }, {
      kind: 'cover_letter',
      tone: 'professional',
    } as DocumentContent);
    expect(screen.queryByText(WHY)).toBeNull();
  });
});
