import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';

import type { MockMode } from '@nextkin/shared/mock';

import { OnboardingFrame } from '@/features/onboarding/components/OnboardingFrame';

import { renderWithQuery, SETTLE_MS } from './render';

/** Shared by the onboarding suites. Each suite mocks `next/navigation` itself, for its pathname. */

export const wait = { timeout: SETTLE_MS.normal * 4 };

/** A step's screen inside the frame, as its route renders it. */
export const renderInFrame = (ui: ReactElement, mode: MockMode = 'normal') =>
  renderWithQuery(<OnboardingFrame>{ui}</OnboardingFrame>, mode);

export const card = () => screen.getByRole('region', { name: 'Your profile so far' });
export const row = (label: string) => within(card()).getByText(label).parentElement as HTMLElement;
export const continueButton = () => screen.getByRole('button', { name: /Continue/ });
