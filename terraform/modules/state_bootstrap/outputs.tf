output "state_bucket_id" {
  description = "S3 bucket id holding Terraform remote state for the main stack"
  value       = aws_s3_bucket.tf_state.id
}

output "lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking"
  value       = aws_dynamodb_table.tf_locks.name
}

output "aws_region" {
  value = data.aws_region.current.name
}
