# Copy to backend.local.hcl (gitignored) and run:
#   terraform init -backend-config=backend.local.hcl -reconfigure
#
# CI generates cideploy.backend.hcl from GitHub Actions variables instead.

bucket         = "your-terraform-state-bucket"
key            = "alex-financial-adviser/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "your-terraform-locks-table"
encrypt        = true
