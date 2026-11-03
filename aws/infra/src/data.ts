import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import type { Network } from './network';
import { DEMO } from './settings';

export type RoleName = 'owner' | 'app' | 'maintenance' | 'readonly';
const ROLES: RoleName[] = ['owner', 'app', 'maintenance', 'readonly'];

/**
 * The demo's stateful pieces (toreview §133): Aurora PostgreSQL Serverless v2 scaling to zero when
 * idle, the four buckets the server reads (S3-managed encryption; KMS, Object Lock and replication
 * come with staging), the three FIFO queues with their DLQs, and every generated secret.
 */
export class Data extends Construct {
  readonly db: rds.DatabaseCluster;
  readonly buckets: Record<'uploads' | 'anonymous' | 'exports' | 'audit', s3.Bucket>;
  readonly queues: sqs.Queue[] = [];
  /** One login password per database role (docker/postgres/init/01-roles.sh). */
  readonly rolePasswords = {} as Record<RoleName, secretsmanager.Secret>;
  readonly cursorSecret: secretsmanager.Secret;
  /** A placeholder until the owner puts the real key in (aws/infra/README.md). */
  readonly openRouterKey: secretsmanager.Secret;
  readonly seedPassword: secretsmanager.Secret;
  readonly seedTotp: secretsmanager.Secret;
  /** CloudFront sends it, the load balancer requires it: no request reaches web around the CDN. */
  readonly originVerify: secretsmanager.Secret;
  /** The worker's bearer token for the LaTeX compile service (toreview §137). */
  readonly latexToken: secretsmanager.Secret;
  /** The worker's bearer token for the link reader (toreview §144.3). */
  readonly linkReaderToken: secretsmanager.Secret;

  constructor(scope: Construct, id: string, network: Network) {
    super(scope, id);

    const secret = (
      name: string,
      description: string,
      generate: secretsmanager.SecretStringGenerator,
    ) =>
      new secretsmanager.Secret(this, name, {
        secretName: `${DEMO.secretPrefix}/${name}`,
        description,
        generateSecretString: { excludePunctuation: true, includeSpace: false, ...generate },
      });

    // Alphanumeric only, because the containers splice them into postgres:// URLs.
    for (const role of ROLES) {
      this.rolePasswords[role] = secret(`db-${role}`, `Login for nextkin_${role}`, {
        passwordLength: 32,
      });
    }
    this.cursorSecret = secret('cursor-secret', 'Signs pagination cursors', { passwordLength: 48 });
    this.openRouterKey = secret('openrouter-api-key', 'OpenRouter key: replace this value', {
      passwordLength: 16,
    });
    this.seedPassword = secret('seed-password', 'Password for every seeded demo account', {
      passwordLength: 24,
    });
    // Base32 (A-Z, 2-7) for the staff accounts' TOTP.
    this.seedTotp = secret('seed-totp-secret', 'TOTP secret for the seeded staff accounts', {
      passwordLength: 32,
      excludeLowercase: true,
      excludeCharacters: '0189',
    });
    this.latexToken = secret('latex-token', 'Worker to LaTeX compile service bearer token', {
      passwordLength: 48,
    });
    this.linkReaderToken = secret('link-reader-token', 'Worker to link reader bearer token', {
      passwordLength: 48,
    });
    this.originVerify = secret('origin-verify', 'CloudFront to load balancer header', {
      passwordLength: 40,
    });

    this.db = new rds.DatabaseCluster(this, 'Db', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_9,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer'),
      // Scale to zero when idle: the first request after a pause waits ~15 s. Production keeps a floor.
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 2,
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [network.dbSg],
      credentials: rds.Credentials.fromGeneratedSecret(DEMO.masterUser, {
        secretName: `${DEMO.secretPrefix}/db-master`,
      }),
      defaultDatabaseName: DEMO.database,
      storageEncrypted: true,
      backup: { retention: Duration.days(1) },
      deletionProtection: false,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    const bucket = (name: string, props: s3.BucketProps = {}) =>
      new s3.Bucket(this, name, {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        removalPolicy: RemovalPolicy.RETAIN,
        ...props,
      });
    this.buckets = {
      uploads: bucket('Uploads', { versioned: true }),
      // Try-before-signup uploads: purged after a day (spec §9.4.3).
      anonymous: bucket('AnonymousUploads', { lifecycleRules: [{ expiration: Duration.days(1) }] }),
      exports: bucket('Exports'),
      audit: bucket('AuditArchive'),
    };

    // Names match the server's `${SQS_QUEUE_PREFIX}${queue}.fifo` and its `-dlq` (queue/sqs.ts).
    for (const queue of DEMO.queues) {
      const dlq = new sqs.Queue(this, `${queue}-dlq`, {
        queueName: `${DEMO.queuePrefix}${queue}-dlq.fifo`,
        fifo: true,
        retentionPeriod: Duration.days(14),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
      });
      const main = new sqs.Queue(this, queue, {
        queueName: `${DEMO.queuePrefix}${queue}.fifo`,
        fifo: true,
        contentBasedDeduplication: false,
        visibilityTimeout: Duration.seconds(60),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
        deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
      });
      this.queues.push(main, dlq);
    }
  }

  /** Browser uploads go straight to S3 by presigned POST, from the app's own origins only. */
  allowBrowserUploads(appOrigins: readonly string[]): void {
    for (const target of [this.buckets.uploads, this.buckets.anonymous]) {
      target.addCorsRule({
        allowedOrigins: [...new Set(appOrigins)],
        allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedHeaders: ['*'],
        maxAge: 3000,
      });
    }
  }
}
