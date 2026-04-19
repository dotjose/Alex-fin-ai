output "state_bucket_id" {
  description = "S3 bucket id holding Terraform remote state for the main stack"
  value       = local.state_bucket_id
}

output "aws_region" {
  value = data.aws_region.current.name
}
