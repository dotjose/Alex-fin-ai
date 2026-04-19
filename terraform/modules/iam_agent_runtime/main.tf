resource "aws_iam_role" "api" {
  name = "${var.name_prefix}-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role" "worker" {
  name = "${var.name_prefix}-worker-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "api_logs" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "worker_logs" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "api_sqs_send" {
  name = "${var.name_prefix}-api-sqs-send"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "EnqueueAgentJobs"
      Effect   = "Allow"
      Action   = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
      Resource = var.queue_arn
    }]
  })
}

resource "aws_iam_role_policy" "worker_runtime" {
  name = "${var.name_prefix}-worker-runtime"
  role = aws_iam_role.worker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeAgentQueue"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueUrl",
        ]
        Resource = var.queue_arn
      },
      {
        Sid      = "InvokeChildAgentLambdas"
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = var.child_lambda_invoke_arns
      }
    ]
  })
}
