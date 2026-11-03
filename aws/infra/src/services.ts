import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';

import type { Data } from './data';
import type { Network } from './network';
import {
  appEnvironment,
  appImage,
  appSecrets,
  hubImage,
  PLATFORM,
  roleSecrets,
  withDatabaseUrls,
} from './runtime';
import { DEMO, ROLES_SCRIPT } from './settings';

export interface ServicesProps {
  network: Network;
  data: Data;
  appOrigin: string;
  /** NEXT_PUBLIC_DATA_SOURCE baked into the web build: '' (mock) or 'http'. */
  webDataSource: string;
}

/**
 * The demo's containers (toreview §133). Long-running: web, worker, support (Valkey + Mailpit),
 * ClamAV and the LaTeX compile service (§137). One-off, run by `pnpm --filter @nextkin/infra task <name>`: db-roles, migrate, seed.
 */
export class Services extends Construct {
  readonly cluster: ecs.Cluster;
  readonly web: ecs.FargateService;
  readonly oneOff: Record<'dbRoles' | 'migrate' | 'seed', ecs.FargateTaskDefinition>;

  constructor(scope: Construct, id: string, props: ServicesProps) {
    super(scope, id);
    const { network, data, appOrigin, webDataSource } = props;

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: network.vpc,
      enableFargateCapacityProviders: true,
    });
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'Namespace', {
      name: DEMO.namespace,
      vpc: network.vpc,
    });

    const logging = (name: string) =>
      ecs.LogDrivers.awsLogs({
        streamPrefix: name,
        logGroup: new logs.LogGroup(this, `${name}-logs`, {
          logGroupName: `/nextkin-demo/${name}`,
          retention: logs.RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });
    const taskDef = (name: string, cpu: number, memoryLimitMiB: number) =>
      new ecs.FargateTaskDefinition(this, `${name}-task`, {
        family: `nextkin-demo-${name}`,
        cpu,
        memoryLimitMiB,
        runtimePlatform: PLATFORM,
      });
    const service = (
      name: string,
      taskDefinition: ecs.FargateTaskDefinition,
      securityGroup: ec2.SecurityGroup,
      extra: Partial<ecs.FargateServiceProps> = {},
    ) =>
      new ecs.FargateService(this, `${name}-service`, {
        serviceName: `nextkin-demo-${name}`,
        cluster: this.cluster,
        taskDefinition,
        desiredCount: 1,
        assignPublicIp: true,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        securityGroups: [securityGroup],
        enableExecuteCommand: true,
        circuitBreaker: { rollback: true },
        ...extra,
      });
    const spot = [{ capacityProvider: 'FARGATE_SPOT', weight: 1 }];
    const discoverable = (name: string): Partial<ecs.FargateServiceProps> => ({
      cloudMapOptions: {
        name,
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.seconds(10),
      },
    });

    const environment = appEnvironment(data, appOrigin);
    const secrets = appSecrets(data);
    const runtimeRoles = ['app', 'maintenance', 'readonly'] as const;
    const grantApp = (definition: ecs.FargateTaskDefinition) => {
      for (const bucket of Object.values(data.buckets)) bucket.grantReadWrite(definition.taskRole);
      for (const queue of data.queues) {
        queue.grantSendMessages(definition.taskRole);
        queue.grantConsumeMessages(definition.taskRole);
      }
      // The queue health probe (/health/deep, the worker heartbeat) lists queues; it has no resource.
      definition.addToTaskRolePolicy(
        new iam.PolicyStatement({ actions: ['sqs:ListQueues'], resources: ['*'] }),
      );
    };

    // --- web: Next.js and the /api/v1 backend ---
    const webDef = taskDef('web', 512, 1024);
    webDef.addContainer('web', {
      image: appImage('web', webDataSource),
      command: withDatabaseUrls([...runtimeRoles], 'node apps/web/server.js'),
      environment,
      secrets: { ...secrets, ...roleSecrets(data, [...runtimeRoles]) },
      portMappings: [{ containerPort: 3000 }],
      logging: logging('web'),
    });
    grantApp(webDef);
    this.web = service('web', webDef, network.appSg, {
      minHealthyPercent: 100,
      healthCheckGracePeriod: Duration.seconds(120),
    });

    // --- worker: queues, parsing, generation, PDF export. Spot: an interruption only delays jobs.
    // It typesets resumes on the LaTeX service (§137): the URL and its bearer token.
    const workerDef = taskDef('worker', 1024, 2048);
    workerDef.addContainer('worker', {
      image: appImage('worker', webDataSource),
      command: withDatabaseUrls([...runtimeRoles], 'node dist/worker.mjs'),
      environment: { ...environment, LATEX_COMPILER_URL: `http://latex.${DEMO.namespace}:8790`, LINK_READER_URL: `http://links.${DEMO.namespace}:8791` },
      secrets: {
        ...secrets,
        ...roleSecrets(data, [...runtimeRoles]),
        LATEX_COMPILER_TOKEN: ecs.Secret.fromSecretsManager(data.latexToken),
        LINK_READER_TOKEN: ecs.Secret.fromSecretsManager(data.linkReaderToken),
      },
      logging: logging('worker'),
    });
    grantApp(workerDef);
    service('worker', workerDef, network.appSg, {
      capacityProviderStrategies: spot,
      minHealthyPercent: 100,
    });

    // --- support: Valkey (sessions, limits, caches; no persistence, so a restart signs everyone
    // out) and Mailpit (catches every email; SES replaces it once nextkin.ai is verified).
    const supportDef = taskDef('support', 256, 512);
    supportDef.addContainer('valkey', {
      image: hubImage('VALKEY_IMAGE'),
      command: ['valkey-server', '--save', '', '--appendonly', 'no', '--protected-mode', 'no'],
      portMappings: [{ containerPort: 6379 }],
      logging: logging('valkey'),
    });
    supportDef.addContainer('mailpit', {
      image: hubImage('MAILPIT_IMAGE'),
      essential: false,
      portMappings: [{ containerPort: 1025 }],
      logging: logging('mailpit'),
    });
    // One copy at a time: a second Valkey would split the sessions.
    service('support', supportDef, network.supportSg, {
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      ...discoverable('support'),
    });

    // --- clamav: the upload gate (P7-03). Signatures load for a few minutes after each start.
    const clamavDef = taskDef('clamav', 1024, 4096);
    clamavDef.addContainer('clamav', {
      image: hubImage('CLAMAV_IMAGE'),
      portMappings: [{ containerPort: 3310 }],
      logging: logging('clamav'),
    });
    service('clamav', clamavDef, network.clamavSg, {
      capacityProviderStrategies: spot,
      minHealthyPercent: 100,
      ...discoverable('clamav'),
    });

    // --- latex: the sealed compile service (toreview §111, §137): Tectonic and Poppler behind
    // POST /compile, with a bearer token and nothing of the app's (no database, no secrets but
    // its own). Locally it has no network at all; here its security group admits only the app,
    // and it keeps outbound only because the subnets are public and it pulls its image. Tectonic
    // runs from the build-time cache and never fetches. The service reads its token from a file,
    // so the shell writes the injected secret to one (owner-only) and drops the variable.
    const latexDef = taskDef('latex', 1024, 2048);
    latexDef.addContainer('latex', {
      image: appImage('latex', webDataSource),
      entryPoint: ['sh', '-c'],
      command: [
        'umask 077; printf %s "$LATEX_TOKEN" > /tmp/latex_token; unset LATEX_TOKEN; exec node dist/latex-service.mjs',
      ],
      environment: { LATEX_TOKEN_FILE: '/tmp/latex_token', LATEX_PORT: '8790' },
      secrets: { LATEX_TOKEN: ecs.Secret.fromSecretsManager(data.latexToken) },
      portMappings: [{ containerPort: 8790 }],
      logging: logging('latex'),
    });
    service('latex', latexDef, network.latexSg, {
      capacityProviderStrategies: spot,
      minHealthyPercent: 100,
      ...discoverable('latex'),
    });

    // --- links: the link reader (toreview §144.3). Pages from the open web run here, so it holds
    // nothing of the app's: no database, no buckets, a task role with no permissions, and only
    // ports 80 and 443 out. As with LaTeX, the shell writes the token to a file and drops the variable.
    const linksDef = taskDef('links', 1024, 2048);
    linksDef.addContainer('links', {
      image: appImage('link-reader', webDataSource),
      entryPoint: ['sh', '-c'],
      command: [
        'umask 077; printf %s "$LINK_READER_TOKEN" > /tmp/link_reader_token; unset LINK_READER_TOKEN; exec node dist/link-reader.mjs',
      ],
      environment: { LINK_READER_TOKEN_FILE: '/tmp/link_reader_token' },
      secrets: { LINK_READER_TOKEN: ecs.Secret.fromSecretsManager(data.linkReaderToken) },
      portMappings: [{ containerPort: 8791 }],
      logging: logging('links'),
    });
    service('links', linksDef, network.linksSg, {
      capacityProviderStrategies: spot,
      minHealthyPercent: 100,
      ...discoverable('links'),
    });

    // --- one-off tasks ---
    const dbRoles = taskDef('db-roles', 256, 512);
    dbRoles.addContainer('db-roles', {
      image: hubImage('POSTGRES_IMAGE'),
      // The same script the local Postgres runs on first start, pointed at Aurora.
      entryPoint: ['sh', '-c'],
      command: [ROLES_SCRIPT],
      environment: {
        PGHOST: data.db.clusterEndpoint.hostname,
        PGSSLMODE: 'require',
        POSTGRES_USER: DEMO.masterUser,
        POSTGRES_DB: DEMO.database,
      },
      secrets: {
        PGPASSWORD: ecs.Secret.fromSecretsManager(data.db.secret!, 'password'),
        NEXTKIN_OWNER_PASSWORD: ecs.Secret.fromSecretsManager(data.rolePasswords.owner),
        NEXTKIN_APP_PASSWORD: ecs.Secret.fromSecretsManager(data.rolePasswords.app),
        NEXTKIN_MAINTENANCE_PASSWORD: ecs.Secret.fromSecretsManager(data.rolePasswords.maintenance),
        NEXTKIN_READONLY_PASSWORD: ecs.Secret.fromSecretsManager(data.rolePasswords.readonly),
      },
      logging: logging('db-roles'),
    });

    const allRoles = ['owner', 'app', 'maintenance', 'readonly'] as const;
    const migrateImage = appImage('migrate', webDataSource);
    const migrate = taskDef('migrate', 512, 1024);
    migrate.addContainer('migrate', {
      image: migrateImage,
      command: withDatabaseUrls([...allRoles], 'node dist/migrate.mjs'),
      environment,
      secrets: { ...secrets, ...roleSecrets(data, [...allRoles]) },
      logging: logging('migrate'),
    });

    const seed = taskDef('seed', 512, 1024);
    seed.addContainer('seed', {
      image: migrateImage,
      // SEED_ARGS is empty unless `task seed-reference` sets it to --reference-only.
      command: withDatabaseUrls([...runtimeRoles], 'node dist/seed.mjs $SEED_ARGS'),
      environment,
      secrets: {
        ...secrets,
        ...roleSecrets(data, [...runtimeRoles]),
        SEED_PASSWORD: ecs.Secret.fromSecretsManager(data.seedPassword),
        SEED_TOTP_SECRET: ecs.Secret.fromSecretsManager(data.seedTotp),
      },
      logging: logging('seed'),
    });
    grantApp(seed);

    this.oneOff = { dbRoles, migrate, seed };
  }
}
