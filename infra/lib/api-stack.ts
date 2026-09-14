import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

/**
 * Empty. Intended to hold the Lambda side of the app (see PROJECT_CONTEXT §4).
 *
 * Note this stack no longer owns CloudFront or S3 — web-stack.ts does. When the
 * API arrives it should add a *behaviour* to WebStack's existing distribution
 * (e.g. `/api/*`), not create a second distribution: the certificate covers one
 * set of domain names and only one distribution can serve them.
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'InfraQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
