variable "name_prefix" {
  type = string
}

variable "visibility_timeout_seconds" {
  type    = number
  default = 910
}

variable "max_receive_count" {
  type    = number
  default = 3
}
