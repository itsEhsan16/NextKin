import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import type * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface AppDomainProps {
  /** The app's own name, e.g. app.nextkin.ai. */
  name: string;
  /**
   * Phase 2: the certificate, the distribution's alias and the records. Off until the subdomain is
   * delegated at the registrar, because DNS validation waits on it (toreview §165).
   */
  live: boolean;
}

/**
 * The demo's own address (owner, 2026-11-04, toreview §165). `nextkin.ai` stays on Namecheap's DNS
 * with its email forwarding; only this subdomain is delegated to a Route 53 zone of its own, by four
 * NS records at Namecheap. Phase 1 creates the zone and outputs its nameservers; phase 2 adds an
 * ACM certificate (us-east-1, as CloudFront needs) validated in that zone, and the A/AAAA aliases.
 */
export class AppDomain extends Construct {
  readonly name: string;
  readonly zone: route53.PublicHostedZone;
  readonly certificate: acm.Certificate | undefined;

  constructor(scope: Construct, id: string, props: AppDomainProps) {
    super(scope, id);
    this.name = props.name;
    this.zone = new route53.PublicHostedZone(this, 'Zone', {
      zoneName: props.name,
      comment: `NextKin demo: ${props.name}, delegated from the registrar's nextkin.ai DNS`,
    });
    this.certificate = props.live
      ? new acm.Certificate(this, 'Certificate', {
          domainName: props.name,
          validation: acm.CertificateValidation.fromDns(this.zone),
        })
      : undefined;
  }

  /** The A and AAAA aliases from the name to the distribution (phase 2 only). */
  pointAt(distribution: cloudfront.IDistribution): void {
    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
    new route53.ARecord(this, 'Alias', { zone: this.zone, target });
    new route53.AaaaRecord(this, 'AliasV6', { zone: this.zone, target });
  }
}
