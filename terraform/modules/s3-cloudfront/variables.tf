variable "name_prefix" {
  type = string
}

variable "comment" {
  type        = string
  description = "CloudFront distribution comment"
}

variable "ui_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for Next static export"
}

variable "http_api_origin_domain" {
  type        = string
  description = "API Gateway HTTP API hostname without https://"
}
