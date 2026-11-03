import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { TailorComparison } from '@/data/models';
import { initialChoices, type CustomizeChoices, type FixPlan } from '@/data/models/customize';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { CustomizePlan } from '@/features/create/components/CustomizePlan';

const clients: QueryClient[] = [];

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Two AI and you steps to 8.5, one past it, and an ask nobody can meet. Synthetic. */
const PLAN: FixPlan = {
  score: 6.2,
  parts: [],
  target: { goal: 8.5, ai: 6.9, ceiling: 8.8, reaches: true, steps: 3 },
  steps: [
    {
      id: 'summary',
      kind: 'summary',
      title: 'Write a summary aimed at this job',
      have: 'No summary',
      worth: 0.7,
      basis: 'The summary counts toward sections',
      who: 'ai',
      totalAfter: 6.9,
    },
    {
      id: 'kubernetes',
      kind: 'keyword',
      title: 'Add Kubernetes',
      need: 'Experience with Kubernetes',
      have: 'Not on your resume',
      worth: 1,
      basis: 'Only if you’ve used it',
      who: 'you',
      keyword: 'Kubernetes',
      importance: 'required',
      totalAfter: 7.9,
      where: 'role_1',
    },
    {
      id: 'figure',
      kind: 'number',
      title: 'Add the result to “Shipped the checkout”',
      have: 'No measured result yet',
      worth: 0.7,
      basis: 'Measured results count',
      who: 'you',
      totalAfter: 8.6,
      bullet: { roleId: 'role_1', index: 0, text: 'Shipped the checkout' },
    },
    {
      id: 'react',
      kind: 'evidence',
      title: 'Show React in a role',
      have: 'Only in your skills list — half credit',
      worth: 0.2,
      basis: 'A role showing it counts in full',
      who: 'you',
      keyword: 'React',
      importance: 'preferred',
      totalAfter: 8.8,
    },
    {
      id: 'years',
      kind: 'years',
      title: 'Go: 20+ years asked',
      have: 'Your roles show 3 years',
      worth: null,
      basis: 'Nothing honest can add those',
      who: 'nobody',
    },
  ],
};

const COMPARISON: TailorComparison = {
  resumeId: 'res_1',
  jdId: 'jd_1',
  score: 62,
  keywords: [],
  improvements: [
    { key: 'summary', label: 'Summary', detail: 'Worth another look', ok: false },
  ] as TailorComparison['improvements'],
  places: [
    { id: 'role_1', label: 'Designer · Stripe' },
    { id: 'role_2', label: 'Intern · Acme' },
  ],
  plan: PLAN,
};

let latest: CustomizeChoices;

function Harness({ comparison }: { comparison: TailorComparison }) {
  const [choices, setChoices] = useState<CustomizeChoices>(initialChoices);
  const change = (next: CustomizeChoices) => {
    latest = next;
    setChoices(next);
  };
  return <CustomizePlan comparison={comparison} choices={choices} onChange={change} />;
}

async function renderPlan(comparison: TailorComparison = COMPARISON) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <Harness comparison={comparison} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));
const press = (label: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));

describe('CustomizePlan (your plan to fit this job)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    latest = initialChoices();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.useRealTimers();
  });

  it('says how far the plan goes and marks where it reaches the goal', async () => {
    await renderPlan();

    expect(screen.getByRole('header', { name: 'Your plan to fit this job' })).toBeOnTheScreen();
    expect(screen.getByText('3 steps to reach 8.6/10')).toBeOnTheScreen();
    expect(screen.getByText('The AI’s own steps take it to 6.9/10')).toBeOnTheScreen();
    expect(screen.getByLabelText('8.5 is reached here')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        /^Add Kubernetes\. Required\. Only if you have it\. Adds 1\.0\. Score after this step 7\.9/,
      ),
    ).toBeOnTheScreen();
  });

  it('keeps past the top steps folded, and shows what nothing can change', async () => {
    await renderPlan();

    expect(screen.queryByText('Go: 20+ years asked')).toBeNull();
    await press('Show all 5 steps');
    await settle();
    expect(screen.getByText('Go: 20+ years asked')).toBeOnTheScreen();
    expect(screen.getByText('Nothing to change')).toBeOnTheScreen();
  });

  it('ticks without a role, counts the answer, and lets the person say where (§159)', async () => {
    await renderPlan();

    // The plan's pick is not applied: the run would list it in Skills only.
    await press('I have Kubernetes');
    expect(latest.added).toEqual(['Kubernetes']);
    expect(latest.places.Kubernetes).toBeUndefined();
    expect(screen.getByText('In your Skills only: counts half')).toBeOnTheScreen();

    await press('Used Kubernetes at Intern · Acme');
    expect(latest.places.Kubernetes).toEqual({ where: 'role_2', note: '', by: 'you' });
    expect(screen.getByText('Counts in full')).toBeOnTheScreen();

    // A skill in the list alone counts half, as the score counts it.
    await press('Skills only (counts half)');
    expect(latest.added).toEqual(['Kubernetes']);
    expect(latest.places).toEqual({});
    expect(screen.getByText('In your Skills only: counts half')).toBeOnTheScreen();
    expect(screen.getByText('With your answers so far: about 7.4/10')).toBeOnTheScreen();

    await press('I have Kubernetes');
    expect(latest.added).toEqual([]);
    expect(screen.queryByLabelText('Used Kubernetes at Intern · Acme')).toBeNull();
  });

  it('takes a figure only once the line states a result', async () => {
    await renderPlan();

    await press('Add the result');
    expect(screen.getByText('The AI is fitting a result into this line…')).toBeOnTheScreen();
    await settle();

    expect(screen.getByText('Fill in the real result')).toBeOnTheScreen();
    expect(screen.getByLabelText('Use this line')).toBeDisabled();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText(/^The result:/), 'a better checkout'),
    );
    expect(screen.getByLabelText('Use this line')).toBeDisabled();

    await act(async () => fireEvent.changeText(screen.getByLabelText(/^The result:/), '30%'));
    expect(screen.getByText('Counts as a measured result')).toBeOnTheScreen();

    await press('Use this line');
    expect(latest.figures).toEqual({ 'role_1#0': 'Shipped the checkout, improving 30%.' });
    expect(screen.getByText('Your figure is in')).toBeOnTheScreen();

    await press('Edit your figure');
    await press('Keep the original');
    expect(latest.figures).toEqual({});
    expect(screen.getByLabelText('Add the result')).toBeOnTheScreen();
  });

  it('lets the person write the whole line', async () => {
    await renderPlan();

    await press('Add the result');
    await settle();
    await press('Write it myself');
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Rewrite this line with its real result'),
        'Cut checkout time by 40%',
      ),
    );
    await press('Use this line');
    expect(latest.figures).toEqual({ 'role_1#0': 'Cut checkout time by 40%' });
  });

  it('gives the honest ceiling, and why, when the goal is out of reach', async () => {
    await renderPlan({
      ...COMPARISON,
      plan: { ...PLAN, target: { goal: 8.5, ai: 6.9, ceiling: 7.5, reaches: false, steps: null } },
    });

    expect(screen.getByText('Best possible for this job: 7.5/10')).toBeOnTheScreen();
    expect(screen.getByText(/^Short of 8\.5 only because the job asks/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('8.5 is reached here')).toBeNull();
  });

  it('falls back to the list of fixes with no plan', async () => {
    const { plan: _plan, ...unscored } = COMPARISON;
    await renderPlan(unscored);

    expect(screen.getByRole('header', { name: 'What to improve' })).toBeOnTheScreen();
    expect(screen.queryByText('Your plan to fit this job')).toBeNull();
  });
});
