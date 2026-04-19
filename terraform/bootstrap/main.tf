locals {
  name_prefix = "alexfin"
}

module "state" {
  source      = "../modules/state_bootstrap"
  name_prefix = local.name_prefix
}
