variable "name_prefix" {
  type = string
}

variable "cors_allow_origin_primary" {
  type        = string
  default     = ""
  description = "Browser origin for API Gateway CORS. Empty allows *."
}
