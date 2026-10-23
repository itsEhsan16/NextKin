/**
 * The motion every dropdown in the app shares (`toreview.md` §84), as whole class strings:
 * Tailwind reads class names from the source text, so these can't be assembled at runtime
 * (`__tests__/ui/menuMotion.test.ts` holds that).
 */

/**
 * The menu surface: grows in from the trigger's side and fades, and leaves the same way. Radix
 * keeps a closing menu mounted until its exit animation ends.
 */
export const menuSurfaceMotion =
  'origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out';

/** On a menu's trigger: names the group its chevron watches. */
export const menuTrigger = 'group/trigger';

/** On the trigger's chevron: turns over while its menu is open (your call, §84). */
export const chevronTurn =
  'transition-[rotate,color] duration-fast ease-standard group-data-[state=open]/trigger:rotate-180';

/** A picked row's tick: fades in when ticked, out when unticked. */
export const tickMotion =
  'data-[state=checked]:animate-pop-in data-[state=unchecked]:animate-pop-out';
