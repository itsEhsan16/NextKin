import type { Resume } from '@/data/models';
import { useResumesStore } from '@/features/resumes';
import { storage } from '@/lib';

const INITIAL = useResumesStore.getState();

const doc: Resume = {
  id: 'res_2',
  title: 'Stripe — Senior PD',
  docType: 'resume',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
  versionCount: 2,
  currentVersionId: 'ver_2_2',
  atsScore: 88,
  status: 'ready',
  tags: [],
};

describe('resumesStore', () => {
  beforeEach(() => {
    storage.remove('prefs.resumesView');
    useResumesStore.setState(INITIAL, true);
  });

  it('starts on the grid and persists the layout choice', () => {
    expect(useResumesStore.getState().viewMode).toBe('grid');

    useResumesStore.getState().setViewMode('list');
    expect(useResumesStore.getState().viewMode).toBe('list');
    // Written through to storage so the next launch restores it.
    expect(storage.get('prefs.resumesView')).toBe('list');
  });

  it('opens the menu on a snapshot and re-seeds the step every time', () => {
    const store = useResumesStore.getState();
    store.openMenu(doc);

    let state = useResumesStore.getState();
    expect(state.menuOpen).toBe(true);
    expect(state.menuResume?.id).toBe('res_2');
    expect(state.menuStep).toBe('actions');

    state.requestDelete();
    expect(useResumesStore.getState().menuStep).toBe('confirm-delete');

    // Closing keeps the snapshot so the sheet can finish its exit animation…
    useResumesStore.getState().closeMenu();
    state = useResumesStore.getState();
    expect(state.menuOpen).toBe(false);
    expect(state.menuResume?.id).toBe('res_2');

    // …and reopening starts back on the action list, not the abandoned confirm.
    state.openMenu(doc);
    expect(useResumesStore.getState().menuStep).toBe('actions');
  });

  it('backs out of the delete confirm without closing', () => {
    useResumesStore.getState().openMenu(doc);
    useResumesStore.getState().requestDelete();
    useResumesStore.getState().cancelDelete();

    const state = useResumesStore.getState();
    expect(state.menuStep).toBe('actions');
    expect(state.menuOpen).toBe(true);
  });
});
