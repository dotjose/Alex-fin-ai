# Optional: local / manual runs against the same remote state CI uses.
# After one successful deploy, copy bucket and dynamodb_table from:
#   terraform -chdir=bootstrap output
# Or set bucket/table to the resources created by bootstrap (see terraform/README.md).
#
# CI does not use this file; it writes cideploy.backend.hcl from bootstrap outputs.

bucket         = "REPLACE_WITH_BOOTSTRAP_state_bucket"
key            = "alex-financial-adviser/main/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "REPLACE_WITH_BOOTSTRAP_lock_table"
encrypt        = true
