import { cn } from '@/lib/cn';
import { iconButton } from '@/ui/iconButton';

/**
 * The editor's small controls — move, rename, remove (owner, 2026-10-19: they were too small and
 * faint to see). One size everywhere: the app's round 36 px icon button with an 18 px glyph, quiet
 * at rest (tertiary ink) and full ink with a muted fill under the pointer; remove turns red only on
 * hover. `toolIcon` is the glyph's class.
 */
export const toolButton = cn(
  iconButton,
  'text-text-tertiary hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent',
);

export const removeButton = cn(toolButton, 'hover:bg-danger-50 hover:text-danger-text');

export const toolIcon = 'size-4.5';
