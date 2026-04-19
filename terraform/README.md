# Terraform (AWS, modular)

## Remote state (self-managed)

There is **no** pre-created S3 bucket for Terraform state.

1. **`terraform/bootstrap/`** — applies `modules/state_bootstrap` using **local** `terraform.tfstate` in that directory. It creates:
   - S3 bucket: `alex-terraform-state-<account_id>-<region_slug>` (region slug = AWS region with `-` removed, e.g. `useast1`)
   - DynamoDB table: `alex-terraform-locks-<account_id>-<region_slug>`
2. **GitHub Actions** copies that local state object to `s3://<state-bucket>/_meta/bootstrap/terraform.tfstate` after each bootstrap apply so the next run can **restore** it (bootstrap stays idempotent).
3. **`terraform/` (main stack)** uses `backend "s3"` with partial config written at apply time as `cideploy.backend.hcl` (gitignored), pointing at the bucket and lock table from bootstrap outputs.

Local development against real AWS: copy `backend.example.hcl` to `backend.local.hcl`, set `bucket` / `dynamodb_table` from bootstrap outputs (or reuse the same bucket after one CI run), then `terraform init -backend-config=backend.local.hcl -reconfigure`.

## Layout

| Path | Role |
|------|------|
| `bootstrap/` | One-shot stack: state bucket + lock table only |
| `modules/state_bootstrap/` | S3 + DynamoDB for Terraform remote state |
| `modules/network/` | Availability zones (substrate for future VPC work) |
| `modules/api/` | HTTP API (API Gateway v2) + CORS |
| `modules/worker/` | SQS main queue + DLQ (wraps `sqs_agent_queue`) |
| `modules/frontend/` | UI S3 + CloudFront + OAC (wraps `s3_ui` + `cdn_ui_api`) |
| `modules/ecr_api/` | Private ECR repository for the API/worker image |
| `modules/iam_agent_runtime/` | Split IAM: API vs worker |
| `modules/compute_lambdas/` | Container Lambdas + SQS event source mapping |
| `modules/http_api_lambda/` | API Gateway → Lambda integration |
| `main.tf` | Root composition |

## GitHub (CI)

Deploy uses **static AWS access keys** in the workflow job environment (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). Region is fixed to **`us-east-1`** in the workflow (change there if you use another region).

**Repository variables (required):** `SUPABASE_URL`, `CLERK_JWT_ISSUER` (public values; passed as `TF_VAR_*`).

**Repository secrets (required):** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL`, `OPENROUTER_API_KEY`.

**Not used:** `TF_STATE_BUCKET`, `AWS_ROLE_ARN`, `ECR_REPOSITORY`, OIDC.

Optional Lambda features (Polygon, Langfuse, OpenAI, Clerk JWT audience) use Terraform defaults unless you extend the workflow with more `TF_VAR_*` entries.

## Outputs → CI (`infra.json`)

Stable keys include: `cloudfront_url`, `api_base_url`, `sqs_queue_url`, `s3_bucket_name`, `s3_bucket_ui`, `cloudfront_distribution_id`, `ecr_repository_url`, `ecr_repository_name`, `api_gateway_url`, `lambda_function_arns`.

## IAM for the deploy IAM user / key

The principal whose access keys run CI needs at least:

- **Bootstrap:** `s3:CreateBucket`, `s3:PutBucketVersioning`, `s3:PutEncryptionConfiguration`, `s3:PutBucketPublicAccessBlock`, `s3:GetObject`/`PutObject`/`DeleteObject`/`ListBucket` on `arn:aws:s3:::alex-terraform-state-*` and objects (state + `_meta/bootstrap/*`).
- **DynamoDB:** create/describe/update on lock tables matching `alex-terraform-locks-*`.
- **Main stack:** standard permissions for Lambda, API Gateway v2, CloudFront, SQS, IAM, ECR, S3 (application buckets), etc.

Tighten ARNs once the first bootstrap run has created the real bucket and table names.

## State migration

If you previously applied an older root module layout, resource addresses may have changed. Use a fresh account/region, or `terraform state mv` / `moved` blocks (not committed here).

## Env & secrets

- **Lambda:** Supabase, OpenRouter, `CLERK_JWT_ISSUER`, optional `CLERK_SECRET_KEY`, `SQS_QUEUE_URL`, `S3_BUCKET_UI`, `API_BASE_URL`, `FRONTEND_URL` — set from Terraform `locals.lambda_env` fed by `TF_VAR_*` in CI. `API_BASE_URL` / `FRONTEND_URL` / CORS are re-applied after `cloudfront_url` is known (two-phase apply in CI).
- **Next.js build:** `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL` from `terraform output -json` only; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from the **single** GitHub secret of that name.

## Infra risks (read before prod)

1. **Child agent Lambdas** (`alex-tagger`, …) are not defined in this stack; IAM allows invoke only on those ARNs. Deploy them separately or adjust `var.tagger_function` / IAM.
2. **Placeholder Lambda images** use the public Lambda Python base image until the first successful ECR push in CI; the workflow immediately reapplies with the real digest.
3. **Private S3 + OAC:** the UI bucket is not public; only CloudFront reads objects.
4. **No global 404→index.html** on CloudFront (would break `/api/*` JSON 404s).

See `.github/workflows/deploy.yml` for the canonical CI flow.
