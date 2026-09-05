import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Resume } from '@/data/models';
import { ResumeMenuSheetBody } from '@/features/resumes';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const resume: Resume = {
  id: 'res_2',
  title: 'Stripe — Senior PD',
  docType: 'resume',
  targetCompany: 'Stripe',
  targetRole: 'Senior Product Designer',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
  versionCount: 2,
  currentVersionId: 'ver_2_2',
  atsScore: 88,
  status: 'ready',
  tags: [],
};

const handlers = {
  onRename: jest.fn(),
  onSubmitRename: jest.fn(),
  onCancelRename: jest.fn(),
  onDuplicate: jest.fn(),
  onTailor: jest.fn(),
  onSetAsBase: jest.fn(),
  onDownload: jest.fn(),
  onShare: jest.fn(),
  onRequestDelete: jest.fn(),
  onConfirmDelete: jest.fn(),
  onCancelDelete: jest.fn(),
};

/** Lets React commit what the last event scheduled. */
const flush = async () => {
  await act(async () => {});
};

/**
 * Typing into the rename step of RESUMES 03 (V2 §7.11). It lives apart from the sheet's other
 * variants because it is the one pane holding state of its own, and this environment commits a
 * component's own state updates only up to the first press that lands in the tree (the same
 * act-queue fragility the plan's Phase 3 test-infra note describes). So: one mount, one pane,
 * and all the editing before the press. The blank-name guard needs a press of its own and is
 * asserted in ResumeMenuSheetBody.test.tsx, where it is that tree's first press.
 */
describe('Resume rename pane (V2 §7.11)', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('saves a trimmed name, and only once the name has actually changed', async () => {
    Object.values(handlers).forEach((handler) => handler.mockClear());
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ResumeMenuSheetBody
          resume={resume}
          step="rename"
          deleting={false}
          renaming={false}
          {...handlers}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('header', { name: 'Rename this resume' })).toBeOnTheScreen();
    // Seeded from the document, and inert until the name actually changes.
    expect(screen.getByLabelText('Name').props.value).toBe('Stripe — Senior PD');
    expect(screen.getByLabelText('Save')).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Name'), '  Stripe — PD 2026  ');
    await flush();
    expect(screen.getByLabelText('Save')).not.toBeDisabled();

    fireEvent.press(screen.getByLabelText('Save'));
    await flush();
    // Trimmed on the way out: the store never sees the stray spaces.
    expect(handlers.onSubmitRename).toHaveBeenCalledTimes(1);
    expect(handlers.onSubmitRename).toHaveBeenCalledWith('Stripe — PD 2026');
  }, 30000);
});
