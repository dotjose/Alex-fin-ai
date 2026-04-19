# GitHub Actions maps repository/Environment configuration to TF_VAR_* (see .github/workflows/deploy.yml).
# Required for Lambda: supabase_*, openrouter_api_key, clerk_jwt_issuer; optional OR_MODEL_* (empty uses defaults in main.tf locals).

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "enable_lambda_compute" {
  type        = bool
  description = "When false, API/worker Lambdas and API Gateway integrations are not managed (foundation: ECR, S3, CloudFront, SQS, IAM only). CI sets false until images exist in ECR."
  default     = true
}

variable "ecr_repository_creation_mode" {
  type        = string
  description = "create = Terraform creates the repo; import = use data.aws_ecr_repository (repo must already exist — avoids RepositoryAlreadyExistsException when state was lost)."
  default     = "create"

  validation {
    condition     = contains(["create", "import"], var.ecr_repository_creation_mode)
    error_message = "ecr_repository_creation_mode must be create or import."
  }
}

variable "ecr_repository_name_override" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional ECR repository name override (passed to modules/ecr)."
}

variable "lambda_api_image_tag" {
  type        = string
  description = "ECR image tag when api_image_uri is empty (resolved as repository_url:tag). CI sets e.g. commitSha-api."
  default     = ""
}

variable "lambda_worker_image_tag" {
  type        = string
  description = "ECR image tag when worker_image_uri is empty."
  default     = ""
}

variable "api_image_uri" {
  type        = string
  description = "Optional full private ECR URI (overrides repository_url:lambda_api_image_tag when non-empty)."
  default     = ""
  validation {
    condition = (
      !var.enable_lambda_compute
      || trimspace(var.api_image_uri) == ""
      || can(regex("^\\d{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/[^:]+(@sha256:[a-f0-9]{64}|:[a-zA-Z0-9._-]+)$", trimspace(var.api_image_uri)))
    )
    error_message = "api_image_uri must be empty or a full private ECR URI (registry/...:tag or @sha256:...)."
  }
}

variable "worker_image_uri" {
  type        = string
  description = "Optional full private ECR URI for worker (overrides repository_url:lambda_worker_image_tag when non-empty)."
  default     = ""
  validation {
    condition = (
      !var.enable_lambda_compute
      || trimspace(var.worker_image_uri) == ""
      || can(regex("^\\d{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/[^:]+(@sha256:[a-f0-9]{64}|:[a-zA-Z0-9._-]+)$", trimspace(var.worker_image_uri)))
    )
    error_message = "worker_image_uri must be empty or a full private ECR URI."
  }
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
