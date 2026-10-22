import { queryPhase } from '@/data/queries';

describe('queryPhase', () => {
  it('is pending while a first load has nothing to show', () => {
    expect(queryPhase({ data: undefined, isPending: true, isError: false })).toBe('pending');
  });

  it('is an error only when there is nothing to show', () => {
    expect(queryPhase({ data: undefined, isPending: false, isError: true })).toBe('error');
  });

  it('keeps content on screen when a background refresh fails', () => {
    // TanStack keeps the last good data and raises isError beside it after a failed refetch.
    expect(queryPhase({ data: ['kept'], isPending: false, isError: true })).toBe('success');
  });

  it('treats an empty result as content, not as loading', () => {
    expect(queryPhase({ data: [], isPending: false, isError: false })).toBe('success');
    expect(queryPhase({ data: null, isPending: false, isError: false })).toBe('success');
  });
});
