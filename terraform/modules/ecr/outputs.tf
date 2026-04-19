output "repository_url" {
  description = "Registry URL for docker login / image URI prefix"
  value       = aws_ecr_repository.api.repository_url
}

output "repository_name" {
  description = "ECR repository name (aws ecr describe-images)"
  value       = aws_ecr_repository.api.name
}

output "repository_arn" {
  value = aws_ecr_repository.api.arn
}
