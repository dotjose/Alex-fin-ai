output "bucket_id" {
  description = "S3 bucket id for UI assets"
  value       = module.ui.bucket_id
}

output "bucket_arn" {
  value = module.ui.bucket_arn
}

output "cloudfront_https_url" {
  description = "Public site URL (https)"
  value       = module.ui.cloudfront_https_url
}

output "distribution_id" {
  value = module.ui.distribution_id
}

output "distribution_domain_name" {
  value = module.ui.distribution_domain_name
}
