import type {
  ReportAction,
  ReportCategory,
  ReportStatus,
  ReportedItem,
} from '@nextkin/shared/models';

import type { AdminIconName } from '@/ui/animated/iconMap';

import type { AdminBadgeTone } from '../../ui/AdminBadge';
import type { RadioOption } from '../../ui/AdminForm';
import { masked } from '../trustFormat';

export const STATUS: Record<ReportStatus, { label: string; tone: AdminBadgeTone }> = {
  open: { label: 'Open', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

/**
 * Each category's glyph in the report card. The board draws Impersonation with UserX01 (Figma
 * 407:1366); the other three are this build's choice (`toreview.md` §171).
 */
export const CATEGORY_ICON: Record<ReportCategory, AdminIconName> = {
  impersonation: 'UserX01',
  spam: 'Mail01',
  harassment: 'AlertTriangle',
  copyright: 'File06',
};

export const itemRef = (item: ReportedItem) =>
  masked(item.kind === 'public_link' ? 'link' : 'resume', item.ref);

export const itemKind = (item: ReportedItem) =>
  item.kind === 'public_link' ? 'Public link' : 'Shared resume';

/**
 * The reason codes each action asks for. "Each action asks for a reason code" (Figma 407:1418);
 * the board draws none of the dialogs, so the dismiss and disable codes are this build's, and
 * the suspension's are the Suspend user dialog's (407:2715), which the server accepts.
 */
export const REASONS: Record<ReportAction, RadioOption<string>[]> = {
  dismiss: [
    {
      id: 'not_a_violation',
      label: 'Not a violation',
      description: 'The item follows the content rules',
    },
    {
      id: 'duplicate',
      label: 'Duplicate report',
      description: 'Another report about this item is already settled',
    },
    {
      id: 'insufficient',
      label: 'Not enough to act on',
      description: 'The report doesn’t show what is wrong',
    },
  ],
  disable_link: [
    {
      id: 'impersonation',
      label: 'Impersonation',
      description: 'It presents someone else as the owner',
    },
    { id: 'spam', label: 'Spam', description: 'Advertising or content that isn’t a resume' },
    { id: 'harassment', label: 'Harassment', description: 'It targets or abuses a person' },
    { id: 'copyright', label: 'Copyright', description: 'It copies work the owner doesn’t hold' },
    { id: 'other', label: 'Other', description: 'Explain in the internal note' },
  ],
  suspend_owner: [
    { id: 'abuse', label: 'Abuse', description: 'Harassment, spam or misuse of the AI tools' },
    { id: 'fraud', label: 'Fraud', description: 'Stolen card, fake identity or account farming' },
    {
      id: 'legal',
      label: 'Legal',
      description: 'Court order, regulator or law-enforcement request',
    },
    { id: 'other', label: 'Other', description: 'Explain in the internal note' },
  ],
};

/** How a settled report's reason reads: the dialog's label for its code, else as stored. */
export const reasonLabel = (action: ReportAction, reason: string) =>
  REASONS[action].find((option) => option.id === reason)?.label ?? reason;

export const ACTION_COPY: Record<
  ReportAction,
  {
    title: string;
    confirm: string;
    done: string;
    icon: AdminIconName;
    tone: 'neutral' | 'warning' | 'danger';
  }
> = {
  dismiss: {
    title: 'Dismiss this report?',
    confirm: 'Dismiss report',
    done: 'dismissed',
    icon: 'XClose',
    tone: 'neutral',
  },
  disable_link: {
    title: 'Disable the public link?',
    confirm: 'Disable link',
    done: 'link disabled',
    icon: 'Link01',
    tone: 'warning',
  },
  suspend_owner: {
    title: 'Suspend the owner?',
    confirm: 'Suspend user',
    done: 'owner suspended',
    icon: 'UserX01',
    tone: 'danger',
  },
};
