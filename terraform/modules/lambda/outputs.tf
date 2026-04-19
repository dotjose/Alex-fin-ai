output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "ecr_repository_name" {
  value = module.ecr.repository_name
}

output "api_function_name" {
  value = module.compute.api_function_name
}

output "api_function_arn" {
  value = module.compute.api_function_arn
}

output "api_invoke_arn" {
  value = module.compute.api_invoke_arn
}

output "worker_function_name" {
  value = module.compute.worker_function_name
}

output "worker_function_arn" {
  value = module.compute.worker_function_arn
}

output "worker_event_source_state" {
  value = module.compute.worker_event_source_state
}

output "worker_event_source_uuid" {
  value = module.compute.worker_event_source_uuid
}
