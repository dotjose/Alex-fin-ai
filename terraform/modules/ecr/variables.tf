variable "name_prefix" {
  type = string
}

variable "creation_mode" {
  type        = string
  description = "create = Terraform owns aws_ecr_repository; import = reference existing repo by name (no create, avoids RepositoryAlreadyExistsException)."
  default     = "create"

  validation {
    condition     = contains(["create", "import"], var.creation_mode)
    error_message = "creation_mode must be create or import."
  }
}

variable "repository_name_override" {
  type        = string
  default     = null
  nullable    = true
  description = "If set, use this ECR repository name instead of {name_prefix}-api-{account_id}."
}
