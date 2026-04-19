# Contract for GitHub Actions: use `terraform output -raw <name>`; avoid `-json` until Lambdas exist.

output "cloudfront_url" {
  description = "Public site origin (same-origin /api/* via CloudFront → API Gateway)."
  value       = module.s3_cloudfront.cloudfront_https_url
}

output "api_base_url" {
  description = "Browser API origin for Next (same as cloudfront_url for same-origin /api)."
  value       = module.s3_cloudfront.cloudfront_https_url
}

output "api_gateway_endpoint" {
  description = "Direct API Gateway HTTP API URL (debugging)."
  value       = module.api.api_endpoint
}

output "api_gateway_url" {
  description = "Alias of api_gateway_endpoint for CI."
  value       = module.api.api_endpoint
}

output "sqs_queue_url" {
  description = "Primary agent queue URL."
  value       = module.sqs.queue_url
}

output "sqs_queue_arn" {
  description = "Primary agent queue ARN."
  value       = module.sqs.queue_arn
}

output "s3_bucket_ui" {
  description = "Private UI bucket for Next static export."
  value       = module.s3_cloudfront.bucket_id
}

output "s3_bucket_name" {
  description = "UI bucket name (Next static export / aws s3 sync target)."
  value       = module.s3_cloudfront.bucket_id
}

output "ui_bucket_name" {
  description = "Alias of s3_bucket_name for CI scripts."
  value       = module.s3_cloudfront.bucket_id
}

output "s3_bucket" {
  description = "Backward-compatible alias of s3_bucket_ui."
  value       = module.s3_cloudfront.bucket_id
}

output "ecr_repository_url" {
  description = "Private ECR repository URL for docker push (no secret required)."
  value       = module.ecr.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name for describe-images / IAM scoping."
  value       = module.ecr.repository_name
}

output "cloudfront_distribution_id" {
  value = module.s3_cloudfront.distribution_id
}

output "cloudfront_domain" {
  value = module.s3_cloudfront.distribution_domain_name
}

output "lambda_function_arns" {
  description = "Managed API + planner worker ARNs, plus expected child agent ARNs (requires Lambdas applied)."
  value = merge(
    {
      api            = module.lambda.api_function_arn
      planner_worker = module.lambda.worker_function_arn
    },
    local.external_agent_arns
  )
}

output "planner_worker_lambda_name" {
  value = module.lambda.worker_function_name
}

output "planner_worker_sqs_event_source_state" {
  value = module.lambda.worker_event_source_state
}

output "planner_worker_event_source_mapping_uuid" {
  value = module.lambda.worker_event_source_uuid
}

output "verify_sqs_lambda_mapping_cli" {
  description = "Empty list = wrong region/account or mapping missing."
  value       = "aws lambda list-event-source-mappings --function-name ${module.lambda.worker_function_name} --region ${data.aws_region.current.name}"
}

output "frontend_url_effective" {
  description = "Deprecated alias of cloudfront_url."
  value       = module.s3_cloudfront.cloudfront_https_url
}
