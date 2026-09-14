/**
 * CI/CD identity: the role GitHub Actions assumes to publish web/dist, federated
 * through the account's existing GitHub OIDC provider.
 *
 * Separate from WebStack on purpose. The OIDC provider is an account-level
 * singleton — IAM rejects a second provider for the same issuer URL, and
 * CloudFormation has no "create if absent" — so it must outlive any one site
 * stack and be reusable by ApiStack/SyncStack deploys later. WebStack passes its
 * bucket and distribution in, which under cdk.json's
 * `@aws-cdk/core:defaultCrossStackReferences: "weak"` becomes a
 * Fn::GetStackOutput lookup rather than a hard export.
 *
 * There are no long-lived access keys anywhere in this repo. Every credential
 * the workflow uses is a short-lived STS session minted from a GitHub-signed
 * JWT, gated by the trust policy below.
 */
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

/** Condition keys are prefixed with the issuer host, without the scheme. */
const CLAIM = 'token.actions.githubusercontent.com';

/**
 * Immutable GitHub identifiers for github.com/smanraj54/portfolio, from
 * `gh api repos/smanraj54/portfolio`. Unlike the owner/repo names these survive
 * a rename or transfer, which is exactly why the trust policy pins them.
 */
const GITHUB_REPOSITORY_ID = '1368190511';
const GITHUB_REPOSITORY_OWNER_ID = '39916561';

/** Only this branch may deploy. Also excludes fork PRs, whose ref is refs/pull/N/merge. */
const GITHUB_DEPLOY_REF = 'refs/heads/main';

/**
 * The `sub` claim this repository's tokens actually carry. IAM refuses any
 * OIDC trust policy that does not constrain `sub` (or `job_workflow_ref`), so
 * this is mandatory, not belt-and-braces — the id conditions below are what
 * make it tamper-proof.
 *
 * The prefix is the immutable format: owner and repo names each followed by
 * `@<id>`. This repo was created 2026-09-13, after GitHub's 2026-07-15 cutoff,
 * so it never emits the legacy `repo:owner/name:...` form. Verified, not
 * guessed — `gh api repos/smanraj54/portfolio/actions/oidc/customization/sub`
 * returns exactly this `sub_claim_prefix` with `use_immutable_subject: true`.
 * Re-run that command if federation ever starts failing with a "Not authorized
 * to perform sts:AssumeRoleWithWebIdentity" error.
 */
const GITHUB_SUB = `repo:smanraj54@${GITHUB_REPOSITORY_OWNER_ID}/portfolio@${GITHUB_REPOSITORY_ID}:ref:${GITHUB_DEPLOY_REF}`;

/**
 * Fixed so the workflow can name the ARN directly. It cannot come from a stack
 * output: reading outputs requires already holding the role.
 */
export const WEB_DEPLOY_ROLE_NAME = 'portfolio-web-deploy';

export interface CicdStackProps extends cdk.StackProps {
  /** Origin bucket the role may write to — and only this one. */
  readonly siteBucket: s3.IBucket;
  /** Distribution the role may invalidate — and only this one. */
  readonly distribution: cloudfront.IDistribution;
  /** Stack whose outputs the workflow reads to find the bucket and distribution. */
  readonly webStackName: string;
}

export class CicdStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    // Imported, not created. The provider is a per-account, per-issuer singleton:
    // IAM returns 409 AlreadyExists for a second one, and CloudFormation cannot
    // express "create only if absent". Owning it here would mean any rollback
    // that retains it (as an account-wide resource must be retained) permanently
    // wedges every later create of this stack. Importing is idempotent instead.
    //
    // Its ARN is deterministic — issuer host, no region — so this needs no
    // context lookup and no cdk.context.json entry.
    //
    // Bootstrap for a fresh account, once, before the first deploy:
    //   aws iam create-open-id-connect-provider \
    //     --url https://token.actions.githubusercontent.com \
    //     --client-id-list sts.amazonaws.com
    // No --thumbprint-list: IAM retrieves and pins the issuer's intermediate CA
    // itself, so a hardcoded thumbprint only creates an outage when GitHub
    // rotates certificates.
    const githubOidcProvider = iam.OidcProviderNative.fromOidcProviderArn(
      this,
      'GithubOidcProvider',
      this.formatArn({
        service: 'iam',
        region: '', // IAM is global; a region here yields an ARN IAM will reject.
        resource: 'oidc-provider',
        resourceName: CLAIM,
        arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
      }),
    );

    this.deployRole = new iam.Role(this, 'WebDeployRole', {
      roleName: WEB_DEPLOY_ROLE_NAME,
      description: 'GitHub Actions OIDC: sync web/dist to S3 and invalidate CloudFront',
      // Matches configure-aws-credentials' default session length. Do not
      // shorten to 15min — a large sync plus invalidation can outlive it.
      maxSessionDuration: cdk.Duration.hours(1),
      // Scoped to this one repository and branch.
      //
      // `sub` alone would be enough for IAM, but it is name-based: the owner and
      // repo names inside it are re-registerable, so it is deliberately not the
      // only pin. The id conditions carry the real weight — they are immutable,
      // survive a rename or transfer, and cannot be acquired by someone who
      // claims a freed-up username. `ref` is kept alongside `sub` because it
      // stays valid if GitHub revises the sub format again, as it did in 2026.
      //
      // Every condition is an exact match. A wildcard here is how these roles
      // get taken over — StringLike `repo:owner*` also matches `owner-evil`.
      assumedBy: new iam.OpenIdConnectPrincipal(githubOidcProvider, {
        StringEquals: {
          [`${CLAIM}:aud`]: 'sts.amazonaws.com',
          [`${CLAIM}:sub`]: GITHUB_SUB,
          [`${CLAIM}:repository_owner_id`]: GITHUB_REPOSITORY_OWNER_ID,
          [`${CLAIM}:repository_id`]: GITHUB_REPOSITORY_ID,
          [`${CLAIM}:ref`]: GITHUB_DEPLOY_REF,
        },
      }),
    });

    // Hand-written statements, not bucket.grantReadWrite(). grantReadWrite would
    // add s3:GetObject* and s3:PutObjectAcl among others; a local→S3 `aws s3
    // sync` needs neither. It lists the destination to diff, then PUTs. ACLs are
    // disabled on the bucket anyway (bucket-owner-enforced), and SSE-S3 means no
    // kms:* is required on either side.
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ListSiteBucket',
        // What sync uses to diff local against remote. Bucket ARN, not objects.
        actions: ['s3:ListBucket'],
        resources: [props.siteBucket.bucketArn],
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'WriteSiteObjects',
        // DeleteObject is what `--delete` needs; AbortMultipartUpload is what a
        // failed large upload needs to avoid leaving billable orphan parts.
        actions: ['s3:PutObject', 's3:DeleteObject', 's3:AbortMultipartUpload'],
        resources: [props.siteBucket.arnForObjects('*')],
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadWebStackOutputs',
        actions: ['cloudformation:DescribeStacks'],
        // Stack ARNs end in a generated id, hence the trailing wildcard. Scoped
        // to this one stack so the role cannot enumerate the account's others.
        resources: [
          this.formatArn({
            service: 'cloudformation',
            resource: 'stack',
            resourceName: `${props.webStackName}/*`,
            arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          }),
        ],
      }),
    );
    // Renders cloudfront:CreateInvalidation on this distribution's ARN only —
    // the account holds an unrelated distribution that must stay untouchable.
    props.distribution.grantCreateInvalidation(this.deployRole);

    new cdk.CfnOutput(this, 'WebDeployRoleArn', {
      value: this.deployRole.roleArn,
      description: 'Role ARN for .github/workflows/deploy-web.yml',
    });
  }
}
