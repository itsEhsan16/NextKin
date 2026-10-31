import { Duration } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

import type { Data } from './data';
import type { Network } from './network';

const VERIFY_HEADER = 'X-Origin-Verify';

/**
 * The front door (toreview §133). CloudFront's default *.cloudfront.net domain gives HTTPS without
 * our own domain; the load balancer answers 403 unless CloudFront's secret header is present.
 * CloudFront to the load balancer is plain HTTP until nextkin.ai has a certificate.
 *
 * Route classes follow aws/architecture.md: nothing private is cached, and compression is off for
 * the app because it would buffer the SSE progress and assistant streams.
 */
export class Edge extends Construct {
  readonly alb: elbv2.ApplicationLoadBalancer;
  readonly listener: elbv2.ApplicationListener;
  readonly distribution: cloudfront.Distribution;
  /** https://<id>.cloudfront.net: the app's origin and the API's public URL. */
  readonly appOrigin: string;

  constructor(scope: Construct, id: string, network: Network, data: Data) {
    super(scope, id);

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: network.vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: network.albSg,
      // Long-lived SSE connections (generation progress, the assistant).
      idleTimeout: Duration.seconds(120),
      dropInvalidHeaderFields: true,
    });
    this.listener = this.alb.addListener('Http', {
      port: 80,
      // `open: false` keeps the security group as Network wrote it: CloudFront only.
      open: false,
      defaultAction: elbv2.ListenerAction.fixedResponse(403, {
        contentType: 'text/plain',
        messageBody: 'Forbidden',
      }),
    });

    const origin = new origins.HttpOrigin(this.alb.loadBalancerDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      readTimeout: Duration.seconds(60),
      keepaliveTimeout: Duration.seconds(60),
      customHeaders: { [VERIFY_HEADER]: data.originVerify.secretValue.unsafeUnwrap() },
    });

    this.distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'NextKin demo',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Cookies, query strings, every header, plus CloudFront-Viewer-Address for the client IP.
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
        compress: false,
      },
      additionalBehaviors: {
        // Content-hashed filenames: safe to cache for good.
        '/_next/static/*': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
    });
    this.appOrigin = `https://${this.distribution.distributionDomainName}`;
  }

  /** Sends CloudFront's requests (and only those) to the web service. */
  routeTo(web: ecs.FargateService, data: Data): void {
    this.listener.addTargets('Web', {
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.httpHeader(VERIFY_HEADER, [
          data.originVerify.secretValue.unsafeUnwrap(),
        ]),
      ],
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [web],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        // Liveness only. /health/deep would drain every task when a dependency blips (R-08).
        path: '/api/v1/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(15),
      },
    });
  }
}
