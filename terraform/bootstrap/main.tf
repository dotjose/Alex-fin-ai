locals {
  name_prefix = "alex"
}

module "state" {
  source                      = "../modules/state_bootstrap"
  name_prefix                 = local.name_prefix
  adopt_existing_state_bucket = var.bootstrap_adopt_existing_state_bucket
}
