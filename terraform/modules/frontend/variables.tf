variable "name_prefix" {
  type = string
}

variable "comment" {
  type = string
}

variable "ui_bucket_name" {
  type = string
}

variable "http_api_origin_domain" {
  type        = string
  description = "API Gateway origin hostname without https://"
}
