output "queue_url" {
  description = "Primary SQS queue URL"
  value       = module.queue.queue_url
}

output "queue_arn" {
  description = "Primary SQS queue ARN"
  value       = module.queue.queue_arn
}

output "queue_id" {
  description = "Primary SQS queue ID (for queue policy)"
  value       = module.queue.queue_id
}

output "dlq_arn" {
  description = "Dead-letter queue ARN"
  value       = module.queue.dlq_arn
}
