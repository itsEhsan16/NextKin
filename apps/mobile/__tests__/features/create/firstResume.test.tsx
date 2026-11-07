import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Resume } from '@/data/models';
import { firstResumeAsked, firstResumeStage } from '@/features/create/firstResume';
import { FirstResumeScreen, QuickSetupScreen } from '@/features/create';
import {
  FIRST_RESUME_NONE,
  FIRST_RESUME_TITLE,
  FIRST_RESUME_UPLOAD,
} from '@/features/create/screens/FirstResumeScreen';
import { useSetupAnswers } from '@/features/create/setupAnswers';

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn(), canGoBack: () => true }),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const resume = (over: Partial<Resume>): Resume =>
  ({ id: 'r', title: 'Resume', docType: 'resume', status: 'ready', updatedAt: '2026-01-01', ...over }) as Resume;

describe('firstResumeStage (V2 §7.2)', () => {
  it('starts at adding a resume', () => {
    expect(firstResumeStage([], 0)).toBe('add-resume');
  });

  it('moves on with a resume, or with roles in the profile', () => {
    expect(firstResumeStage([resume({})], 0)).toBe('pick-job');
    expect(firstResumeStage([], 2)).toBe('pick-job');
  });

  it('ends with a resume made for a job', () => {
    expect(firstResumeStage([resume({ targetCompany: 'Acme' })], 0)).toBe('done');
    expect(firstResumeStage([resume({ targetRole: 'Designer' })], 0)).toBe('done');
  });

  it('does not count a cover letter, a draft, an archived resume or one still being made', () => {
    expect(firstResumeStage([resume({ docType: 'cover_letter', targetCompany: 'Acme' })], 0)).toBe('add-resume');
    expect(firstResumeStage([resume({ draft: true })], 0)).toBe('add-resume');
    expect(firstResumeStage([resume({ archived: true })], 0)).toBe('add-resume');
    expect(firstResumeStage([resume({ status: 'generating', targetCompany: 'Acme' })], 0)).toBe('add-resume');
  });
});

describe('the first-resume screen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
  });
  afterEach(() => cleanup());

  const open = () =>
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FirstResumeScreen />
      </SafeAreaProvider>,
    );

  it('offers two choices as step 2 of 2', async () => {
    await open();
    expect(screen.getByRole('header', { name: FIRST_RESUME_TITLE })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 2 of 2')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: FIRST_RESUME_UPLOAD })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: FIRST_RESUME_NONE })).toBeOnTheScreen();
  });

  it('uploading leads on to the job', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText(FIRST_RESUME_UPLOAD));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/create/upload', params: { next: 'job' } });
  });

  it('no resume starts from nothing', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText(FIRST_RESUME_NONE));
    expect(mockReplace).toHaveBeenCalledWith('/create/zero-resume');
  });

  it('skipping goes back to Home', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Skip'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('counts as the question asked, so Home never asks it again (§186)', async () => {
    firstResumeAsked.reset();
    await open();
    expect(firstResumeAsked.wasAsked()).toBe(true);
    firstResumeAsked.reset();
  });
});

describe('the quick setup screen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useSetupAnswers.getState().reset();
  });
  afterEach(() => {
    cleanup();
    useSetupAnswers.getState().reset();
  });

  const open = () =>
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QuickSetupScreen />
      </SafeAreaProvider>,
    );

  it('saves a one-tap role and band, then moves to step 2', async () => {
    await open();
    expect(screen.getByLabelText('Step 1 of 2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Product Designer'));
    await fireEvent.press(screen.getByLabelText('3–5 yrs'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(useSetupAnswers.getState()).toMatchObject({
      role: 'Product Designer',
      years: '3-5',
      done: true,
    });
    expect(mockReplace).toHaveBeenCalledWith('/create/start');
  });

  it('can be skipped', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Skip'));
    expect(useSetupAnswers.getState().done).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/create/start');
  });
});
