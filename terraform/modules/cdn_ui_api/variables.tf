variable "name_prefix" {
  type = string
}

variable "comment" {
  type = string
}

variable "s3_bucket_id" {
  type = string
}

variable "s3_bucket_arn" {
  type = string
}

variable "s3_regional_domain_name" {
  type = string
}

variable "http_api_origin_domain" {
  type        = string
  description = "API Gateway hostname only (no https://)"
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}
