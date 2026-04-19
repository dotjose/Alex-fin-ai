# Contract for GitHub Actions: use `terraform output -raw <name>`.

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
  description = "Direct API Gateway HTTP API base URL (bypasses CloudFront)."
  value       = module.api.api_endpoint
}

output "frontend_url" {
  description = "Static UI + /api proxy (CloudFront HTTPS URL)."
  value       = module.s3_cloudfront.cloudfront_https_url
}

output "healthcheck_url" {
  description = "GET health via CloudFront → API Gateway → Lambda (/api/health)."
  value       = "${trimsuffix(module.s3_cloudfront.cloudfront_https_url, "/")}/api/health"
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
  description = "Private ECR repository URL for docker push."
  value       = module.ecr.repository_url
}

output "repository_url" {
  description = "Alias of ecr_repository_url (single ECR module)."
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
  description = "Managed API + planner worker ARNs (when deployed), plus expected child agent ARNs."
  value = merge(
    (
      local.lambda_api_arn != ""
      ? {
        api            = local.lambda_api_arn
        planner_worker = local.lambda_worker_arn
      }
      : {}
    ),
    local.external_agent_arns
  )
}

output "lambda_api_function_name" {
  value = local.lambda_api_name
}

output "planner_worker_lambda_name" {
  value = local.lambda_worker_name
}

output "planner_worker_sqs_event_source_state" {
  value = join("", [for m in module.lambda : m.worker_event_source_state])
}

output "planner_worker_event_source_mapping_uuid" {
  value = join("", [for m in module.lambda : m.worker_event_source_uuid])
}

output "verify_sqs_lambda_mapping_cli" {
  description = "Debug CLI hint."
  value       = local.lambda_worker_name != "" ? "aws lambda list-event-source-mappings --function-name ${local.lambda_worker_name} --region ${data.aws_region.current.name}" : ""
}

output "frontend_url_effective" {
  description = "Deprecated alias of cloudfront_url."
  value       = module.s3_cloudfront.cloudfront_https_url
}
