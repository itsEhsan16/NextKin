import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Resume } from '@/data/models';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ExportSheetBody } from '@/features/resumes';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const onSelect = jest.fn();
const onUpgrade = jest.fn();

/** The rows enter on FadeInDown, which the Reanimated mock leaves sitting at opacity 0. */
const hidden = { includeHiddenElements: true } as const;

const baseDoc = (): Resume => {
  const doc = mockStore.state.resumes.find((resume) => resume.id === 'res_base');
  if (!doc) throw new Error('fixture doc res_base missing');
  return doc;
};

/** Pressable's own press state has to settle before the next rerender is read. */
const press = (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label, hidden)));

/** One mount, re-rendered through the plans — see the test-infra note in the plan's Phase 3. */
describe('ExportSheetBody (V2 §7.12 — the download sheet)', () => {
  beforeEach(() => {
    resetMockRepos();
    onSelect.mockClear();
    onUpgrade.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('offers three formats, sells DOCX on free, exports it on Pro, and runs one at a time', async () => {
    const resume = baseDoc();
    const body = (plan: 'free' | 'pro', busyFormat: 'pdf' | null) => (
      <SafeAreaProvider initialMetrics={metrics}>
        <ExportSheetBody
          resume={resume}
          plan={plan}
          busyFormat={busyFormat}
          onSelect={onSelect}
          onUpgrade={onUpgrade}
        />
      </SafeAreaProvider>
    );
    const { rerender } = await render(body('free', null));

    // — The header names the document; the sheet around it is the one that says "Download" —
    expect(screen.getByRole('header', { name: resume.title })).toBeOnTheScreen();

    // — Three formats, in §7.12's order —
    expect(screen.getByLabelText('Export as PDF', hidden)).toBeOnTheScreen();
    expect(screen.getByLabelText('Export as TXT', hidden)).toBeOnTheScreen();
    // §13.3: the clean PDF is free on every plan, and the row says so.
    expect(screen.getByText('Clean, watermark-free — always free', hidden)).toBeOnTheScreen();
    expect(screen.getByText("Plain text for a portal's paste box", hidden)).toBeOnTheScreen();

    // — Free: DOCX is the one gated format, and SheetRow composes the gate into its name —
    expect(screen.getByLabelText('Export as DOCX, Pro feature', hidden)).toBeOnTheScreen();
    expect(
      screen.getByText('Pro unlocks Word files for portals that ask for one', hidden),
    ).toBeOnTheScreen();

    // §13.5: the upsell REPLACES the action — no export starts behind it.
    await press('Export as DOCX, Pro feature');
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();

    // — PDF and TXT are ungated on the same plan —
    await press('Export as PDF');
    expect(onSelect).toHaveBeenCalledWith('pdf');
    await press('Export as TXT');
    expect(onSelect).toHaveBeenCalledWith('txt');
    onSelect.mockClear();

    // — Pro: the same row loses the lock and exports —
    await rerender(body('pro', null));
    expect(screen.queryByLabelText('Export as DOCX, Pro feature', hidden)).not.toBeOnTheScreen();
    await press('Export as DOCX');
    expect(onSelect).toHaveBeenCalledWith('docx');
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    onSelect.mockClear();

    // — One tap, one file: while the PDF renders, no row starts a second —
    await rerender(body('pro', 'pdf'));
    expect(screen.getByText('Preparing your file…', hidden)).toBeOnTheScreen();
    await press('Export as PDF');
    await press('Export as TXT');
    await press('Export as DOCX');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  }, 60000);
});
