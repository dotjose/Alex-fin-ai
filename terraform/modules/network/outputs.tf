output "availability_zone_names" {
  description = "AZ names for future VPC / data-plane expansion"
  value       = data.aws_availability_zones.available.names
}
