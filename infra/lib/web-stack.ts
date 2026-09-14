/**
 * Static site hosting: private S3 origin behind CloudFront, custom domain.
 *
 * The load-bearing part of this stack is `errorResponses`. The web app commits
 * to real client-side routes (`/skills`, `/contact`, …) with no server to serve
 * them, so every deep link would 404 without a rewrite back to `/index.html`.
 * See the route policy in web/src/App.tsx.
 *
 * Nothing here creates DNS or TLS — the hosted zone and the certificate are
 * pre-existing and imported.
 */
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export interface WebStackProps extends cdk.StackProps {
  /** Apex domain. The `www.` host is derived from it. */
  readonly domainName: string;
  /** Must be an ISSUED certificate in us-east-1 — CloudFront accepts no other region. */
  readonly certificateArn: string;
}

export class WebStack extends cdk.Stack {
  /** Origin bucket. Exposed so CicdStack can scope the deploy role to it. */
  public readonly siteBucket: s3.Bucket;
  /** Exposed so CicdStack can scope `cloudfront:CreateInvalidation` to it. */
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const apex = props.domainName;
    const www = `www.${apex}`;

    // Import only — never create. `fromLookup` is a synth-time AWS API call, so
    // this stack must be given a concrete account+region (see bin/infra.ts): on
    // an env-agnostic stack it either throws StackAccountRegionNotSpecified or
    // silently bakes the zone id "DUMMY" into every record below. Never synth
    // with --no-lookups, and keep cdk.context.json committed.
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: apex });
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      props.certificateArn,
    );

    // Deliberately NOT a website-endpoint bucket: S3 website endpoints are
    // HTTP-only and cannot be reached with OAC, so the bucket would have to be
    // public. This is a plain REST-endpoint bucket that only CloudFront can read.
    //
    // Object Ownership is left unset, which means bucket-owner-enforced (ACLs
    // disabled). OAC requires that.
    //
    // No `autoDeleteObjects`. With RETAIN it is a synth-time error
    // (CannotAutoDeleteObjectsProperty), and even without RETAIN it would grant
    // a Lambda role s3:PutBucketPolicy and s3:DeleteObject* over the live site
    // bucket, then append a `Deny s3:PutObject` to the very bucket policy that
    // carries the OAC grant — which would break `aws s3 sync` on a retained
    // bucket after a partial delete.
    //
    // No `bucketName`: CloudFormation generates one. An explicit name makes
    // delete-then-recreate fail with BucketAlreadyOwnedByYou. The workflow reads
    // the real name from the stack output instead.
    this.siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Renders `Deny s3:* … aws:SecureTransport=false` for Principal AWS "*",
      // which covers the CloudFront service principal too. Safe ONLY because
      // viewerProtocolPolicy below redirects to HTTPS: an S3 REST origin is
      // always fetched with Match Viewer and that cannot be changed, so
      // switching the viewer policy to ALLOW_ALL would 403 every plain-HTTP hit.
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      domainNames: [apex, www],
      certificate,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        // S3BucketOrigin, not the deprecated S3Origin — the latter still
        // defaults to a legacy origin access identity. `withOriginAccessControl`
        // writes the bucket policy itself, keyed on this distribution's ARN.
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      // The SPA deep-link rewrite. In practice only the 403 entry ever fires:
      // the OAC bucket policy grants s3:GetObject and NOT s3:ListBucket, and S3
      // answers 403 (not 404) for a missing key when the caller cannot list the
      // bucket. The 404 entry is kept because it costs nothing and documents
      // intent if the origin ever gains list permission.
      //
      // ttl 0 means a rewrite is never served stale after a deploy. CloudFront
      // floors error caching at 1s for S3 origins, so it is effectively 1s —
      // each edge miss on a deep link costs one 403 round-trip to S3.
      //
      // Note this cannot mask a wholly broken origin: if /index.html itself is
      // unreadable, CloudFront cannot fetch the error page and returns the
      // origin's status instead. An empty bucket serves 403, not a blank 200.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // One target, four records. AAAA matters because the distribution is
    // dual-stack by default and an IPv6-only client would otherwise fail.
    const aliasTarget = route53.RecordTarget.fromAlias(
      new targets.CloudFrontTarget(this.distribution),
    );
    new route53.ARecord(this, 'ApexAliasRecord', { zone, target: aliasTarget });
    new route53.AaaaRecord(this, 'ApexAliasRecordIpv6', { zone, target: aliasTarget });
    new route53.ARecord(this, 'WwwAliasRecord', {
      zone,
      recordName: 'www',
      target: aliasTarget,
    });
    new route53.AaaaRecord(this, 'WwwAliasRecordIpv6', {
      zone,
      recordName: 'www',
      target: aliasTarget,
    });

    // The deploy workflow reads both of these by OutputKey rather than
    // hardcoding physical ids. They must stay direct children of the stack:
    // makeUniqueId returns a single path component verbatim, so the OutputKey is
    // exactly the construct id. Nested inside a sub-construct it would gain an
    // 8-char hash and the workflow's --query would silently match nothing.
    // No exportName — describe-stacks matches on OutputKey, and a real CFN
    // export becomes immutable once something imports it.
    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: this.siteBucket.bucketName,
      description: 'S3 bucket holding web/dist',
    });
    new cdk.CfnOutput(this, 'SiteDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution to invalidate after a sync',
    });
  }
}
