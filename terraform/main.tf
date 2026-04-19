locals {
  project = "alex"
  name    = local.project

  external_agent_arns = {
    tagger     = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.tagger_function)
    reporter   = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.reporter_function)
    charter    = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.charter_function)
    retirement = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.retirement_function)
  }

  child_invoke_arn_list = values(local.external_agent_arns)

  api_base_effective = trimspace(var.api_base_url) != "" ? var.api_base_url : module.api.api_endpoint

  frontend_base_effective = trimspace(var.frontend_url) != "" ? var.frontend_url : local.api_base_effective

  lambda_env_core = {
    NODE_ENV                      = var.node_env
    AGENT_EXECUTION_MODE          = "lambda"
    OPENAI_AGENTS_DISABLE_TRACING = "true"
    OTEL_SERVICE_NAME             = "alexfin-agent"
    LANGFUSE_TRACING_ENVIRONMENT  = var.node_env
    LANGFUSE_TRACING_ENV          = var.node_env
    API_BASE_URL                  = local.api_base_effective
    FRONTEND_URL                  = local.frontend_base_effective
    CLERK_JWT_ISSUER              = var.clerk_jwt_issuer
    SUPABASE_URL                  = var.supabase_url
    SUPABASE_SERVICE_ROLE_KEY     = var.supabase_service_role_key
    SUPABASE_DATABASE_URL         = var.supabase_database_url
    OPENROUTER_API_KEY            = var.openrouter_api_key
    OR_MODEL_SIMPLE               = trimspace(var.or_model_simple) != "" ? var.or_model_simple : "openai/gpt-4o-mini"
    OR_MODEL_FAST                 = trimspace(var.or_model_fast) != "" ? var.or_model_fast : "openai/gpt-4o-mini"
    OR_MODEL_REASONING            = trimspace(var.or_model_reasoning) != "" ? var.or_model_reasoning : "openai/gpt-4o"
    POLYGON_API_KEY               = var.polygon_api_key
    AWS_REGION                    = var.aws_region
    AWS_REGION_NAME               = var.aws_region
    DEFAULT_AWS_REGION            = var.aws_region
    SQS_QUEUE_URL                 = module.sqs.queue_url
    S3_BUCKET_UI                  = module.s3_cloudfront.bucket_id
    TAGGER_FUNCTION               = var.tagger_function
    REPORTER_FUNCTION             = var.reporter_function
    CHARTER_FUNCTION              = var.charter_function
    RETIREMENT_FUNCTION           = var.retirement_function
  }

  lambda_env_langfuse = (
    trimspace(var.langfuse_public_key) != "" && trimspace(var.langfuse_secret_key) != ""
    ) ? {
    LANGFUSE_PUBLIC_KEY = var.langfuse_public_key
    LANGFUSE_SECRET_KEY = var.langfuse_secret_key
    LANGFUSE_HOST       = trimspace(var.langfuse_host) != "" ? var.langfuse_host : "https://cloud.langfuse.com"
  } : {}

  lambda_env_clerk_secret = trimspace(var.clerk_secret_key) != "" ? { CLERK_SECRET_KEY = var.clerk_secret_key } : {}

  lambda_env = merge(
    local.lambda_env_core,
    local.lambda_env_langfuse,
    local.lambda_env_clerk_secret,
    trimspace(var.or_model_embedding) != "" ? { OR_MODEL_EMBEDDING = var.or_model_embedding } : {},
    trimspace(var.clerk_jwt_audience) != "" ? { CLERK_JWT_AUDIENCE = var.clerk_jwt_audience } : {},
    trimspace(var.openai_api_key) != "" ? { OPENAI_API_KEY = var.openai_api_key } : {}
  )
}

module "network" {
  source = "./modules/network"
}

module "api" {
  source                    = "./modules/api"
  name_prefix               = local.name
  cors_allow_origin_primary = var.cors_allow_origin_primary
}

module "sqs" {
  source                     = "./modules/sqs"
  name_prefix                = local.name
  visibility_timeout_seconds = 910
  max_receive_count          = 3
}

module "s3_cloudfront" {
  source                 = "./modules/s3-cloudfront"
  name_prefix            = local.name
  comment                = "${local.name} UI + API (private S3 + OAC)"
  ui_bucket_name         = "${local.name}-ui-${data.aws_caller_identity.current.account_id}"
  http_api_origin_domain = replace(module.api.api_endpoint, "https://", "")
}

module "iam" {
  source                   = "./modules/iam_agent_runtime"
  name_prefix              = local.name
  queue_arn                = module.sqs.queue_arn
  child_lambda_invoke_arns = local.child_invoke_arn_list
}

data "aws_iam_policy_document" "sqs_queue_access" {
  statement {
    sid    = "ApiEnqueue"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [module.iam.api_role_arn]
    }
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [module.sqs.queue_arn]
  }

  statement {
    sid    = "WorkerConsume"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [module.iam.worker_role_arn]
    }
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueUrl",
    ]
    resources = [module.sqs.queue_arn]
  }
}

resource "aws_sqs_queue_policy" "main" {
  queue_url = module.sqs.queue_id
  policy    = data.aws_iam_policy_document.sqs_queue_access.json
}

module "lambda" {
  source                 = "./modules/lambda"
  name_prefix            = local.name
  api_function_name      = "${local.name}-api"
  worker_function_name   = "${local.name}-planner-worker"
  api_role_arn           = module.iam.api_role_arn
  worker_role_arn        = module.iam.worker_role_arn
  api_image_uri          = var.api_image_uri
  worker_image_uri       = var.worker_image_uri
  queue_arn              = module.sqs.queue_arn
  environment            = local.lambda_env
  api_timeout_seconds    = 30
  api_memory_mb          = 1024
  worker_timeout_seconds = 900
  worker_memory_mb       = 2048
  api_id                 = module.api.id
  api_execution_arn      = module.api.execution_arn
  depends_on             = [aws_sqs_queue_policy.main, module.iam]
}
