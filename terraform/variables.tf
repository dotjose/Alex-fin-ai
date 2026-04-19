# GitHub Actions maps repository/Environment configuration to TF_VAR_* (see .github/workflows/deploy.yml).
# Required for Lambda: supabase_*, openrouter_api_key, clerk_jwt_issuer; optional OR_MODEL_* (empty uses defaults in main.tf locals).

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "api_image_uri" {
  type        = string
  description = "Container image for the FastAPI (Mangum) Lambda. CI replaces with ECR digest after first push."
  default     = "public.ecr.aws/lambda/python:3.12-x86_64"
}

variable "worker_image_uri" {
  type        = string
  description = "Container image for the SQS planner worker (same digest as API is typical)."
  default     = "public.ecr.aws/lambda/python:3.12-x86_64"
}

variable "supabase_url" {
  type = string
}

variable "supabase_service_role_key" {
  type      = string
  sensitive = true
}

variable "supabase_database_url" {
  type        = string
  sensitive   = true
  description = "Postgres connection URI for SQL migrations at Lambda cold start (Supabase → Database). Not the REST URL."
}

variable "openrouter_api_key" {
  type      = string
  sensitive = true
}

variable "or_model_simple" {
  type        = string
  default     = "openai/gpt-4o-mini"
  description = "OpenRouter model id (override via TF_VAR in CI)"
}

variable "or_model_fast" {
  type        = string
  default     = "openai/gpt-4o-mini"
  description = "OpenRouter model id (override via TF_VAR in CI)"
}

variable "or_model_reasoning" {
  type        = string
  default     = "openai/gpt-4o"
  description = "OpenRouter model id (override via TF_VAR in CI)"
}

variable "or_model_embedding" {
  type        = string
  default     = ""
  description = "If set, passed to Lambda as OR_MODEL_EMBEDDING"
}

variable "polygon_api_key" {
  type        = string
  default     = ""
  description = "Optional market data key; empty disables Polygon-backed features that require it."
}

variable "langfuse_public_key" {
  type        = string
  default     = ""
  description = "Optional; omit or leave empty to disable Langfuse env on Lambdas."
}
variable "langfuse_secret_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Optional; must be set together with langfuse_public_key when tracing is enabled."
}

variable "langfuse_host" {
  type    = string
  default = "https://cloud.langfuse.com"
}

variable "openai_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "clerk_jwt_issuer" { type = string }

variable "clerk_secret_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Optional Clerk secret for server-side Clerk APIs; JWT validation uses JWKS + issuer without this."
}

variable "cors_allow_origin_primary" {
  type        = string
  default     = ""
  description = "Browser origin for API Gateway CORS (CloudFront URL). Empty = allow * (first CI phase only)."
}

variable "clerk_jwt_audience" {
  type        = string
  default     = ""
  description = "If set, passed to Lambda as CLERK_JWT_AUDIENCE"
}

variable "node_env" {
  type    = string
  default = "production"
}

variable "api_base_url" {
  type        = string
  default     = ""
  description = "Public API base URL; leave empty on first apply (API Gateway), then CI re-applies with CloudFront URL"
}

variable "frontend_url" {
  type        = string
  default     = ""
  description = "Browser origin for CORS; leave empty on first apply, then CI re-applies with CloudFront URL"
}

variable "tagger_function" {
  type    = string
  default = "alex-tagger"
}

variable "reporter_function" {
  type    = string
  default = "alex-reporter"
}

variable "charter_function" {
  type    = string
  default = "alex-charter"
}

variable "retirement_function" {
  type    = string
  default = "alex-retirement"
}
