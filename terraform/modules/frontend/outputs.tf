output "bucket_id" {
  value = module.s3_ui.bucket_id
}

output "bucket_arn" {
  value = module.s3_ui.bucket_arn
}

output "cloudfront_https_url" {
  value = module.cdn.cloudfront_https_url
}

output "distribution_id" {
  value = module.cdn.distribution_id
}

output "distribution_domain_name" {
  value = module.cdn.distribution_domain_name
}
