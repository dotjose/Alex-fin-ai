output "repository_url" {
  description = "Registry URL for docker login / image URI prefix"
  value       = local.repository_url_resolved
}

output "repository_name" {
  description = "ECR repository name (aws ecr describe-images)"
  value       = local.repository_name_resolved
}

output "repository_arn" {
  value = local.repository_arn_resolved
}
