import { useId, type ComponentType, type ReactNode, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { iconButton } from '@/ui/iconButton';
import { ChevronRightIcon } from '@/ui/icons';

import { settingsList, settingsRow } from './InfoList';

export type SettingRowProps = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  /** The line under the title. A status sentence can stand in for it. */
  line: ReactNode;
  /**
   * What sits on the right: a switch, a menu, a button or a chevron. Given as a function it gets
   * the line's id, so the control can point `aria-describedby` at it and a screen reader hears
   * what the setting does, not only its name.
   */
  control?: ReactNode | ((lineId: string) => ReactNode);
};

/**
 * The bordered list a Privacy & data card's rows sit in, a hairline between each (466:530), as
 * the Account cards' fact tables are drawn (`InfoList`).
 */
export const SETTING_LIST = settingsList;

/**
 * One row of a Privacy & data card: a duotone glyph (466:532-739), a title with its line, and the
 * row's control on the right. The list it sits in draws the hairline between rows.
 */
export function SettingRow({ Icon, title, line, control }: SettingRowProps) {
  const lineId = useId();

  return (
    <li className={cn('flex items-center gap-4', settingsRow)}>
      <span aria-hidden className="flex w-9 shrink-0 justify-center">
        <Icon className="h-auto max-h-7 w-9" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-m font-semibold text-text-primary">{title}</p>
        <p id={lineId} className="mt-0.5 text-body-s text-text-tertiary">
          {line}
        </p>
      </div>
      {control != null && (
        <div className="shrink-0">{typeof control === 'function' ? control(lineId) : control}</div>
      )}
    </li>
  );
}

export type RowChevronProps = {
  label: string;
  onClick?: () => void;
  /** The row's line, read after the name. */
  describedBy?: string;
};

/**
 * A row's chevron (Privacy & data's "Manage data preferences" and "Active sessions"). It carries
 * no words, so it is named for where it goes.
 */
export function RowChevron({ label, onClick, describedBy }: RowChevronProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-describedby={describedBy}
      onClick={onClick}
      className={cn(iconButton, 'text-text-tertiary hover:text-text-secondary')}
    >
      <ChevronRightIcon aria-hidden className="size-4" />
    </button>
  );
}
