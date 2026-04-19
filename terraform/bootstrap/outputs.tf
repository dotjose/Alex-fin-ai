output "state_bucket" {
  description = "S3 bucket for main Terraform remote state"
  value       = module.state.state_bucket_id
}

output "aws_region" {
  value = module.state.aws_region
}
