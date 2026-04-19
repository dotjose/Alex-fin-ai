resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name_prefix}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]
    allow_origins = (
      trimspace(var.cors_allow_origin_primary) != ""
      ? [trimspace(var.cors_allow_origin_primary)]
      : ["*"]
    )
    expose_headers = []
    max_age        = 86400
  }
}
