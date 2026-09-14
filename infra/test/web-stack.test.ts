/**
 * These assertions cover the parts of WebStack that fail *silently* — where a
 * wrong template still deploys cleanly and the damage only shows up in a browser
 * or a bill. They are not a restatement of the source.
 *
 * The hosted-zone lookup resolves to CDK's dummy zone here (no cdk.context.json
 * in a unit test), which is fine: nothing below asserts on the zone id.
 */
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib/core';
import { WebStack } from '../lib/web-stack';

const DOMAIN = 'manrajsingh.ca';

function synth(): Template {
  const app = new cdk.App();
  const stack = new WebStack(app, 'WebStack', {
    // Must be a syntactically valid 12-digit account: fromLookup rejects an
    // unresolved one, and CDK's template validation is fatal under this repo's
    // feature flags.
    env: { account: '123456789012', region: 'us-east-1' },
    domainName: DOMAIN,
    certificateArn: `arn:aws:acm:us-east-1:123456789012:certificate/${'0'.repeat(8)}`,
  });
  return Template.fromStack(stack);
}

describe('WebStack', () => {
  describe('SPA deep-link rewrite', () => {
    // The whole reason this stack exists. Without both entries, /skills is a
    // hard 404 in production even though the app handles it client-side.
    it.each([403, 404])('maps %i to /index.html with a 200', (errorCode) => {
      synth().hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CustomErrorResponses: Match.arrayWith([
            Match.objectLike({
              ErrorCode: errorCode,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
          ]),
        }),
      });
    });

    it('does not cache the rewrite, so a deploy is never served stale', () => {
      const responses = Object.values(
        synth().findResources('AWS::CloudFront::Distribution'),
      )[0].Properties.DistributionConfig.CustomErrorResponses;
      for (const response of responses) {
        expect(response.ErrorCachingMinTTL).toBe(0);
      }
    });
  });

  describe('origin is private', () => {
    it('blocks all public access and encrypts at rest', () => {
      synth().hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
          ],
        },
      });
    });

    it('leaves Object Ownership at the default, which OAC requires', () => {
      const bucket = Object.values(synth().findResources('AWS::S3::Bucket'))[0];
      expect(bucket.Properties.OwnershipControls).toBeUndefined();
    });

    it('reaches CloudFront through OAC, not a legacy origin access identity', () => {
      const template = synth();
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
      // S3Origin (deprecated) would emit this instead.
      template.resourceCountIs('AWS::CloudFront::CloudFrontOriginAccessIdentity', 0);
    });

    it('grants read to the CloudFront service principal, scoped by SourceArn', () => {
      synth().hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 's3:GetObject',
              Effect: 'Allow',
              Principal: { Service: 'cloudfront.amazonaws.com' },
              Condition: Match.objectLike({
                StringEquals: Match.objectLike({ 'AWS:SourceArn': Match.anyValue() }),
              }),
            }),
          ]),
        }),
      });
    });
  });

  describe('data safety', () => {
    it('retains the bucket, so a cdk destroy cannot delete the site', () => {
      synth().hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });

    // autoDeleteObjects would attach a Lambda with s3:PutBucketPolicy and
    // s3:DeleteObject* over the live bucket, and mutate the OAC policy on delete.
    it('creates no auto-delete custom resource', () => {
      synth().resourceCountIs('Custom::S3AutoDeleteObjects', 0);
    });

    it('generates the bucket name rather than fixing it', () => {
      const bucket = Object.values(synth().findResources('AWS::S3::Bucket'))[0];
      expect(bucket.Properties.BucketName).toBeUndefined();
    });
  });

  describe('custom domain', () => {
    it('serves both the apex and www on the imported certificate', () => {
      synth().hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Aliases: Match.arrayWith([DOMAIN, `www.${DOMAIN}`]),
          ViewerCertificate: Match.objectLike({
            AcmCertificateArn: Match.stringLikeRegexp('^arn:aws:acm:us-east-1:'),
          }),
        }),
      });
    });

    it('creates no hosted zone or certificate of its own', () => {
      const template = synth();
      template.resourceCountIs('AWS::Route53::HostedZone', 0);
      template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
    });

    // A missing AAAA is invisible until an IPv6-only client shows up.
    it.each([
      ['A', `${DOMAIN}.`],
      ['AAAA', `${DOMAIN}.`],
      ['A', `www.${DOMAIN}.`],
      ['AAAA', `www.${DOMAIN}.`],
    ])('aliases %s %s at the distribution', (type, name) => {
      synth().hasResourceProperties('AWS::Route53::RecordSet', {
        Type: type,
        Name: name,
        AliasTarget: Match.objectLike({ DNSName: Match.anyValue() }),
      });
    });

    it('creates exactly those four records', () => {
      synth().resourceCountIs('AWS::Route53::RecordSet', 4);
    });

    it('redirects http to https', () => {
      synth().hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
          DefaultRootObject: 'index.html',
          PriceClass: 'PriceClass_100',
        }),
      });
    });
  });

  // The deploy workflow reads these by exact key. A hash suffix (which appears
  // if they are ever nested inside a sub-construct) breaks it silently: the
  // --query matches nothing and prints an empty string with exit 0.
  describe('outputs the deploy workflow depends on', () => {
    it.each(['SiteBucketName', 'SiteDistributionId'])('exposes %s unhashed', (key) => {
      expect(Object.keys(synth().findOutputs('*'))).toContain(key);
    });
  });
});
