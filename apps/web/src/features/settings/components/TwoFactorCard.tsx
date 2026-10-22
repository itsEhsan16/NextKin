import type { AccountSecurity } from '@nextkin/shared/models';

import { AccountCard } from '@/features/account/components/AccountCard';
import { InfoCircleIcon } from '@/ui/icons';
import { SettingsDevicePhoneIllustration, SettingsPrivacyIllustration } from '@/ui/illustrations';
import { Tag } from '@/ui/Tag';

import { CardAction } from './CardAction';

/**
 * Two-factor's action, on this card and on Privacy & data's Security card: "Enable", or "Turn off"
 * once it is on. Neither has a flow behind it yet (`toreview.md` §21).
 */
export function TwoFactorAction({ on }: { on: boolean }) {
  return (
    <CardAction
      label={on ? 'Turn off' : 'Enable'}
      accessibleName={
        on ? 'Turn off two-factor authentication' : 'Enable two-factor authentication'
      }
    />
  );
}

/**
 * "Two-factor authentication" (254:539): off, as drawn, with the board's nudge under it. V2 §7.1
 * requires MFA of the admin pool alone, so "Enable" has neither a flow nor a spec behind it yet
 * (`toreview.md` §21). When it is on, the nudge goes and the action turns it off.
 *
 * The Security section draws it again (577:4236) with the phone for its glyph and an On / Off
 * pill beside the action: `inSecurity`.
 */
export function TwoFactorCard({
  security,
  inSecurity = false,
}: {
  security: AccountSecurity;
  inSecurity?: boolean;
}) {
  const on = security.twoFactorEnabled;

  return (
    <AccountCard
      Art={inSecurity ? SettingsDevicePhoneIllustration : SettingsPrivacyIllustration}
      title="Two-factor authentication"
      description="Add an extra layer of security to your account."
      action={
        inSecurity ? (
          <div className="flex shrink-0 items-center gap-3">
            <Tag tone={on ? 'success' : 'neutral'} shape="pill" className="gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {on ? 'On' : 'Off'}
            </Tag>
            <TwoFactorAction on={on} />
          </div>
        ) : (
          <TwoFactorAction on={on} />
        )
      }
    >
      {!on && (
        <p className="mt-3 flex items-center gap-3 rounded-sm bg-surface-brand-strong px-3 py-2.5 text-body-m text-text-secondary">
          <InfoCircleIcon className="size-5 shrink-0 text-brand-600" />
          Protect your account with 2FA to keep your data safe, even if your password is
          compromised.
        </p>
      )}
    </AccountCard>
  );
}
