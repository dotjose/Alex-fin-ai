variable "name_prefix" {
  type        = string
  description = "Prefix for Terraform state bucket and lock table names"
}

variable "adopt_existing_state_bucket" {
  type        = bool
  description = "When true, reference an existing S3 bucket by name (no create). Use when BucketAlreadyExists but state was lost."
  default     = false
}
