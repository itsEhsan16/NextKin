'use client';

import type { Route } from 'next';
import { useSyncExternalStore } from 'react';

import { motion } from '@/theme/tokens';

/** What a toast reports: something done, something that failed, or plain news. */
export type ToastTone = 'success' | 'error' | 'info';

/** A next step carried by the toast — "View application" after Apply. */
/** Where the toast's one action goes, or what it does: "Open it", "Try again" (toreview §131). */
export type ToastAction = { label: string; href: Route } | { label: string; onClick: () => void };

export type ToastMessage = {
  /** Increases with every toast, so a repeat of the same words still reads as a new one. */
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

let current: ToastMessage | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

/**
 * Say what just happened (`toreview.md` §85). The web had no confirmation surface at all: a saved
 * setting, an application sent or a failed write changed the page silently, and a failure often
 * looked like the control flipping back on its own. One toast at a time; a new one replaces the
 * one showing and gets its full time.
 */
export function showToast(
  message: string,
  options: { tone?: ToastTone; action?: ToastAction } = {},
) {
  current = { id: nextId++, message, tone: options.tone ?? 'success', action: options.action };
  clearTimeout(timer);
  timer = setTimeout(
    dismissToast,
    options.action ? motion.delays.toastWithAction : motion.delays.toast,
  );
  emit();
}

/** Takes the showing toast down early (its ✕, or a test). */
export function dismissToast() {
  clearTimeout(timer);
  if (current == null) return;
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The toast showing right now, or null. Server renders never have one. */
export function useToast(): ToastMessage | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
