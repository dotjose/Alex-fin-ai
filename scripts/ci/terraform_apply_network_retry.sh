#!/usr/bin/env bash
# Apply a saved Terraform plan; retry only on common transient AWS / network errors.
set -euo pipefail

PLANFILE=${1:?usage: terraform_apply_network_retry.sh <planfile>}
MAX=${TF_APPLY_MAX_RETRIES:-3}
attempt=1

while [[ "$attempt" -le "$MAX" ]]; do
  LOG="$(mktemp)"

  set +e
  set -o pipefail
  terraform apply -lock-timeout=300s -input=false -auto-approve "$PLANFILE" 2>&1 | tee "$LOG"
  ec=${PIPESTATUS[0]}
  set +o pipefail
  set -e

  if [[ "$ec" -eq 0 ]]; then
    rm -f "$LOG"
    exit 0
  fi

  if grep -qiE \
    'RequestLimitExceeded|ThrottlingException|Throttling|EC2Throttled|ServiceUnavailable|timeout while waiting for plugin|connection reset|TLS handshake timeout|temporary failure in name resolution|i/o timeout|503 Service Unavailable|502 Bad Gateway|TooManyRequests|SlowDown|InternalError.*(Amazon|AWS)|Error acquiring the state lock' \
    "$LOG"
  then
    echo "::warning::Transient Terraform/AWS error (exit ${ec}); retry ${attempt}/${MAX}"
    rm -f "$LOG"
    sleep $((attempt * 20))
    attempt=$((attempt + 1))
    continue
  fi

  rm -f "$LOG"
  exit "$ec"
done

exit 1
