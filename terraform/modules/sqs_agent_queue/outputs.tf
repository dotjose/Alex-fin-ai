output "queue_id" {
  value = aws_sqs_queue.main.id
}

output "queue_arn" {
  value = aws_sqs_queue.main.arn
}

output "queue_url" {
  value = aws_sqs_queue.main.url
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}
