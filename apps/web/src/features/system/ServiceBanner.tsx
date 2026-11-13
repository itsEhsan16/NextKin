'use client';

import { useState } from 'react';

import { degradedMessages, useServiceStatus } from '@nextkin/shared/queries';

import { http, USES_BACKEND } from '@/lib/dataSource';
import { CloseIcon, WarningIcon } from '@/ui/icons';

const load = USES_BACKEND ? () => http.request('/health/features') : null;

/**
 * The degraded-mode banner (ImBackendImplementationPlan P13-02, R-09; SYS 04, 871:2): a dark
 * notice fixed to the bottom of the window so it never moves the page, with a warning glyph. It
 * says what is slow or paused and what still works; Dismiss hides it until the message
 * changes. In mock mode it never shows.
 */
export function ServiceBanner() {
  const status = useServiceStatus(load);
  const text = degradedMessages(status.data).join(' ');
  const [hidden, setHidden] = useState<string | null>(null);
  if (!text || hidden === text) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-banner flex justify-center px-4">
      <div className="flex max-w-reading animate-pop-in items-center gap-3 rounded-lg bg-surface-inverse py-2.5 pl-4 pr-2 text-body-m font-medium text-text-inverse shadow-popover">
        <WarningIcon aria-hidden className="size-4 shrink-0 text-warning-50" />
        <p className="min-w-0 flex-1">{text}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setHidden(text)}
          className="grid size-7 shrink-0 place-items-center rounded-sm bg-surface-inverse-hover text-text-inverse transition-colors duration-press ease-standard hover:text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-on-dark"
        >
          <CloseIcon aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
