import { act, cleanup, render, renderHook, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FLOW_ART, FlowHero } from '@/features/create/components/FlowHero';
import { UploadProgress } from '@/features/create/components/UploadProgress';
import { StepGlyph, SuccessMark, TypingDots, useBecameTrue } from '@/ui/motion';
import { AppToastHost, showAppToast, Toast, useAppToast } from '@/ui/Toast';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('§85 feedback primitives', () => {
  afterEach(async () => {
    await cleanup();
    jest.mocked(Haptics.notificationAsync).mockClear();
    await act(async () => useAppToast.getState().hide());
  });

  describe('useBecameTrue', () => {
    it('is false for something already true when the component mounted (a revisit)', async () => {
      const { result } = await renderHook(() => useBecameTrue(true));
      expect(result.current).toBe(false);
    });

    it('turns true once the value turns true while mounted (a run finishing on screen)', async () => {
      let value = false;
      const { result, rerender } = await renderHook(() => useBecameTrue(value));
      expect(result.current).toBe(false);

      value = true;
      await rerender({});
      expect(result.current).toBe(true);
    });
  });

  describe('Toast tones', () => {
    it('never vibrates, for a failure or a success (§191)', async () => {
      const hide = jest.fn();
      await render(
        <SafeAreaProvider initialMetrics={metrics}>
          <Toast visible message="Saved" onHide={hide} />
        </SafeAreaProvider>,
      );
      await screen.rerender(
        <SafeAreaProvider initialMetrics={metrics}>
          <Toast visible tone="error" message="The download failed." onHide={hide} />
        </SafeAreaProvider>,
      );
      expect(screen.getByText('The download failed.')).toBeOnTheScreen();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('raises the app-wide toast from anywhere', async () => {
      await render(
        <SafeAreaProvider initialMetrics={metrics}>
          <AppToastHost />
        </SafeAreaProvider>,
      );
      expect(screen.queryByText('Experience saved')).toBeNull();

      await act(async () => showAppToast('Experience saved'));
      expect(screen.getByText('Experience saved')).toBeOnTheScreen();
    });
  });

  describe('motion pieces render in every state', () => {
    it('draws each step state and the success mark', async () => {
      await render(
        <>
          <StepGlyph state="todo" size={20} />
          <StepGlyph state="current" size={20} />
          <StepGlyph state="done" size={20} />
          <StepGlyph state="left" size={20} />
          <SuccessMark size={24} />
          <SuccessMark size={44} variant="tile" animate={false} />
          <TypingDots size={5} />
        </>,
      );
      // Decorative: nothing here reaches a screen reader on its own.
      expect(screen.queryAllByRole('image')).toHaveLength(0);
    });

    it('lays the live overlays on the run art without touching its copy', async () => {
      await render(
        <>
          <FlowHero
            title="Checking your resume"
            lede="Lede"
            art={FLOW_ART.atsChecking}
            motif="scan"
            active
          />
          <FlowHero
            title="Writing your resume"
            lede="Lede"
            art={FLOW_ART.tailorWriting}
            motif="write"
            active
          />
        </>,
      );
      expect(screen.getByText('Checking your resume')).toBeOnTheScreen();
      expect(screen.getByText('Writing your resume')).toBeOnTheScreen();
    });
  });

  describe('UploadProgress', () => {
    it('says the parse landed: every step ticks and the caption says so', async () => {
      await render(<UploadProgress fileName="resume.pdf" done />);

      expect(screen.getByText('Read it all')).toBeOnTheScreen();
      expect(screen.getByLabelText('Parsing, Read it all')).toBeOnTheScreen();
    });
  });
});
