import { CreatePlatformEndpointCommand, DeleteEndpointCommand, PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { PushPlatform } from '@nextkin/shared/models/notification';

import type { Config } from '../config';
import type { Logger } from '../observability/logger';

/**
 * PushPort (owner, 2026-11-01; V2 §9.12). In AWS, Amazon SNS mobile push; locally a stand-in that
 * logs, because SNS has no local twin. `off` is a real setting, not a stand-in: an environment with
 * no Firebase project or Apple key behind it sends nothing and says so.
 */

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  notificationId?: string;
}

export interface PushPort {
  /** The device's address at the provider. Safe to repeat for the same token. */
  endpointFor(device: { platform: PushPlatform; token: string }): Promise<string>;
  /** `gone`: the provider says this device can no longer be reached. */
  send(endpoint: string, message: PushMessage): Promise<'sent' | 'gone'>;
  forget(endpoint: string): Promise<void>;
}

/** The Android channel the app creates; FCM drops a message aimed at a channel that doesn't exist. */
const ANDROID_CHANNEL = 'default';

/** One message in every shape SNS may need: FCM v1, and APNs for release and development builds. */
export function snsMessage(message: PushMessage): string {
  const { title, body } = message;
  const data = { ...(message.url ? { url: message.url } : {}), ...(message.notificationId ? { notificationId: message.notificationId } : {}) };
  const apns = JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, ...data });
  return JSON.stringify({
    default: title,
    GCM: JSON.stringify({ fcmV1Message: { message: { notification: { title, body }, data, android: { notification: { channel_id: ANDROID_CHANNEL } } } } }),
    APNS: apns,
    APNS_SANDBOX: apns,
  });
}

/** SNS names the endpoint it already holds when a token comes back with different attributes. */
const KNOWN_ENDPOINT = /Endpoint (arn:aws[^ ]+) already exists/;

const isNamed = (error: unknown, name: string): error is Error => error instanceof Error && error.name === name;

type SnsClient = Pick<SNSClient, 'send'>;

export function createSnsPush(deps: { client: SnsClient; androidArn?: string; iosArn?: string }): PushPort {
  const applications: Record<PushPlatform, string | undefined> = { android: deps.androidArn, ios: deps.iosArn };
  return {
    async endpointFor({ platform, token }) {
      const application = applications[platform];
      if (!application) throw new Error(`no SNS platform application for ${platform}`);
      try {
        const created = await deps.client.send(new CreatePlatformEndpointCommand({ PlatformApplicationArn: application, Token: token }));
        if (!created.EndpointArn) throw new Error('SNS returned no endpoint');
        return created.EndpointArn;
      } catch (error) {
        const known = error instanceof Error ? KNOWN_ENDPOINT.exec(error.message)?.[1] : undefined;
        if (known) return known;
        throw error;
      }
    },
    async send(endpoint, message) {
      try {
        await deps.client.send(new PublishCommand({ TargetArn: endpoint, MessageStructure: 'json', Message: snsMessage(message) }));
        return 'sent';
      } catch (error) {
        if (isNamed(error, 'EndpointDisabledException') || isNamed(error, 'NotFoundException')) return 'gone';
        throw error;
      }
    },
    async forget(endpoint) {
      await deps.client.send(new DeleteEndpointCommand({ EndpointArn: endpoint }));
    },
  };
}

/** Local: says a push would have left, with no text in it. L3 keeps this out of staging and production. */
export function createLogPush(log: Logger): PushPort {
  return {
    endpointFor: async ({ platform }) => `local:${platform}`,
    async send(endpoint) {
      log.info({ event: 'push.local', endpoint }, 'a push would have been sent');
      return 'sent';
    },
    forget: async () => undefined,
  };
}

/** Tests: keeps every message, and a device can be made to have left. */
export function createMemoryPush(): PushPort & { sent: { endpoint: string; message: PushMessage }[]; forgotten: string[]; gone: Set<string> } {
  const sent: { endpoint: string; message: PushMessage }[] = [];
  const forgotten: string[] = [];
  const gone = new Set<string>();
  return {
    sent,
    forgotten,
    gone,
    endpointFor: async ({ platform, token }) => `memory:${platform}:${token}`,
    async send(endpoint, message) {
      if (gone.has(endpoint)) return 'gone';
      sent.push({ endpoint, message });
      return 'sent';
    },
    async forget(endpoint) {
      forgotten.push(endpoint);
    },
  };
}

export function buildPush(config: Pick<Config, 'PUSH_ADAPTER' | 'PUSH_SNS_ANDROID_ARN' | 'PUSH_SNS_IOS_ARN' | 'SNS_ENDPOINT' | 'AWS_REGION'>, log: Logger): PushPort | null {
  if (config.PUSH_ADAPTER === 'off') return null;
  if (config.PUSH_ADAPTER === 'log') return createLogPush(log);
  return createSnsPush({
    client: new SNSClient({ region: config.AWS_REGION, ...(config.SNS_ENDPOINT ? { endpoint: config.SNS_ENDPOINT } : {}) }),
    ...(config.PUSH_SNS_ANDROID_ARN ? { androidArn: config.PUSH_SNS_ANDROID_ARN } : {}),
    ...(config.PUSH_SNS_IOS_ARN ? { iosArn: config.PUSH_SNS_IOS_ARN } : {}),
  });
}
