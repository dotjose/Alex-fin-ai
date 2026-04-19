# API/worker Lambda (container from private ECR) + API Gateway → Lambda integration.
module "compute" {
  source                 = "../compute_lambdas"
  api_function_name      = var.api_function_name
  worker_function_name   = var.worker_function_name
  api_role_arn           = var.api_role_arn
  worker_role_arn        = var.worker_role_arn
  api_image_uri          = var.api_image_uri
  worker_image_uri       = var.worker_image_uri
  queue_arn              = var.queue_arn
  environment            = var.environment
  api_timeout_seconds    = var.api_timeout_seconds
  api_memory_mb          = var.api_memory_mb
  worker_timeout_seconds = var.worker_timeout_seconds
  worker_memory_mb       = var.worker_memory_mb
  api_image_command      = var.api_image_command
  worker_image_command   = var.worker_image_command
}

module "http_api" {
  source               = "../http_api_lambda"
  api_id               = var.api_id
  api_execution_arn    = var.api_execution_arn
  lambda_invoke_arn    = module.compute.api_invoke_arn
  lambda_function_name = module.compute.api_function_name
  depends_on           = [module.compute]
}
