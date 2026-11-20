import { App } from 'aws-cdk-lib';

import { DemoStack } from '../src/demoStack';
import { DEMO } from '../src/settings';

/**
 * The NextKin account (toreview §133). The CLI also holds another client's account on `default`,
 * so synthesis refuses any account but this one rather than deploy NextKin into the wrong place.
 */
const NEXTKIN_ACCOUNT = '962942593570';
const REGION = 'us-east-1';

const resolved = process.env.CDK_DEFAULT_ACCOUNT;
if (resolved && resolved !== NEXTKIN_ACCOUNT) {
  throw new Error(
    `The AWS credentials are for account ${resolved}, not NextKin (${NEXTKIN_ACCOUNT}). ` +
      'Use --profile nextkin.',
  );
}

const app = new App();
const webDataSource = String(app.node.tryGetContext('webDataSource') ?? 'http');
if (!['', 'mock', 'http'].includes(webDataSource)) {
  throw new Error(`webDataSource must be mock or http, not "${webDataSource}"`);
}

// The app's own domain (toreview §165), kept in cdk.json so no deploy drops it by accident: the
// zone from the first deploy, the certificate and aliases once `appDomainLive` is true.
const appDomain = app.node.tryGetContext('appDomain') as string | undefined;
const appDomainLive = String(app.node.tryGetContext('appDomainLive') ?? 'false') === 'true';
// The admin portal's own address (toreview §249), a name inside the app domain's zone.
const adminDomain = app.node.tryGetContext('adminDomain') as string | undefined;
if (adminDomain && (!appDomain || !adminDomain.endsWith(`.${appDomain}`))) {
  throw new Error(`adminDomain must be a name inside appDomain (${appDomain ?? 'unset'}), e.g. admin.${appDomain ?? 'app.example'}`);
}

// The marketing site on nextkin.ai (owner, 2026-11-21): the names, and the ACM certificate that
// covers them, requested by CLI and validated by CNAMEs at Namecheap (the domain's DNS stays
// there). Left out until that certificate is ISSUED: CloudFront refuses a pending one.
const landingDomains = String(app.node.tryGetContext('landingDomains') ?? '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);
const landingCertificateArn = app.node.tryGetContext('landingCertificateArn') as string | undefined;
if (landingDomains.length && !landingCertificateArn?.startsWith('arn:aws:acm:us-east-1:')) {
  throw new Error('landingDomains needs landingCertificateArn: an ISSUED ACM certificate in us-east-1');
}

// Clerk (toreview §169): the publishable key is public, so it may live in cdk.json; the secret key
// goes into Secrets Manager (nextkin-demo/clerk-secret-key) after the first deploy that sets this.
const clerkPublishableKey = app.node.tryGetContext('clerkPublishableKey') as string | undefined;
if (clerkPublishableKey && !/^pk_(test|live)_/.test(clerkPublishableKey)) {
  throw new Error('clerkPublishableKey must be a Clerk publishable key (pk_test_… or pk_live_…)');
}

new DemoStack(app, DEMO.stack, {
  env: { account: NEXTKIN_ACCOUNT, region: REGION },
  description: 'NextKin demo: internal testing and client demos (APP_ENV=dev)',
  webDataSource,
  ...(clerkPublishableKey ? { clerkPublishableKey } : {}),
  ...(appDomain
    ? {
        appDomain: {
          name: appDomain,
          live: appDomainLive,
          ...(adminDomain ? { extraNames: [adminDomain] } : {}),
        },
      }
    : {}),
  ...(adminDomain ? { adminDomain } : {}),
  ...(landingDomains.length && landingCertificateArn
    ? { landing: { names: landingDomains, certificateArn: landingCertificateArn } }
    : {}),
});
