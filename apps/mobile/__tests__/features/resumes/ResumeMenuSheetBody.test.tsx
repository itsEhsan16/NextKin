import { cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Resume } from '@/data/models';
import { ResumeMenuSheetBody } from '@/features/resumes';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const doc = (overrides: Partial<Resume>): Resume => ({
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
  ...overrides,
});

const handlers = {
  onRename: jest.fn(),
  onDuplicate: jest.fn(),
  onTailor: jest.fn(),
  onSetAsBase: jest.fn(),
  onDownload: jest.fn(),
  onShare: jest.fn(),
  onRequestDelete: jest.fn(),
  onConfirmDelete: jest.fn(),
  onCancelDelete: jest.fn(),
};

/**
 * All four variants render side by side in ONE tree, scoped with within() — both repeated
 * mounts and rerender proved able to wedge React's act queue in this environment (see the
 * plan's Phase 3 test-infra note). The component is pure, so co-rendering is free.
 */
describe('Resume card menu (RESUMES 03 — 1:2020)', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('walks every variant of the sheet', async () => {
    Object.values(handlers).forEach((handler) => handler.mockClear());
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <View testID="tailored">
          <ResumeMenuSheetBody resume={doc({})} step="actions" deleting={false} {...handlers} />
        </View>
        <View testID="base">
          <ResumeMenuSheetBody
            resume={doc({ id: 'res_base', title: 'Product Designer', isBase: true })}
            step="actions"
            deleting={false}
            {...handlers}
          />
        </View>
        <View testID="cover">
          <ResumeMenuSheetBody
            resume={doc({ id: 'res_cover', title: 'Stripe cover letter', docType: 'cover_letter' })}
            step="actions"
            deleting={false}
            {...handlers}
          />
        </View>
        <View testID="confirm">
          <ResumeMenuSheetBody
            resume={doc({})}
            step="confirm-delete"
            deleting={false}
            {...handlers}
          />
        </View>
      </SafeAreaProvider>,
    );

    // — Tailored resume: header + every artboard row —
    const tailored = within(screen.getByTestId('tailored'));
    expect(tailored.getByText('Stripe — Senior PD')).toBeOnTheScreen();
    expect(tailored.getByText('Tailored · Stripe · Senior Product Designer')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Rename')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Duplicate')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Tailor to a job, AI powered')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Set as base')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Download')).toBeOnTheScreen();
    expect(tailored.getByText('PDF · DOCX')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Share link')).toBeOnTheScreen();
    expect(tailored.getByLabelText('Delete')).toBeOnTheScreen();
    expect(tailored.getByText('Asks to confirm')).toBeOnTheScreen();

    fireEvent.press(tailored.getByLabelText('Duplicate'));
    expect(handlers.onDuplicate).toHaveBeenCalledTimes(1);
    fireEvent.press(tailored.getByLabelText('Set as base'));
    expect(handlers.onSetAsBase).toHaveBeenCalledTimes(1);

    // Delete only reports the request — the step swap is the host's job.
    fireEvent.press(tailored.getByLabelText('Delete'));
    expect(handlers.onRequestDelete).toHaveBeenCalledTimes(1);
    expect(handlers.onConfirmDelete).not.toHaveBeenCalled();

    // — The base resume itself cannot be re-based —
    const base = within(screen.getByTestId('base'));
    expect(base.queryByLabelText('Set as base')).toBeNull();
    expect(base.getByLabelText('Tailor to a job, AI powered')).toBeOnTheScreen();

    // — Cover letters lose the resume-only rows —
    const cover = within(screen.getByTestId('cover'));
    expect(cover.queryByLabelText(/^Tailor to a job/)).toBeNull();
    expect(cover.queryByLabelText('Set as base')).toBeNull();
    expect(cover.getByLabelText('Download')).toBeOnTheScreen();

    // — Confirm step: destructive copy and both ways out —
    const confirm = within(screen.getByTestId('confirm'));
    expect(confirm.getByRole('header', { name: 'Delete this resume?' })).toBeOnTheScreen();
    expect(confirm.getByText(/version history will be gone for good/)).toBeOnTheScreen();
    fireEvent.press(confirm.getByLabelText('Delete'));
    expect(handlers.onConfirmDelete).toHaveBeenCalledTimes(1);
    fireEvent.press(confirm.getByLabelText('Cancel'));
    expect(handlers.onCancelDelete).toHaveBeenCalledTimes(1);
  }, 30000);
});
