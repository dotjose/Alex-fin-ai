output "api_role_arn" {
  value = aws_iam_role.api.arn
}

output "api_role_id" {
  value = aws_iam_role.api.id
}

output "worker_role_arn" {
  value = aws_iam_role.worker.arn
}

output "worker_role_id" {
  value = aws_iam_role.worker.id
}
