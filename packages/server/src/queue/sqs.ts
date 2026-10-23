import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { envelopeSchema } from './envelope';
import type { AnyQueue, QueuePort, Received } from './port';

/**
 * The SQS adapter (P6-01). Works against SQS FIFO and against ElasticMQ, which speaks the same
 * API: only the endpoint differs (L1). Queue names gain `.fifo` and the optional prefix.
 */
export interface SqsOptions {
  region: string;
  endpoint?: string;
  prefix?: string;
}

export function createSqsQueue(options: SqsOptions): QueuePort & { close(): void } {
  const client = new SQSClient({ region: options.region, endpoint: options.endpoint });
  const urls = new Map<AnyQueue, Promise<string>>();
  const url = (queue: AnyQueue) => {
    let found = urls.get(queue);
    if (!found) {
      found = client
        .send(new GetQueueUrlCommand({ QueueName: `${options.prefix ?? ''}${queue}.fifo` }))
        .then((r) => r.QueueUrl!)
        .catch((error: unknown) => {
          urls.delete(queue);
          throw error;
        });
      urls.set(queue, found);
    }
    return found;
  };

  return {
    async send(queue, envelope, { groupId, dedupId }) {
      envelopeSchema.parse(envelope);
      await client.send(
        new SendMessageCommand({
          QueueUrl: await url(queue),
          MessageBody: JSON.stringify(envelope),
          MessageGroupId: groupId,
          MessageDeduplicationId: dedupId,
        }),
      );
    },

    async receive(queue, { max, waitSeconds, visibilitySeconds }) {
      const result = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: await url(queue),
          MaxNumberOfMessages: Math.min(10, Math.max(1, max)),
          WaitTimeSeconds: waitSeconds,
          VisibilityTimeout: visibilitySeconds,
          MessageSystemAttributeNames: ['ApproximateReceiveCount', 'MessageGroupId', 'SentTimestamp'],
        }),
      );
      return (result.Messages ?? []).map((m): Received => {
        const raw = m.Body ?? '';
        let envelope: Received['envelope'] = null;
        try {
          const parsed = envelopeSchema.safeParse(JSON.parse(raw));
          envelope = parsed.success ? parsed.data : null;
        } catch {
          envelope = null;
        }
        return {
          queue,
          receiptHandle: m.ReceiptHandle!,
          envelope,
          raw,
          receiveCount: Number(m.Attributes?.ApproximateReceiveCount ?? 1),
          groupId: m.Attributes?.MessageGroupId ?? '',
          sentAt: Number(m.Attributes?.SentTimestamp ?? Date.now()),
        };
      });
    },

    async ack(message) {
      await client.send(new DeleteMessageCommand({ QueueUrl: await url(message.queue), ReceiptHandle: message.receiptHandle }));
    },

    async setVisibility(message, seconds) {
      await client.send(
        new ChangeMessageVisibilityCommand({ QueueUrl: await url(message.queue), ReceiptHandle: message.receiptHandle, VisibilityTimeout: seconds }),
      );
    },

    async stats(queue) {
      const result = await client.send(
        new GetQueueAttributesCommand({
          QueueUrl: await url(queue),
          AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
        }),
      );
      // SQS has no "oldest message age" attribute; CloudWatch's ApproximateAgeOfOldestMessage is the
      // cloud signal (X-11). Locally it is unknown.
      return {
        visible: Number(result.Attributes?.ApproximateNumberOfMessages ?? 0),
        inFlight: Number(result.Attributes?.ApproximateNumberOfMessagesNotVisible ?? 0),
        oldestAgeSeconds: null,
      };
    },

    async purge(queue) {
      await client.send(new PurgeQueueCommand({ QueueUrl: await url(queue) }));
    },

    close: () => client.destroy(),
  };
}
