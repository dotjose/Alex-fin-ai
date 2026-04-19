resource "aws_lambda_function" "api" {
  function_name = var.api_function_name
  role          = var.api_role_arn
  package_type  = "Image"
  image_uri     = var.api_image_uri
  timeout       = var.api_timeout_seconds
  memory_size   = var.api_memory_mb
  architectures = ["x86_64"]

  environment {
    variables = var.environment
  }

  image_config {
    command = var.api_image_command
  }
}

resource "aws_lambda_function" "worker" {
  function_name = var.worker_function_name
  role          = var.worker_role_arn
  package_type  = "Image"
  image_uri     = var.worker_image_uri
  timeout       = var.worker_timeout_seconds
  memory_size   = var.worker_memory_mb
  architectures = ["x86_64"]

  environment {
    variables = var.environment
  }

  image_config {
    command = var.worker_image_command
  }
}

resource "aws_lambda_event_source_mapping" "worker_sqs" {
  event_source_arn                   = var.queue_arn
  function_name                      = aws_lambda_function.worker.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0
  enabled                            = true
  function_response_types            = ["ReportBatchItemFailures"]

  depends_on = [aws_lambda_function.worker]
}
