import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { IgnoreMode, Stack } from 'aws-cdk-lib';

import type { Data, RoleName } from './data';
import { DEMO, pinned, REPO_ROOT } from './settings';

/**
 * What every NextKin container is given (toreview §133): the image built from docker/Dockerfile,
 * the environment the server's loadConfig() validates, and the secrets it needs.
 */

/** x86_64, so a Windows laptop builds the images natively; Graviton comes with staging. */
export const PLATFORM: ecs.RuntimePlatform = {
  cpuArchitecture: ecs.CpuArchitecture.X86_64,
  operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
};

type Target = 'web' | 'worker' | 'migrate' | 'latex' | 'link-reader';

export function appImage(
  target: Target,
  webDataSource: string,
  clerkPublishableKey?: string,
): ecs.ContainerImage {
  const buildArgs: Record<string, string> = { NODE_IMAGE: pinned('NODE_IMAGE') };
  if (target === 'worker') {
    buildArgs.PLAYWRIGHT_VERSION = pinned('LIB_PLAYWRIGHT');
    buildArgs.PDFJS_VERSION = pinned('LIB_PDFJS_DIST');
    buildArgs.TESSERACT_VERSION = pinned('LIB_TESSERACT_JS');
  }
  if (target === 'link-reader') buildArgs.PLAYWRIGHT_VERSION = pinned('LIB_PLAYWRIGHT');
  if (target === 'web') buildArgs.NEXT_PUBLIC_DATA_SOURCE = webDataSource;
  // Inlined by Next at build time; public by design (toreview §169).
  if (target === 'web' && clerkPublishableKey) buildArgs.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkPublishableKey;
  if (target === 'migrate') buildArgs.ARGON2_VERSION = pinned('LIB_NODE_RS_ARGON2');
  if (target === 'latex') {
    buildArgs.TECTONIC_VERSION = pinned('TECTONIC_VERSION');
    buildArgs.TECTONIC_SHA256_X86_64 = pinned('TECTONIC_SHA256_X86_64');
    buildArgs.TECTONIC_SHA256_AARCH64 = pinned('TECTONIC_SHA256_AARCH64');
  }
  return ecs.ContainerImage.fromAsset(REPO_ROOT, {
    file: 'docker/Dockerfile',
    target,
    buildArgs,
    platform: Platform.LINUX_AMD64,
    // .dockerignore already keeps node_modules, aws/infra and secrets out of the context.
    ignoreMode: IgnoreMode.DOCKER,
  });
}

/** Docker Hub images at the versions docker/versions.env pins. */
export const hubImage = (key: string) => ecs.ContainerImage.fromRegistry(pinned(key));

/**
 * The server reads complete postgres:// URLs, and ECS injects secrets only as whole values, so the
 * container's shell assembles the URLs from the role passwords before starting node. The
 * passwords are alphanumeric (data.ts), so they need no escaping. `$VAR`, not `${VAR}`, which
 * CloudFormation's validator reads as an Fn::Sub placeholder.
 */
export function withDatabaseUrls(roles: RoleName[], start: string): string[] {
  const url = (role: RoleName) =>
    `postgres://nextkin_${role}:$DB_${role.toUpperCase()}_PASSWORD@$DB_HOST:5432/${DEMO.database}?sslmode=no-verify`;
  const names: Record<RoleName, string> = {
    app: 'DATABASE_URL',
    owner: 'DATABASE_OWNER_URL',
    maintenance: 'DATABASE_MAINTENANCE_URL',
    readonly: 'DATABASE_READONLY_URL',
  };
  const exports = roles.map((role) => `export ${names[role]}="${url(role)}"`);
  return ['sh', '-c', [...exports, `exec ${start}`].join('; ')];
}

export function roleSecrets(data: Data, roles: RoleName[]): Record<string, ecs.Secret> {
  return Object.fromEntries(
    roles.map((role) => [
      `DB_${role.toUpperCase()}_PASSWORD`,
      ecs.Secret.fromSecretsManager(data.rolePasswords[role]),
    ]),
  );
}

/** The environment shared by web, worker, migrate and seed. Adapters follow APP_ENV=dev (L3). */
export function appEnvironment(
  data: Data,
  appOrigin: string,
  extraOrigins: readonly string[] = [],
): Record<string, string> {
  return {
    APP_ENV: 'dev',
    LOG_LEVEL: 'info',
    AWS_REGION: Stack.of(data).region,
    DB_HOST: data.db.clusterEndpoint.hostname,
    VALKEY_URL: `redis://support.${DEMO.namespace}:6379`,
    SMTP_URL: `smtp://support.${DEMO.namespace}:1025`,
    EMAIL_FROM: 'NextKin <no-reply@nextkin.test>',
    S3_BUCKET_UPLOADS: data.buckets.uploads.bucketName,
    S3_BUCKET_ANONYMOUS: data.buckets.anonymous.bucketName,
    S3_BUCKET_EXPORTS: data.buckets.exports.bucketName,
    S3_BUCKET_AUDIT: data.buckets.audit.bucketName,
    SQS_QUEUE_PREFIX: DEMO.queuePrefix,
    CLAMAV_HOST: `clamav.${DEMO.namespace}`,
    CLAMAV_PORT: '3310',
    // Clerk once its secret exists (toreview §169); the local IdP otherwise.
    IDENTITY_ADAPTER: data.clerkSecretKey ? 'clerk' : 'local',
    SCAN_ADAPTER: 'clamav',
    OCR_ADAPTER: 'tesseract',
    EMAIL_ADAPTER: 'smtp',
    LLM_ROUTE: 'openrouter',
    AI_DEVELOPER: 'demo',
    AI_DAILY_CAP_USD: '10',
    JOBS_ADAPTER: 'fixture',
    PAYMENT_ADAPTER: 'fake',
    SECRETS_ADAPTER: 'local',
    APP_ORIGIN: appOrigin,
    API_PUBLIC_URL: appOrigin,
    // The cloudfront.net address stays trusted after the own domain goes live (toreview §165).
    ...(extraOrigins.length ? { APP_EXTRA_ORIGINS: extraOrigins.join(',') } : {}),
    // Expo Go reaches the demo too; dev allows exp:// (config refuses it in staging).
    MOBILE_REDIRECT_ALLOWLIST: 'nextkin://,exp://',
    TRUSTED_IP_HEADER: 'cloudfront-viewer-address',
  };
}

export function appSecrets(data: Data): Record<string, ecs.Secret> {
  return {
    CURSOR_SECRET: ecs.Secret.fromSecretsManager(data.cursorSecret),
    OPENROUTER_API_KEY: ecs.Secret.fromSecretsManager(data.openRouterKey),
    ...(data.clerkSecretKey ? { CLERK_SECRET_KEY: ecs.Secret.fromSecretsManager(data.clerkSecretKey) } : {}),
  };
}
