import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * The demo's network (toreview §133). Two AZs, no NAT gateway: tasks sit in public subnets with
 * public IPs so they can reach OpenRouter and the image registries, and the security groups admit
 * only the load balancer. The database has isolated subnets with no internet route at all.
 */
export class Network extends Construct {
  readonly vpc: ec2.Vpc;
  /** The load balancer: port 80 from CloudFront's origin-facing addresses only. */
  readonly albSg: ec2.SecurityGroup;
  /** Web, worker and the one-off tasks (roles, migrate, seed). */
  readonly appSg: ec2.SecurityGroup;
  /** Valkey (6379) and Mailpit (1025), for the app only. */
  readonly supportSg: ec2.SecurityGroup;
  /** ClamAV's clamd (3310), for the app only. */
  readonly clamavSg: ec2.SecurityGroup;
  /** The LaTeX compile service (8790), for the app only (toreview §137). */
  readonly latexSg: ec2.SecurityGroup;
  /** Aurora (5432), for the app only. */
  readonly dbSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    // Free, and keeps document traffic to S3 off the public internet.
    this.vpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });

    const group = (name: string, description: string) =>
      new ec2.SecurityGroup(this, name, { vpc: this.vpc, description, allowAllOutbound: true });

    this.albSg = group('Alb', 'NextKin demo load balancer: CloudFront only');
    const cloudFront = ec2.PrefixList.fromLookup(this, 'CloudFront', {
      prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
    });
    this.albSg.addIngressRule(
      ec2.Peer.prefixList(cloudFront.prefixListId),
      ec2.Port.tcp(80),
      'CloudFront origin-facing',
    );

    this.appSg = group('App', 'NextKin demo web, worker and one-off tasks');
    this.appSg.addIngressRule(this.albSg, ec2.Port.tcp(3000), 'Load balancer to web');

    this.supportSg = group('Support', 'NextKin demo Valkey and Mailpit');
    this.supportSg.addIngressRule(this.appSg, ec2.Port.tcp(6379), 'App to Valkey');
    this.supportSg.addIngressRule(this.appSg, ec2.Port.tcp(1025), 'App to Mailpit SMTP');

    this.clamavSg = group('Clamav', 'NextKin demo ClamAV');
    this.clamavSg.addIngressRule(this.appSg, ec2.Port.tcp(3310), 'App to clamd');

    this.latexSg = group('Latex', 'NextKin demo LaTeX compile service');
    this.latexSg.addIngressRule(this.appSg, ec2.Port.tcp(8790), 'App to the LaTeX service');

    this.dbSg = group('Db', 'NextKin demo Aurora');
    this.dbSg.addIngressRule(this.appSg, ec2.Port.tcp(5432), 'App to Postgres');
  }
}
