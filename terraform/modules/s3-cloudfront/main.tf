# S3 static hosting + CloudFront (OAC) in front of API Gateway origin (implementation in frontend stack).
module "ui" {
  source                 = "../frontend"
  name_prefix            = var.name_prefix
  comment                = var.comment
  ui_bucket_name         = var.ui_bucket_name
  http_api_origin_domain = var.http_api_origin_domain
}
