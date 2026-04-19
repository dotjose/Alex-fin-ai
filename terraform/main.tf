locals {
  project = "alex"
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.project}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]
    allow_origins = (
      trimspace(var.cors_allow_origin_primary) != ""
      ? [trimspace(var.cors_allow_origin_primary)]
      : ["*"]
    )
    expose_headers = []
    max_age        = 86400
  }
}

locals {
  name = local.project

  api_base_effective = trimspace(var.api_base_url) != "" ? var.api_base_url : aws_apigatewayv2_api.http.api_endpoint

  frontend_base_effective = trimspace(var.frontend_url) != "" ? var.frontend_url : local.api_base_effective

  external_agent_arns = {
    tagger     = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.tagger_function)
    reporter   = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.reporter_function)
    charter    = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.charter_function)
    retirement = format("arn:aws:lambda:%s:%s:function:%s", data.aws_region.current.name, data.aws_caller_identity.current.account_id, var.retirement_function)
  }

  child_invoke_arn_list = values(local.external_agent_arns)

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
    OR_MODEL_SIMPLE               = var.or_model_simple
    OR_MODEL_FAST                 = var.or_model_fast
    OR_MODEL_REASONING            = var.or_model_reasoning
    POLYGON_API_KEY               = var.polygon_api_key
    AWS_REGION                    = var.aws_region
    AWS_REGION_NAME               = var.aws_region
    DEFAULT_AWS_REGION            = var.aws_region
    SQS_QUEUE_URL                 = module.sqs.queue_url
    S3_BUCKET_UI                  = module.s3_ui.bucket_id
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

module "sqs" {
  source                     = "./modules/sqs_agent_queue"
  name_prefix                = local.name
  visibility_timeout_seconds = 910
  max_receive_count          = 3
}

module "s3_ui" {
  source      = "./modules/s3_ui"
  bucket_name = "${local.name}-ui-${data.aws_caller_identity.current.account_id}"
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

module "compute" {
  source                 = "./modules/compute_lambdas"
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
  depends_on             = [aws_sqs_queue_policy.main, module.iam]
}

module "http_api" {
  source               = "./modules/http_api_lambda"
  api_id               = aws_apigatewayv2_api.http.id
  api_execution_arn    = aws_apigatewayv2_api.http.execution_arn
  lambda_invoke_arn    = module.compute.api_invoke_arn
  lambda_function_name = module.compute.api_function_name
  depends_on           = [module.compute, aws_apigatewayv2_api.http]
}

module "cdn" {
  source                  = "./modules/cdn_ui_api"
  name_prefix             = local.name
  comment                 = "${local.name} UI + API (private S3 + OAC)"
  s3_bucket_id            = module.s3_ui.bucket_id
  s3_bucket_arn           = module.s3_ui.bucket_arn
  s3_regional_domain_name = module.s3_ui.bucket_regional_domain_name
  http_api_origin_domain  = replace(aws_apigatewayv2_api.http.api_endpoint, "https://", "")
  depends_on              = [module.s3_ui, aws_apigatewayv2_api.http]
}
