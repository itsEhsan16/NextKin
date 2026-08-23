import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FloatingTabBar } from '@/navigation';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const routeNames = ['index', 'jobs', 'resumes', 'profile'];

function buildProps(index = 0) {
  const routes = routeNames.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const navigate = jest.fn();
  const props = {
    state: { index, routes, routeNames, key: 'tabs', type: 'tab', stale: false, history: [] },
    descriptors: Object.fromEntries(
      routes.map((route) => [route.key, { options: {}, route, navigation: {}, render: () => null }]),
    ),
    navigation: { emit, navigate },
    insets: metrics.insets,
  } as unknown as BottomTabBarProps;
  return { props, emit, navigate };
}

describe('FloatingTabBar', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('renders the four tabs with the active one selected', async () => {
    const { props } = buildProps(0);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FloatingTabBar {...props} />
      </SafeAreaProvider>,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Jobs' })).not.toBeSelected();
  });

  it('emits tabPress and navigates when an inactive tab is pressed', async () => {
    const { props, emit, navigate } = buildProps(0);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FloatingTabBar {...props} />
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByRole('tab', { name: 'Resumes' }));
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'resumes-key' }),
    );
    expect(navigate).toHaveBeenCalledWith('resumes', undefined);
  });

  it('does not navigate when the focused tab is pressed again', async () => {
    const { props, navigate } = buildProps(1);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FloatingTabBar {...props} />
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByRole('tab', { name: 'Jobs' }));
    expect(navigate).not.toHaveBeenCalled();
  });
});
