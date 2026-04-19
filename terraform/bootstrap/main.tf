locals {
  name_prefix = "alex"
}

module "state" {
  source      = "../modules/state_bootstrap"
  name_prefix = local.name_prefix
}
