data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "api" {
  name = "${var.name_prefix}-api-${data.aws_caller_identity.current.account_id}"

  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  lifecycle {
    prevent_destroy = true
  }
}
