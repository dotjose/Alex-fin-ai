variable "aws_region" {
  type        = string
  description = "AWS region for state bucket and lock table"
}

variable "bootstrap_adopt_existing_state_bucket" {
  type        = bool
  description = "When true, adopt existing state bucket (see modules/state_bootstrap)."
  default     = false
}
