import { cn } from '@/lib/cn';

export type BulletListProps = { items: string[]; className?: string };

/**
 * The detail card's indigo-bulleted list (304:2740) — Key responsibilities and Requirements, in
 * the running-copy `prose` role.
 */
export function BulletList({ items, className }: BulletListProps) {
  return (
    <ul className={cn('flex flex-col', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-prose text-text-secondary">
          <span aria-hidden className="ml-0.5 text-brand-600">
            •
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
