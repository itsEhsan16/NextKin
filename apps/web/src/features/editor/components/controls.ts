import { cn } from '@/lib/cn';
import { iconButton } from '@/ui/iconButton';

/**
 * The editor's small controls — move, rename, remove (owner, 2026-10-19: they were too small and
 * faint to see). One size everywhere: a 36 px target, an 18 px glyph in the secondary ink, a
 * visible hover; remove turns red only on hover. `toolIcon` is the glyph's class.
 */
export const toolButton = cn(
  iconButton,
  'size-9 shrink-0 rounded-md text-text-secondary hover:text-text-primary disabled:opacity-35 disabled:hover:bg-transparent',
);

export const removeButton = cn(toolButton, 'hover:bg-danger-50 hover:text-danger-text');

export const toolIcon = 'size-[18px]';
