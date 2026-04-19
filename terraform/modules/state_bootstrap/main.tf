data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  region_slug       = replace(data.aws_region.current.name, "-", "")
  state_bucket_name = "${var.name_prefix}-terraform-state-${data.aws_caller_identity.current.account_id}-${local.region_slug}"
}

data "aws_s3_bucket" "existing" {
  count  = var.adopt_existing_state_bucket ? 1 : 0
  bucket = local.state_bucket_name
}

resource "aws_s3_bucket" "tf_state" {
  count  = var.adopt_existing_state_bucket ? 0 : 1
  bucket = local.state_bucket_name
}

locals {
  state_bucket_id = var.adopt_existing_state_bucket ? data.aws_s3_bucket.existing[0].id : aws_s3_bucket.tf_state[0].id
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = local.state_bucket_id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = local.state_bucket_id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = local.state_bucket_id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
