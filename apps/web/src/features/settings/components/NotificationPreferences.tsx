'use client';

import type {
  NotificationChannel,
  NotificationSettings,
  NotificationTopic,
} from '@nextkin/shared/models';
import {
  useNotificationSettings,
  useResetNotificationSettings,
  useSetNotificationSettings,
} from '@nextkin/shared/queries';
import type { ComponentType, SVGProps } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import { cn } from '@/lib/cn';
import { iconButton } from '@/ui/iconButton';
import { ChevronDownIcon, InfoCircleIcon, RefreshIcon } from '@/ui/icons';
import {
  ProfileExperienceIllustration,
  ProfileInsightsIllustration,
  ProfileTermsIllustration,
  SettingsCalendarIllustration,
  SettingsDevicePhoneIllustration,
  SettingsEmailIllustration,
  SettingsLightbulbIllustration,
  SettingsMegaphoneIllustration,
  SettingsPrivacyIllustration,
  SettingsSessionsIllustration,
} from '@/ui/illustrations';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Switch } from '@/ui/Switch';

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TOPICS,
  withChannel,
  withTopicChannel,
} from '../notificationsLibrary';
import { Soon, soonControl } from '@/ui/Soon';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** The channels' duotone glyphs (356:605): the monitor, the envelope and the phone. */
const CHANNEL_ICON: Record<NotificationChannel, Glyph> = {
  inApp: SettingsSessionsIllustration,
  email: SettingsEmailIllustration,
  push: SettingsDevicePhoneIllustration,
};

/**
 * The topics' duotone glyphs (356:645-813), the same drawings the Profile and Account boards use
 * where they mean the same thing: the briefcase, the document, the shield.
 */
const TOPIC_ICON: Record<NotificationTopic, Glyph> = {
  jobMatches: ProfileExperienceIllustration,
  applicationUpdates: ProfileTermsIllustration,
  interviewReminders: SettingsCalendarIllustration,
  resumeInsights: ProfileInsightsIllustration,
  productUpdates: SettingsMegaphoneIllustration,
  tips: SettingsLightbulbIllustration,
  accountSecurity: SettingsPrivacyIllustration,
};

/** A duotone glyph in a 40px slot, on no tile since the redraw (356:585). */
function GlyphTile({ Icon }: { Icon: Glyph }) {
  return (
    <span aria-hidden className="flex w-10 shrink-0 justify-center">
      <Icon className="h-auto max-h-8 w-10" />
    </span>
  );
}

/**
 * "Notification preferences" (247:1290): the three channels, then each topic on each channel,
 * every switch saved the moment it flips. A channel that's off greys its column but keeps the
 * switches in it, which apply again when it's back on. While Reset to default runs, the switches
 * wait: a flip made then would carry the old values and undo the reset. By your call the same
 * card is the Account page's Notifications tab, over the same data (`toreview.md` §24).
 */
export function NotificationPreferences() {
  const settings = useNotificationSettings();
  const save = useSetNotificationSettings();
  const reset = useResetNotificationSettings();

  if (settings.isPending) return <Skeleton className="h-[34rem] rounded-lg" />;
  // Data first: past the skeleton, only a load with nothing to show is an error. A failed
  // background refresh keeps what is on screen (`toreview.md` §84).
  if (settings.data === undefined) {
    return (
      <StateView
        tone="danger"
        title="Couldn't load your notification settings"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void settings.refetch()}
      />
    );
  }

  const value = settings.data;
  const put = (next: NotificationSettings) => save.mutate(next);
  const resetting = reset.isPending;

  return (
    <AccountCard
      title="Notification preferences"
      description="Choose how and when you want to be notified."
      action={
        <button
          type="button"
          disabled={resetting}
          onClick={() => reset.mutate()}
          className={cn(
            BUTTON_VARIANT.secondary,
            'h-control-sm shrink-0 gap-1.5 rounded-md px-3.5 text-body-s font-semibold',
          )}
        >
          <RefreshIcon aria-hidden className="size-4" />
          Reset to default
        </button>
      }
    >
      <ul
        aria-label="Channels"
        className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-4"
      >
        {NOTIFICATION_CHANNELS.map(({ id, label, description }) => (
          <li key={id} className="flex items-center gap-3 rounded-md bg-neutral-50 px-4 py-3.5">
            <GlyphTile Icon={CHANNEL_ICON[id]} />
            <div className="min-w-0 flex-1">
              <p className="text-body-m font-semibold text-text-primary">{label}</p>
              <p className="text-body-s text-text-tertiary">{description}</p>
            </div>
            <Switch
              label={label}
              checked={value.channels[id]}
              disabled={resetting}
              onChange={(on) => put(withChannel(value, id, on))}
            />
          </li>
        ))}
      </ul>

      <ul
        aria-label="Topics"
        className="-mx-6 mt-6 divide-y divide-border-subtle border-y border-border-subtle"
      >
        {NOTIFICATION_TOPICS.map(({ id, label, description }) => (
          <li key={id} className="flex min-h-16 items-center gap-4 px-6 py-3">
            <GlyphTile Icon={TOPIC_ICON[id]} />
            <div className="min-w-0 flex-1">
              <p className="text-body-m font-semibold text-text-primary">{label}</p>
              <p className="text-body-s text-text-tertiary">{description}</p>
            </div>
            {NOTIFICATION_CHANNELS.map((channel) => (
              <div key={channel.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
                <Switch
                  label={`${label}, ${channel.label}`}
                  checked={value.topics[id][channel.id]}
                  disabled={resetting || !value.channels[channel.id]}
                  onChange={(on) => put(withTopicChannel(value, id, channel.id, on))}
                />
                <span aria-hidden className="text-micro text-text-tertiary">
                  {channel.label}
                </span>
              </div>
            ))}
            {/* Drawn (247:1359) with nothing behind it yet: no board opens a topic. */}
            <Soon>
              <button
                aria-disabled="true"
                type="button"
                aria-label={`More about ${label.toLowerCase()}`}
                className={cn(iconButton, 'text-text-tertiary', soonControl)}
              >
                <ChevronDownIcon aria-hidden className="size-4" />
              </button>
            </Soon>
          </li>
        ))}
      </ul>

      <p className="mt-6 flex items-center gap-3 rounded-md bg-surface-brand px-4 py-3 text-body-s text-text-secondary">
        <InfoCircleIcon aria-hidden className="size-5 shrink-0 text-brand-600" />
        You&apos;ll always receive critical account and security notifications, even if they&apos;re
        turned off.
      </p>
    </AccountCard>
  );
}
