import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { LocationSheetBody, LocationSheetHost, useJobsStore } from '@/features/jobs';
import { CITY_LOCATION_OPTIONS } from '@/features/jobs/locationOptions';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const onSelect = jest.fn();
const onClose = jest.fn();

const INITIAL = useJobsStore.getState();

const press = (label: string) =>
  act(
    async () => void fireEvent.press(screen.getByLabelText(label, { includeHiddenElements: true })),
  );

const type = (text: string) =>
  act(async () => void fireEvent.changeText(screen.getByLabelText('Search locations'), text));

describe('Location picker — the body', () => {
  beforeEach(() => {
    onSelect.mockClear();
    onClose.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function renderBody(value = 'Bengaluru, India') {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LocationSheetBody value={value} onSelect={onSelect} onClose={onClose} />
      </SafeAreaProvider>,
    );
  }

  it('offers the two broad answers and every city, and marks the current one', async () => {
    await renderBody();

    expect(screen.getByRole('header', { name: 'Location' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Anywhere in India')).toBeOnTheScreen();
    expect(screen.getByLabelText('Remote only')).toBeOnTheScreen();
    for (const option of CITY_LOCATION_OPTIONS) {
      expect(screen.getByLabelText(option.value)).toBeOnTheScreen();
    }

    // The seeded location is the marked one; nothing else claims to be selected.
    expect(screen.getByLabelText('Bengaluru, India')).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(screen.getByLabelText('Pune, India')).toHaveProp('accessibilityState', {
      selected: false,
    });
    expect(screen.getByLabelText('Remote only')).toHaveProp('accessibilityState', {
      selected: false,
    });
  });

  it('marks a broad answer when that is what was chosen', async () => {
    await renderBody('Remote only');
    expect(screen.getByLabelText('Remote only')).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(screen.getByLabelText('Bengaluru, India')).toHaveProp('accessibilityState', {
      selected: false,
    });
  });

  it('narrows the list as you type, keeping the broad answers', async () => {
    await renderBody();
    await type('  PU  ');

    expect(screen.getByLabelText('Pune, India')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Mumbai, India')).toBeNull();
    // Neither broad answer contains "pu", and both are still offered.
    expect(screen.getByLabelText('Anywhere in India')).toBeOnTheScreen();
    expect(screen.getByLabelText('Remote only')).toBeOnTheScreen();
  });

  it('says so when no city matches, with the field and the broad answers intact', async () => {
    await renderBody();
    await type('zzzz');

    expect(screen.getByText('No places match')).toBeOnTheScreen();
    for (const option of CITY_LOCATION_OPTIONS) {
      expect(screen.queryByLabelText(option.value)).toBeNull();
    }
    // The way out of the empty state is still on screen: the field itself, and both answers
    // that no search term can rule out.
    expect(screen.getByLabelText('Search locations')).toBeOnTheScreen();
    expect(screen.getByLabelText('Anywhere in India')).toBeOnTheScreen();
    expect(screen.getByLabelText('Remote only')).toBeOnTheScreen();

    // And it recovers: clearing the box brings every city back.
    await type('');
    expect(screen.queryByText('No places match')).toBeNull();
    expect(screen.getByLabelText('Mumbai, India')).toBeOnTheScreen();
  });

  it('reports the exact string it was given, for a city and for a broad answer', async () => {
    await renderBody();

    await press('Hyderabad, India');
    expect(onSelect).toHaveBeenCalledWith('Hyderabad, India');

    await press('Anywhere in India');
    expect(onSelect).toHaveBeenLastCalledWith('Anywhere in India');
    // Choosing is the caller's business — the body never closes itself.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the ✕', async () => {
    await renderBody();
    await press('Close location');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('Location picker — the host', () => {
  beforeEach(() => {
    useJobsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await cleanup();
    useJobsStore.setState(INITIAL, true);
  });

  async function renderHost() {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LocationSheetHost />
      </SafeAreaProvider>,
    );
  }

  it('stays unmounted until the store opens it', async () => {
    await renderHost();
    expect(
      screen.queryByLabelText('Anywhere in India', { includeHiddenElements: true }),
    ).toBeNull();

    await act(async () => useJobsStore.getState().openLocation());
    expect(
      screen.getByLabelText('Anywhere in India', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('writes the chosen location to the store and closes', async () => {
    useJobsStore.getState().openLocation();
    await renderHost();

    await press('Pune, India');

    expect(useJobsStore.getState().location).toBe('Pune, India');
    expect(useJobsStore.getState().locationOpen).toBe(false);
  });

  it('closes without changing the location when the ✕ is used', async () => {
    useJobsStore.getState().openLocation();
    await renderHost();

    await press('Close location');

    expect(useJobsStore.getState().location).toBe(INITIAL.location);
    expect(useJobsStore.getState().locationOpen).toBe(false);
  });
});
