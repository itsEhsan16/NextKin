import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import {
  CREATE_RESUME_ROWS,
  CREATE_ROOT_ROWS,
  CreateSheetBody,
  MAX_ROWS,
  type CreateStep,
} from '@/features/create';
import { lightTheme } from '@/theme';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const onAction = jest.fn();

/** Mirrors CreateSheetHost: the host owns the step, the body only requests changes. */
function Harness() {
  const [step, setStep] = useState<CreateStep>('root');
  return <CreateSheetBody step={step} onStepChange={setStep} onAction={onAction} />;
}

/**
 * Real timers on purpose. Rows enter with FadeInDown.delay(i * stagger.row), so a row whose
 * entrance has not started is still outside the accessibility tree — every test therefore opens
 * with an async `findBy*` that waits for the pane to settle rather than racing it. (Wrapping
 * `fireEvent` in `act` would overlap RNTL's own act scope, so presses stay bare.)
 *
 * Reanimated's layout-animation callbacks land outside act() under Jest and log two harmless
 * "overlapping act()" warnings from this suite; the assertions are deterministic regardless.
 */
async function renderSheet() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Harness />
    </SafeAreaProvider>,
  );
}

describe('Create sheet (CREATE 01 / CREATE 02)', () => {
  beforeEach(() => {
    onAction.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renders the three CREATE 01 rows of the one-flow decision (toreview §114)', async () => {
    await renderSheet();

    expect(await screen.findByLabelText(/^Check my resume/)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Create' })).toBeOnTheScreen();
    expect(screen.getByText('Tailor to a job')).toBeOnTheScreen();
    expect(screen.getByText('Add a job and get your resume made for it')).toBeOnTheScreen();
    expect(screen.getByText('Score your resume against a job')).toBeOnTheScreen();
    expect(screen.getByText('New resume')).toBeOnTheScreen();
    expect(screen.getByText('Start fresh or import your existing resume')).toBeOnTheScreen();
    expect(screen.queryByText('Cover Letter')).toBeNull();
  });

  it('marks only the AI action with the AI badge', async () => {
    await renderSheet();
    await screen.findByLabelText(/^Check my resume/);

    // The badge is folded into the row's own label rather than being a separate focus stop,
    // so a screen reader announces it once: "Tailor to a job, AI powered, button".
    expect(screen.getByLabelText(/^Tailor to a job, AI powered/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^New resume, AI powered/)).toBeNull();
    expect(screen.queryByLabelText(/^Check my resume, AI powered/)).toBeNull();
    // ...and never as a nested element of its own.
    expect(screen.queryAllByLabelText('AI powered')).toHaveLength(0);
  });

  it('pushes to CREATE 02 in the same sheet and comes back via Back', async () => {
    await renderSheet();

    fireEvent.press(await screen.findByLabelText(/^New resume/));

    expect(await screen.findByRole('header', { name: 'New resume' })).toBeOnTheScreen();
    expect(await screen.findByLabelText(/^Start from scratch/)).toBeOnTheScreen();
    expect(screen.getByText('Upload PDF or DOCX')).toBeOnTheScreen();
    expect(screen.getByText('Import from LinkedIn')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Content first — you pick a template after your resume has something in it.',
      ),
    ).toBeOnTheScreen();
    // The push is internal to the sheet — it must not fire a navigation action.
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(await screen.findByRole('header', { name: 'Create' })).toBeOnTheScreen();
  });

  it('reports row selections to the host', async () => {
    await renderSheet();

    fireEvent.press(await screen.findByLabelText(/^Check my resume/));
    expect(onAction).toHaveBeenCalledWith('ats-check');

    fireEvent.press(screen.getByLabelText(/^New resume/));
    fireEvent.press(await screen.findByLabelText(/^Upload PDF or DOCX/));
    expect(onAction).toHaveBeenCalledWith('upload-resume');
  });

  it('staggers rows within the 50-100ms window the canvas note specifies', () => {
    // Note 1:1364: "rows stagger in 50–100ms apart".
    expect(lightTheme.motion.stagger.row).toBeGreaterThanOrEqual(50);
    expect(lightTheme.motion.stagger.row).toBeLessThanOrEqual(100);
  });

  it('honours the max-5-rows ceiling from the canvas note', () => {
    // Note 1:1365: "Max 5 rows ever."
    expect(CREATE_ROOT_ROWS.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(CREATE_RESUME_ROWS.length).toBeLessThanOrEqual(MAX_ROWS);
    // Row 5 ("Add a job manually") stays out until the Release 2 tracker ships.
    expect(CREATE_ROOT_ROWS.map((row) => row.label)).not.toContain('Add a job manually');
  });
});
