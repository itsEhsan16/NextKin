import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { TailorComparison } from '@/data/models';
import { initialChoices, projectedScore, type CustomizeChoices } from '@/data/models/customize';
import { PlanQuestions } from '@/features/create/flow/PlanQuestions';

/** "Answer to reach 10" (§202): the plan's skill questions, asked before the build. Synthetic. */

const comparison = {
  resumeId: 'r',
  jdId: 'j',
  score: 60,
  keywords: [],
  improvements: [],
  places: [
    { id: 'now', label: 'Backend Developer · Lumen' },
    { id: 'before', label: 'Intern · Acme' },
  ],
  plan: {
    score: 6,
    parts: [],
    steps: [
      { id: 'ev:kafka', kind: 'evidence', title: 'Show Kafka in a role', have: '', worth: 0.6, basis: '', who: 'you', keyword: 'Kafka' },
      { id: 'kw:redis', kind: 'keyword', title: 'Redis', have: '', worth: 0.4, basis: '', who: 'you', keyword: 'Redis' },
    ],
    target: { goal: 10, ai: 9, ceiling: 10, reaches: true, steps: 2 },
  },
} as unknown as TailorComparison;

let latest: CustomizeChoices = initialChoices();

function Harness() {
  const [choices, setChoices] = useState<CustomizeChoices>(initialChoices());
  latest = choices;
  return (
    <PlanQuestions
      comparison={comparison}
      goal={10}
      projected={projectedScore(comparison.plan, choices)}
      choices={choices}
      onChange={setChoices}
    />
  );
}

describe('PlanQuestions', () => {
  it('asks which role used a listed skill and whether a missing one was used, and a role answers it', async () => {
    await render(<Harness />);
    expect(screen.getByText('You list Kafka. Which role used it?')).toBeOnTheScreen();
    expect(screen.getByText('Have you used Redis?')).toBeOnTheScreen();
    expect(screen.getByText(/answer 2 more/)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getAllByText('Backend Developer · Lumen')[0]!));
    expect(latest.places.Kafka?.where).toEqual(['now']);
    expect(latest.added).toContain('Kafka');

    await act(async () => fireEvent.press(screen.getByText('No')));
    expect(latest.added).not.toContain('Redis');
    expect(screen.getByText(/Projected 9.6\/10 with your answers/)).toBeOnTheScreen();
  });
});
