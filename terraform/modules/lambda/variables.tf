variable "api_function_name" { type = string }
variable "worker_function_name" { type = string }
variable "api_role_arn" { type = string }
variable "worker_role_arn" { type = string }
variable "api_image_uri" { type = string }
variable "worker_image_uri" { type = string }
variable "queue_arn" { type = string }

variable "api_id" { type = string }
variable "api_execution_arn" { type = string }

variable "environment" {
  type        = map(string)
  description = "Lambda environment variables"
}

variable "api_timeout_seconds" {
  type    = number
  default = 30
}
variable "api_memory_mb" {
  type    = number
  default = 1024
}
variable "worker_timeout_seconds" {
  type    = number
  default = 900
}
variable "worker_memory_mb" {
  type    = number
  default = 2048
}

variable "api_image_command" {
  type    = list(string)
  default = ["http_handler.handler"]
}
variable "worker_image_command" {
  type    = list(string)
  default = ["workers.sqs_worker.handler"]
}
