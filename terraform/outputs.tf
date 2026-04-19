# Contract for GitHub Actions: parse `terraform output -json` and assert these keys exist.

output "cloudfront_url" {
  description = "Public site origin (same-origin /api/* via CloudFront → API Gateway)."
  value       = module.cdn.cloudfront_https_url
}

output "api_base_url" {
  description = "Browser API origin for Next (here: same as cloudfront_url for BFF-style routing)."
  value       = module.cdn.cloudfront_https_url
}

output "api_gateway_endpoint" {
  description = "Direct API Gateway HTTP API URL (debugging; avoid in browsers in production unless intentional)."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "api_gateway_url" {
  description = "Alias of api_gateway_endpoint for CI and operators."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "sqs_queue_url" {
  description = "Primary agent queue URL (Lambda worker + API producers)."
  value       = module.sqs.queue_url
}

output "sqs_queue_arn" {
  description = "Primary agent queue ARN."
  value       = module.sqs.queue_arn
}

output "s3_bucket_ui" {
  description = "Private UI bucket for Next static export (sync target for CI)."
  value       = module.s3_ui.bucket_id
}

output "s3_bucket" {
  description = "Backward-compatible alias of s3_bucket_ui."
  value       = module.s3_ui.bucket_id
}

output "cloudfront_distribution_id" {
  description = "Distribution id for cache invalidation."
  value       = module.cdn.distribution_id
}

output "cloudfront_domain" {
  description = "CloudFront domain name (e.g. d111111abcdef8.cloudfront.net)."
  value       = module.cdn.distribution_domain_name
}

output "lambda_function_arns" {
  description = "Managed API + planner worker ARNs, plus expected child agent function ARNs (must exist out-of-band)."
  value = merge(
    {
      api            = module.compute.api_function_arn
      planner_worker = module.compute.worker_function_arn
    },
    local.external_agent_arns
  )
}

output "planner_worker_lambda_name" {
  description = "Worker function name (SQS event source mapping checks in CI)."
  value       = module.compute.worker_function_name
}

output "planner_worker_sqs_event_source_state" {
  value = module.compute.worker_event_source_state
}

output "planner_worker_event_source_mapping_uuid" {
  value = module.compute.worker_event_source_uuid
}

output "verify_sqs_lambda_mapping_cli" {
  description = "Empty list = wrong region/account or mapping missing."
  value       = "aws lambda list-event-source-mappings --function-name ${module.compute.worker_function_name} --region ${data.aws_region.current.name}"
}

output "frontend_url_effective" {
  description = "Deprecated alias of cloudfront_url."
  value       = module.cdn.cloudfront_https_url
}
