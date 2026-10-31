import { CfnOutput, Stack, type StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Data } from './data';
import { Edge } from './edge';
import { Network } from './network';
import { Services } from './services';

export interface DemoStackProps extends StackProps {
  /** NEXT_PUBLIC_DATA_SOURCE for the web build: 'http' (default) uses the API, 'mock' the fixtures. */
  webDataSource: string;
}

/**
 * The single-account demo (toreview §133): internal testing and client demos, APP_ENV=dev. It is
 * not staging. The local stand-ins it runs (the local identity provider, ClamAV, Mailpit, the
 * OpenRouter key) are refused by config in staging and production (L3).
 */
export class DemoStack extends Stack {
  constructor(scope: Construct, id: string, props: DemoStackProps) {
    super(scope, id, props);
    Tags.of(this).add('project', 'nextkin');
    Tags.of(this).add('environment', 'demo');

    const network = new Network(this, 'Network');
    const data = new Data(this, 'Data', network);
    const edge = new Edge(this, 'Edge', network, data);
    data.allowBrowserUploads(edge.appOrigin);
    const services = new Services(this, 'Services', {
      network,
      data,
      appOrigin: edge.appOrigin,
      webDataSource: props.webDataSource,
    });
    edge.routeTo(services.web, data);

    // Read by scripts/run-task.mjs and aws/infra/README.md.
    const output = (id: string, value: string) => new CfnOutput(this, id, { value });
    output('AppUrl', edge.appOrigin);
    output('ClusterName', services.cluster.clusterName);
    output('Subnets', network.vpc.publicSubnets.map((s) => s.subnetId).join(','));
    output('AppSecurityGroup', network.appSg.securityGroupId);
    output('DbRolesTask', services.oneOff.dbRoles.taskDefinitionArn);
    output('MigrateTask', services.oneOff.migrate.taskDefinitionArn);
    output('SeedTask', services.oneOff.seed.taskDefinitionArn);
    output('OpenRouterSecret', data.openRouterKey.secretName);
    output('SeedPasswordSecret', data.seedPassword.secretName);
    output('SeedTotpSecret', data.seedTotp.secretName);
  }
}
