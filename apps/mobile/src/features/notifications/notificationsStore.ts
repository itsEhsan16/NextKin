import { create } from 'zustand';

import type { Notification, NotificationFilter } from '@/data/models';

type NotificationsState = {
  /** The feed's active pill (Figma 1:2410). */
  filter: NotificationFilter;

  /**
   * Row-menu snapshot (NOTIF 03), retained after close so the sheet keeps painting through
   * its 200ms exit — the jobsStore draft / resumes menu pattern.
   */
  menuNotification: Notification | null;
  menuOpen: boolean;

  /**
   * Push primer (NOTIF 07), raised over Job Detail after an application is sent. The company
   * name personalises the headline; retained after close for the exit animation. Never
   * suppressed permanently — note 1:2939: "Not now" costs nothing and the primer may return
   * on a later application.
   */
  primerCompany: string | null;
  primerOpen: boolean;

  setFilter: (filter: NotificationFilter) => void;
  openMenu: (notification: Notification) => void;
  closeMenu: () => void;
  openPrimer: (company: string) => void;
  closePrimer: () => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  filter: 'all',
  menuNotification: null,
  menuOpen: false,
  primerCompany: null,
  primerOpen: false,

  setFilter: (filter) => set({ filter }),
  openMenu: (menuNotification) => set({ menuNotification, menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
  openPrimer: (primerCompany) => set({ primerCompany, primerOpen: true }),
  closePrimer: () => set({ primerOpen: false }),
}));
