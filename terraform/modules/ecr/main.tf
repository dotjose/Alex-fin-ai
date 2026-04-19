data "aws_caller_identity" "current" {}

locals {
  default_repository_name = "${var.name_prefix}-api-${data.aws_caller_identity.current.account_id}"
  repository_name = (
    var.repository_name_override != null && var.repository_name_override != ""
    ? var.repository_name_override
    : local.default_repository_name
  )
}

resource "aws_ecr_repository" "api" {
  count = var.creation_mode == "create" ? 1 : 0
  name  = local.repository_name

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

data "aws_ecr_repository" "imported" {
  count = var.creation_mode == "import" ? 1 : 0
  name  = local.repository_name
}

locals {
  repository_name_resolved = var.creation_mode == "create" ? aws_ecr_repository.api[0].name : data.aws_ecr_repository.imported[0].name
  repository_arn_resolved  = var.creation_mode == "create" ? aws_ecr_repository.api[0].arn : data.aws_ecr_repository.imported[0].arn
  repository_url_resolved  = var.creation_mode == "create" ? aws_ecr_repository.api[0].repository_url : data.aws_ecr_repository.imported[0].repository_url
}

resource "aws_ecr_repository_policy" "lambda_pull" {
  repository = local.repository_name_resolved

  policy = jsonencode({
    Version = "2008-10-17"
    Statement = [{
      Sid    = "LambdaServicePull"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = [
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchCheckLayerAvailability",
      ]
      Resource = local.repository_arn_resolved
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}
