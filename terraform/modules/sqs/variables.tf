variable "name_prefix" {
  type        = string
  description = "Prefix for queue names"
}

variable "visibility_timeout_seconds" {
  type        = number
  default     = 910
  description = "Must be >= Lambda worker timeout"
}

variable "max_receive_count" {
  type        = number
  default     = 3
  description = "Messages before DLQ"
}
