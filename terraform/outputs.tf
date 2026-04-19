output "cloudfront_url" {
  value       = module.cdn.cloudfront_https_url
  description = "Public site + same-origin /api/*"
}

output "api_base_url" {
  value       = module.cdn.cloudfront_https_url
  description = "NEXT_PUBLIC_API_URL (browser uses this host for /api/...)"
}

output "api_gateway_endpoint" {
  value       = aws_apigatewayv2_api.http.api_endpoint
  description = "Direct API Gateway URL (debugging; prefer cloudfront_url in clients)"
}

output "api_gateway_url" {
  value       = aws_apigatewayv2_api.http.api_endpoint
  description = "Alias of api_gateway_endpoint for CI contracts"
}

output "sqs_queue_url" {
  value = module.sqs.queue_url
}

output "sqs_queue_arn" {
  value       = module.sqs.queue_arn
  description = "Planner worker event source queue ARN"
}

output "s3_bucket" {
  value       = module.s3_ui.bucket_id
  description = "Next static export target"
}

output "s3_bucket_ui" {
  value       = module.s3_ui.bucket_id
  description = "Legacy alias of s3_bucket"
}

output "cloudfront_distribution_id" {
  value = module.cdn.distribution_id
}

output "cloudfront_domain" {
  value = module.cdn.distribution_domain_name
}

output "lambda_function_arns" {
  value = merge(
    {
      api            = module.compute.api_function_arn
      planner_worker = module.compute.worker_function_arn
    },
    local.external_agent_arns
  )
  description = "Managed Lambdas + expected child agent function ARNs (children must exist separately or invokes fail)"
}

output "planner_worker_lambda_name" {
  value = module.compute.worker_function_name
}

output "planner_worker_sqs_event_source_state" {
  value = module.compute.worker_event_source_state
}

output "planner_worker_event_source_mapping_uuid" {
  value = module.compute.worker_event_source_uuid
}

output "verify_sqs_lambda_mapping_cli" {
  value       = "aws lambda list-event-source-mappings --function-name ${module.compute.worker_function_name} --region ${data.aws_region.current.name}"
  description = "Empty list = wrong region/account or mapping missing"
}

output "frontend_url_effective" {
  value       = module.cdn.cloudfront_https_url
  description = "Deprecated alias for cloudfront_url"
}
