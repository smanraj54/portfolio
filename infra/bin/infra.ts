#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CicdStack } from '../lib/cicd-stack';
import { DataStack } from '../lib/data-stack';
import { WebStack } from '../lib/web-stack';

const DOMAIN_NAME = 'manrajsingh.ca';

/** Issued in us-east-1, covering the apex and *.manrajsingh.ca. Imported, never created. */
const CERTIFICATE_ARN =
  'arn:aws:acm:us-east-1:593793064239:certificate/160321c7-4a71-41c1-ae31-b943b20ef56a';

const app = new cdk.App();

// WebStack looks the hosted zone up at synth time, which needs a *resolved*
// account — an unresolved token makes the lookup either throw
// StackAccountRegionNotSpecified or quietly emit zone id "DUMMY" into every DNS
// record. CDK_DEFAULT_ACCOUNT is only populated when the CDK CLI invokes this
// app, so fail loudly rather than synthesizing something that deploys wrong.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? app.node.tryGetContext('account');
if (!account) {
  throw new Error(
    'No AWS account resolved. Run through the CDK CLI with AWS_PROFILE=portfolio, ' +
      'or pass -c account=<id>.',
  );
}

new DataStack(app, 'DataStack', {
  env: { account, region: process.env.CDK_DEFAULT_REGION },
});

// us-east-1 is not a preference: CloudFront only accepts certificates from that
// region, and HostedZone.fromLookup refuses an env-agnostic stack outright.
const webStack = new WebStack(app, 'WebStack', {
  env: { account, region: 'us-east-1' },
  domainName: DOMAIN_NAME,
  certificateArn: CERTIFICATE_ARN,
});

// Same region so the workflow's `describe-stacks --region us-east-1` finds both.
new CicdStack(app, 'CicdStack', {
  env: { account, region: 'us-east-1' },
  siteBucket: webStack.siteBucket,
  distribution: webStack.distribution,
  webStackName: webStack.stackName,
});
