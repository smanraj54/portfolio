/**
 * CicdStack is the security boundary of the deploy pipeline: it decides which
 * GitHub workflow, on which branch, may write to the live site. These assertions
 * are the guard against that boundary quietly widening — an over-broad trust
 * condition or a `Resource: "*"` deploys just as cleanly as a correct one.
 */
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib/core';
import { CicdStack, WEB_DEPLOY_ROLE_NAME } from '../lib/cicd-stack';
import { WebStack } from '../lib/web-stack';

const CLAIM = 'token.actions.githubusercontent.com';
const ENV = { account: '123456789012', region: 'us-east-1' };

function synth(): Template {
  const app = new cdk.App();
  // Fed from a real WebStack rather than imported fixtures, so this also proves
  // the two stacks actually compose.
  const webStack = new WebStack(app, 'WebStack', {
    env: ENV,
    domainName: 'manrajsingh.ca',
    certificateArn: `arn:aws:acm:us-east-1:123456789012:certificate/${'0'.repeat(8)}`,
  });
  const stack = new CicdStack(app, 'CicdStack', {
    env: ENV,
    siteBucket: webStack.siteBucket,
    distribution: webStack.distribution,
    webStackName: webStack.stackName,
  });
  return Template.fromStack(stack);
}

function trustStatement(): {
  Principal: { Federated: unknown };
  Condition: Record<string, Record<string, string>>;
} {
  const role = Object.values(synth().findResources('AWS::IAM::Role'))[0];
  return role.Properties.AssumeRolePolicyDocument.Statement[0];
}

function trustConditions(): Record<string, Record<string, string>> {
  return trustStatement().Condition;
}

describe('CicdStack', () => {
  describe('federation', () => {
    // The provider is an account-wide singleton that IAM will not let this stack
    // create twice, so the stack must reference it rather than own it — no
    // AWS::IAM::OIDCProvider of either flavour, and no Lambda-backed custom
    // resource to create one.
    it('references the account provider instead of creating one', () => {
      const template = synth();
      template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
      template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 0);
    });

    it('trusts only GitHub as the federated issuer', () => {
      expect(JSON.stringify(trustStatement().Principal.Federated)).toContain(
        `:iam::${ENV.account}:oidc-provider/${CLAIM}`,
      );
    });

    it('exchanges the token via web identity, never a static key', () => {
      synth().hasResourceProperties('AWS::IAM::Role', {
        RoleName: WEB_DEPLOY_ROLE_NAME,
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRoleWithWebIdentity',
              Effect: 'Allow',
              Principal: { Federated: Match.anyValue() },
            }),
          ]),
        }),
      });
    });
  });

  describe('trust policy is scoped to this repo and branch', () => {
    it('pins the audience, the subject, the immutable repo ids, and the ref', () => {
      expect(trustConditions().StringEquals).toEqual({
        [`${CLAIM}:aud`]: 'sts.amazonaws.com',
        [`${CLAIM}:sub`]: 'repo:smanraj54@39916561/portfolio@1368190511:ref:refs/heads/main',
        [`${CLAIM}:repository_owner_id`]: '39916561',
        [`${CLAIM}:repository_id`]: '1368190511',
        [`${CLAIM}:ref`]: 'refs/heads/main',
      });
    });

    // IAM rejects the role outright unless one of these two is constrained, so
    // losing the sub condition is a deploy-time failure, not a silent widening.
    it('constrains sub, which IAM requires', () => {
      const pinned = Object.keys(trustConditions().StringEquals);
      expect(pinned).toContain(`${CLAIM}:sub`);
    });

    // A wildcard anywhere in a trust condition is how these roles get taken over
    // — e.g. `repo:owner*` also matches `owner-evil`. Nothing here should need one.
    it('uses no wildcard matching', () => {
      const conditions = trustConditions();
      expect(Object.keys(conditions)).toEqual(['StringEquals']);
      for (const value of Object.values(conditions.StringEquals)) {
        expect(value).not.toContain('*');
      }
    });
  });

  describe('least privilege', () => {
    function statements(): { Sid?: string; Action: unknown; Resource: unknown }[] {
      const policy = Object.values(synth().findResources('AWS::IAM::Policy'))[0];
      return policy.Properties.PolicyDocument.Statement;
    }

    it('grants no action on every resource', () => {
      for (const statement of statements()) {
        // Resource is a string, a token object, or an array of either.
        expect([statement.Resource].flat()).not.toContainEqual('*');
      }
    });

    it('grants no wildcard actions', () => {
      for (const statement of statements()) {
        for (const action of [statement.Action].flat()) {
          expect(action).not.toContain('*');
        }
      }
    });

    it('grants exactly what the workflow calls and nothing more', () => {
      const granted = statements()
        .flatMap((statement) => [statement.Action].flat())
        .sort();
      expect(granted).toEqual([
        'cloudformation:DescribeStacks',
        'cloudfront:CreateInvalidation',
        's3:AbortMultipartUpload',
        's3:DeleteObject',
        's3:ListBucket',
        's3:PutObject',
      ]);
    });

    // grantReadWrite would add these. A publish-only pipeline never reads objects
    // back, and ACLs are disabled on the bucket anyway.
    it.each(['s3:GetObject', 's3:PutObjectAcl', 'iam:PassRole', 'cloudfront:UpdateDistribution'])(
      'does not grant %s',
      (action) => {
        const granted = statements().flatMap((statement) => [statement.Action].flat());
        expect(granted).not.toContain(action);
      },
    );

    it('scopes stack reads to WebStack alone', () => {
      const statement = statements().find((s) => s.Sid === 'ReadWebStackOutputs');
      expect(JSON.stringify(statement?.Resource)).toContain('stack/WebStack/*');
    });
  });
});
