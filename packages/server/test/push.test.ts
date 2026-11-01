import { CreatePlatformEndpointCommand, PublishCommand } from '@aws-sdk/client-sns';
import { describe, expect, it, vi } from 'vitest';

import { inQuietHours, nextLocalHour } from '../src/push/localTime';
import { createSnsPush, snsMessage } from '../src/push/push';

const at = (iso: string) => new Date(iso);

describe('the phone’s clock', () => {
  it('finds the next 9am, half-hour zones included', () => {
    expect(nextLocalHour(at('2026-11-01T00:00:00Z'), 'Asia/Kolkata', 9).toISOString()).toBe('2026-11-01T03:30:00.000Z');
    expect(nextLocalHour(at('2026-11-01T12:00:00Z'), 'Asia/Kolkata', 9).toISOString()).toBe('2026-11-02T03:30:00.000Z');
    expect(nextLocalHour(at('2026-11-02T20:00:00Z'), 'America/Los_Angeles', 9).toISOString()).toBe('2026-11-03T17:00:00.000Z');
  });

  it('holds quiet hours from 10pm to 8am', () => {
    expect(inQuietHours(at('2026-11-01T17:00:00Z'), 'Asia/Kolkata')).toBe(true);
    expect(inQuietHours(at('2026-11-01T01:00:00Z'), 'Asia/Kolkata')).toBe(true);
    expect(inQuietHours(at('2026-11-01T03:00:00Z'), 'Asia/Kolkata')).toBe(false);
  });

  it('reads an unknown zone as UTC rather than failing a push', () => {
    expect(nextLocalHour(at('2026-11-01T08:00:00Z'), 'Mars/Olympus', 9).toISOString()).toBe('2026-11-01T09:00:00.000Z');
  });
});

describe('the SNS message', () => {
  const message = JSON.parse(snsMessage({ title: 'Any news from Stripe?', body: 'You applied 7 days ago.', url: '/applications/a', notificationId: 'n' })) as Record<string, string>;

  it('carries the tap’s destination on Android, in the FCM v1 shape', () => {
    const fcm = JSON.parse(message.GCM ?? '') as { fcmV1Message: { message: Record<string, unknown> } };
    expect(fcm.fcmV1Message.message).toMatchObject({
      notification: { title: 'Any news from Stripe?', body: 'You applied 7 days ago.' },
      data: { url: '/applications/a', notificationId: 'n' },
      android: { notification: { channel_id: 'default' } },
    });
  });

  it('carries it on iPhone too, for release and development builds', () => {
    for (const key of ['APNS', 'APNS_SANDBOX']) {
      expect(JSON.parse(message[key] ?? '')).toMatchObject({ aps: { alert: { title: 'Any news from Stripe?' } }, url: '/applications/a', notificationId: 'n' });
    }
    expect(message.default).toBe('Any news from Stripe?');
  });
});

describe('the SNS adapter', () => {
  const named = (name: string, text = name) => Object.assign(new Error(text), { name });

  it('asks for the right platform’s address, and takes the one SNS already holds', async () => {
    const send = vi.fn().mockResolvedValueOnce({ EndpointArn: 'arn:aws:sns:x:endpoint/1' });
    const push = createSnsPush({ client: { send } as never, androidArn: 'android-app', iosArn: 'ios-app' });
    expect(await push.endpointFor({ platform: 'ios', token: 't' })).toBe('arn:aws:sns:x:endpoint/1');
    const [command] = send.mock.calls[0] as [CreatePlatformEndpointCommand];
    expect(command.input).toMatchObject({ PlatformApplicationArn: 'ios-app', Token: 't' });

    send.mockRejectedValueOnce(named('InvalidParameterException', 'Invalid parameter: Token Reason: Endpoint arn:aws:sns:x:endpoint/2 already exists with the same Token, but different attributes.'));
    expect(await push.endpointFor({ platform: 'android', token: 't' })).toBe('arn:aws:sns:x:endpoint/2');
  });

  it('refuses a platform with no application', async () => {
    const push = createSnsPush({ client: { send: vi.fn() } as never, androidArn: 'android-app' });
    await expect(push.endpointFor({ platform: 'ios', token: 't' })).rejects.toThrow('no SNS platform application for ios');
  });

  it('reports a device that has left, and lets anything else fail', async () => {
    const send = vi.fn();
    const push = createSnsPush({ client: { send } as never });
    send.mockResolvedValueOnce({});
    expect(await push.send('e', { title: 't', body: 'b' })).toBe('sent');
    const [command] = send.mock.calls[0] as [PublishCommand];
    expect(command.input).toMatchObject({ TargetArn: 'e', MessageStructure: 'json' });

    send.mockRejectedValueOnce(named('EndpointDisabledException'));
    expect(await push.send('e', { title: 't', body: 'b' })).toBe('gone');

    send.mockRejectedValueOnce(named('ThrottledException'));
    await expect(push.send('e', { title: 't', body: 'b' })).rejects.toThrow('ThrottledException');
  });
});
