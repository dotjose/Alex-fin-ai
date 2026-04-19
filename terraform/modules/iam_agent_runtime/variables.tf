variable "name_prefix" {
  type = string
}

variable "queue_arn" {
  type = string
}

variable "child_lambda_invoke_arns" {
  type        = list(string)
  description = "Concrete function ARNs the planner may invoke (no wildcards)"
}
