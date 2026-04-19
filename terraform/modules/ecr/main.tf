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

resource "aws_ecr_repository_policy" "lambda_pull" {
  repository = aws_ecr_repository.api.name

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
      Resource = aws_ecr_repository.api.arn
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}
