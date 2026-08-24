import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { CreateSheetBody, type CreateAction, type CreateStep } from '@/features/create';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { useCreateSheet } from './createSheet';

/** Figma: CREATE 01 is a 600px sheet, CREATE 02 a 520px one. */
const STEP_HEIGHT: Record<CreateStep, 'sheetStep1Height' | 'sheetStep2Height'> = {
  root: 'sheetStep1Height',
  resume: 'sheetStep2Height',
};

/**
 * Mounts the global "+" sheet once, above the tab navigator and below the FAB.
 *
 * The two steps are panes of one sheet (canvas note 1:1365), so switching step slides the
 * track horizontally while the sheet morphs its own height — both on the UI thread.
 */
export function CreateSheetHost() {
  const { isOpen, close, progress } = useCreateSheet();
  const { sizes, motion } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<CreateStep>('root');

  // Reopening always starts at step 1. Reset after the exit animation so the pane does not
  // visibly snap back while the sheet is still on screen.
  useEffect(() => {
    if (isOpen) return;
    // Wait out the exit animation so the pane does not visibly snap back mid-dismiss.
    const id = setTimeout(() => setStep('root'), motion.durations.sheetOut + 50);
    return () => clearTimeout(id);
  }, [isOpen, motion.durations.sheetOut]);

  const handleAction = useCallback(
    (action: Exclude<CreateAction, 'new-resume'>) => {
      close();
      router.push({ pathname: '/placeholder/[screen]', params: { screen: action } });
    },
    [close, router],
  );

  const height = sizes[STEP_HEIGHT[step]];

  return (
    <Sheet
      open={isOpen}
      onClose={close}
      height={height}
      progress={progress}
      accessibilityLabel={step === 'root' ? 'Create' : 'New resume'}
      contentStyle={{ paddingTop: 13 }}
    >
      <CreateSheetBody step={step} onStepChange={setStep} onAction={handleAction} />
    </Sheet>
  );
}
