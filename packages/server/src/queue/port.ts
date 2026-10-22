import type { DlqName, Envelope, QueueName } from './envelope';

/**
 * The queue port (ImBackendImplementationPlan P6-01). SQS FIFO in the cloud, ElasticMQ locally
 * (the same SQS API), and an in-memory adapter for unit tests. Every queue has a dead-letter queue
 * that receives a message after `maxReceiveCount` failed receives (5, set on the queue).
 */

export type AnyQueue = QueueName | DlqName;

export interface Received {
  queue: AnyQueue;
  receiptHandle: string;
  /** Null when the body did not parse: the worker dead-letters it rather than guessing. */
  envelope: Envelope | null;
  raw: string;
  /** How many times SQS has handed this message out, this time included. */
  receiveCount: number;
  groupId: string;
  sentAt: number;
}

export interface QueueStats {
  visible: number;
  inFlight: number;
  /** Seconds since the oldest visible message was sent; null when the queue is empty. */
  oldestAgeSeconds: number | null;
}

export interface QueuePort {
  send(queue: AnyQueue, envelope: Envelope, options: { groupId: string; dedupId: string }): Promise<void>;
  receive(queue: AnyQueue, options: { max: number; waitSeconds: number; visibilitySeconds: number }): Promise<Received[]>;
  ack(message: Received): Promise<void>;
  /** Extends (heartbeat) or shortens (release, backoff) how long the message stays hidden. */
  setVisibility(message: Received, seconds: number): Promise<void>;
  stats(queue: AnyQueue): Promise<QueueStats>;
  /** Tests and local resets only. */
  purge?(queue: AnyQueue): Promise<void>;
}
