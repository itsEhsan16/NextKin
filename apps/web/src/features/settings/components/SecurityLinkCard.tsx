import { AccountCard } from '@/features/account/components/AccountCard';
import { buttonClass } from '@/ui/Button';
import { SettingsSecurityIllustration } from '@/ui/illustrations';
import { ArrowRight } from '@/ui/lineIcons';

/**
 * Where password, two-factor and signed-in devices are (redesign R7b, audit ST-03): they used to
 * render in Account, again in Security, and a third time in Privacy. Security owns them; the other
 * sections point there.
 */
export function SecurityLinkCard({ onOpen }: { onOpen: () => void }) {
  return (
    <AccountCard
      Art={SettingsSecurityIllustration}
      title="Password, two-factor and devices"
      description="Change your password, turn on two-factor and see where you're signed in."
      action={
        <button
          type="button"
          onClick={onOpen}
          className={buttonClass({ variant: 'secondary', size: 'sm' })}
        >
          Open Security
          <ArrowRight aria-hidden className="size-4" />
        </button>
      }
    >
      {null}
    </AccountCard>
  );
}
