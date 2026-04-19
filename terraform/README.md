# Terraform (modular AWS)

Layout:

| Path | Role |
|------|------|
| `versions.tf` / `providers.tf` | Backend + AWS provider |
| `main.tf` | Composition: HTTP API shell, SQS, S3, IAM, Lambdas, HTTP integration, CDN |
| `modules/sqs_agent_queue` | Main queue + DLQ, SSE, redrive |
| `modules/s3_ui` | Private UI bucket (encryption, blocked public access) |
| `modules/iam_agent_runtime` | Split roles: API = SQS send only; worker = SQS consume + scoped `lambda:InvokeFunction` |
| `modules/compute_lambdas` | Container API + planner worker + SQS event source mapping |
| `modules/http_api_lambda` | API Gateway → Lambda integration (API resource lives in root to break graph cycles) |
| `modules/cdn_ui_api` | CloudFront + S3 OAC + bucket policy (CloudFront-only `s3:GetObject`) |

## GitHub repository variables (required for CI)

These are **not** Terraform variables; the workflow writes `terraform/cideploy.backend.hcl` from them and fails preflight if they are missing.

| Variable | Purpose |
|----------|---------|
| `AWS_REGION` | AWS region for providers, ECR, S3 sync, and remote state bucket |
| `TF_STATE_BUCKET` | S3 bucket holding the Terraform state object |
| `TF_STATE_LOCK_TABLE` | DynamoDB table used for state locking |
| `TF_STATE_KEY` | Optional. State object key inside the bucket (default: `alex-financial-adviser/terraform.tfstate`) |
| `AWS_AUTH_MODE` | Optional. `oidc` (default) or `keys`. Selects **one** AWS credential mechanism for the deploy job |
| `NEXT_PUBLIC_API_ORIGIN` | Optional. `cloudfront` (default) or `apigateway`. Chooses which Terraform output feeds `NEXT_PUBLIC_API_URL` at build time |
| `OR_MODEL_SIMPLE`, `OR_MODEL_FAST`, `OR_MODEL_REASONING` | OpenRouter model ids for Lambda |
| `OR_MODEL_EMBEDDING` | Optional embedding model id |
| `LANGFUSE_HOST` | Optional Langfuse host when tracing secrets are set |

## Outputs → CI (`infra.json`)

Stable keys: `cloudfront_url`, `api_base_url`, `sqs_queue_url`, `s3_bucket`, `s3_bucket_ui`, `api_gateway_endpoint`, `api_gateway_url`, `lambda_function_arns` (map: `api`, `planner_worker`, plus **expected** child function ARNs for tagger/reporter/charter/retirement — those functions must exist and use a compatible image, or invokes fail).

## State migration

If you previously applied the **flat** `main.tf` layout, resource addresses changed (modules). Either:

- Apply from a **fresh** remote state (destroy old stack first in a throwaway account), or  
- Use `terraform state mv` / `moved` blocks to map old resources into modules (account-specific; not committed here).

## Env & secrets

- **Terraform / Lambda**: `OPENROUTER_API_KEY`, Supabase, `CLERK_JWT_ISSUER`, optional `CLERK_SECRET_KEY`, `SQS_QUEUE_URL`, `S3_BUCKET_UI`, model env, etc. — passed as `TF_VAR_*` / Lambda `environment` only from CI secrets.
- **Next.js build**: `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_APP_URL` from outputs; Clerk **publishable** key only — never `CLERK_SECRET_KEY` in the frontend job.

## Infra risks (read before prod)

1. **Child agent Lambdas** (`alex-tagger`, `alex-reporter`, …) are **not** defined in this stack; IAM allows invoke only on those concrete ARNs. You must deploy those functions separately (container/zip) with handlers that match the planner contract.
2. **Single API image** only includes `planner` + `apps/api` paths in the Dockerfile; extending it to ship all agents in one image is a separate build change.
3. **Private S3 + OAC**: direct `s3://` URLs are not public; only CloudFront serves the UI bucket.
4. **No global 404→index.html** on CloudFront: doing so would break JSON `404`s from `/api/*`. Next static export should use real paths or a client router that matches exported routes.

See `.github/workflows/deploy.yml` for the canonical CI flow.
