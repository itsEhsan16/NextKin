import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';

const TONE = {
  info: 'border-info-600/30 bg-info-50 text-info-600',
  warning: 'border-warning-600/30 bg-warning-50 text-warning-600',
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
} as const;

/**
 * The People boards' banner (Figma 406:2525 "Content is private by default", 408:2843, 408:2148):
 * a glyph, an optional bold first line and the message, on the tone's tint with a hairline.
 */
export function Notice({
  tone,
  icon,
  title,
  children,
  className,
}: {
  tone: keyof typeof TONE;
  icon: AdminIconName;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3.5 text-body-s',
        TONE[tone],
        className,
      )}
    >
      <AdminIcon name={icon} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <p>{children}</p>
      </div>
    </div>
  );
}
