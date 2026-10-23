import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { CreateSheetBody, type CreateAction, type CreateStep } from '@/features/create';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { useCreateSheet } from './createSheet';

type CreateHref =
  | '/create/tailor'
  | '/create/cover-letter'
  | '/create/ats-check'
  | '/create/upload'
  | '/create/import-linkedin'
  | '/resumes/new';

/**
 * Where each row of the sheet goes. Every row has a real screen now (Phases 9B and 9D), so this
 * is a total map rather than a special case in front of a placeholder push — adding a row without
 * a destination stops compiling instead of shipping a dead tap.
 */
const CREATE_ROUTES: Record<Exclude<CreateAction, 'new-resume'>, CreateHref> = {
  'tailor-to-a-job': '/create/tailor',
  'cover-letter': '/create/cover-letter',
  'ats-check': '/create/ats-check',
  'upload-resume': '/create/upload',
  'import-linkedin': '/create/import-linkedin',
  'start-from-scratch': '/resumes/new',
};

/** Figma: CREATE 01 is a 600 sheet, CREATE 02 a 555 one (95:1288 / 95:1472, 450 and 416 at 390). */
const STEP_HEIGHT: Record<CreateStep, 'sheetStep1Height' | 'sheetStep2Height'> = {
  root: 'sheetStep1Height',
  resume: 'sheetStep2Height',
};

/**
 * Mounts the create sheet once, over the tab bar and the centre button like every other hosted
 * sheet, now that the centre button is the assistant rather than this sheet's toggle. Home's
 * create tile and Resumes' "+ New" raise it; its own ✕, the scrim, a swipe and Android back
 * close it.
 *
 * The two steps are panes of one sheet (canvas note 1:1365), so switching step slides the
 * track horizontally while the sheet morphs its own height — both on the UI thread.
 */
export function CreateSheetHost() {
  const { isOpen, close, progress } = useCreateSheet();
  const { sizes, motion, s } = useTheme();
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
      router.push(CREATE_ROUTES[action]);
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
      contentStyle={{ paddingTop: s(13) }}
    >
      <CreateSheetBody step={step} onStepChange={setStep} onAction={handleAction} onClose={close} />
    </Sheet>
  );
}
