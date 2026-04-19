output "api_function_name" {
  value = aws_lambda_function.api.function_name
}

output "api_function_arn" {
  value = aws_lambda_function.api.arn
}

output "api_invoke_arn" {
  value = aws_lambda_function.api.invoke_arn
}

output "worker_function_name" {
  value = aws_lambda_function.worker.function_name
}

output "worker_function_arn" {
  value = aws_lambda_function.worker.arn
}

output "worker_event_source_state" {
  value = aws_lambda_event_source_mapping.worker_sqs.state
}

output "worker_event_source_uuid" {
  value = aws_lambda_event_source_mapping.worker_sqs.uuid
}
