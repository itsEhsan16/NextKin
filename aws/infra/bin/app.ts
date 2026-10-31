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

new DemoStack(app, DEMO.stack, {
  env: { account: NEXTKIN_ACCOUNT, region: REGION },
  description: 'NextKin demo: internal testing and client demos (APP_ENV=dev)',
  webDataSource,
});
