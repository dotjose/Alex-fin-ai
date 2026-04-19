module "sqs" {
  source                     = "../sqs_agent_queue"
  name_prefix                = var.name_prefix
  visibility_timeout_seconds = var.visibility_timeout_seconds
  max_receive_count          = var.max_receive_count
}
