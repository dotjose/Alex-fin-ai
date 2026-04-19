module "s3_ui" {
  source      = "../s3_ui"
  bucket_name = var.ui_bucket_name
}

module "cdn" {
  source                  = "../cdn_ui_api"
  name_prefix             = var.name_prefix
  comment                 = var.comment
  s3_bucket_id            = module.s3_ui.bucket_id
  s3_bucket_arn           = module.s3_ui.bucket_arn
  s3_regional_domain_name = module.s3_ui.bucket_regional_domain_name
  http_api_origin_domain  = var.http_api_origin_domain
  depends_on              = [module.s3_ui]
}
