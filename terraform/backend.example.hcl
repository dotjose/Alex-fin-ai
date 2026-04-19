# Optional: local / manual runs against the same remote state CI uses.
# After one successful deploy, copy bucket from: terraform -chdir=bootstrap output
#
# CI writes cideploy.backend.hcl from bootstrap outputs (S3 native locking, Terraform >= 1.10).

bucket       = "REPLACE_WITH_BOOTSTRAP_state_bucket"
key          = "alex-financial-adviser/main/terraform.tfstate"
region       = "us-east-1"
use_lockfile = true
encrypt      = true
