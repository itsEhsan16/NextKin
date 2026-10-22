import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CreateSheetBody, type CreateStep } from '@/features/create';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * The centre button is the assistant now (2026-10-04), so the create sheet closes from its own ✕
 * on either step. Each step is rendered as it is and never switched: under Jest a control that is
 * hidden while still pressed stalls React's act queue for whatever renders next, which is why
 * this lives apart from CreateSheet.test.tsx's step-switching flows.
 */
describe('Create sheet ✕', () => {
  afterEach(async () => {
    await cleanup();
  });

  it.each<CreateStep>(['root', 'resume'])('closes from the %s step', async (step) => {
    const onClose = jest.fn();
    const onAction = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CreateSheetBody
          step={step}
          onStepChange={jest.fn()}
          onAction={onAction}
          onClose={onClose}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(await screen.findByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });
});
