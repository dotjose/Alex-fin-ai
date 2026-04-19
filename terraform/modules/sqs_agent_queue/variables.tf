variable "name_prefix" {
  type        = string
  description = "Short name prefix for queue resources"
}

variable "visibility_timeout_seconds" {
  type        = number
  description = "Must be >= Lambda worker timeout (long AI runs)"
  default     = 910
}

variable "max_receive_count" {
  type        = number
  description = "Retries before DLQ"
  default     = 3
}
