"""Boto3 session and clients — explicit ``region_name`` (AWS_REGION), no anonymous use for SQS."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Optional, Tuple
from urllib.parse import urlparse

if TYPE_CHECKING:
    from core.config import Settings

logger = logging.getLogger(__name__)


def sqs_queue_url_identity(queue_url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse region + 12-digit account from a standard queue URL, e.g.:
    https://sqs.us-east-1.amazonaws.com/123456789012/my-queue
    """
    raw = (queue_url or "").strip()
    if not raw:
        return None, None
    try:
        u = urlparse(raw)
        host = (u.hostname or "").lower()
        m = re.match(r"^sqs\.([a-z0-9-]+)\.amazonaws\.com$", host)
        region = m.group(1) if m else None
        segs = [s for s in (u.path or "").split("/") if s]
        acct = None
        if len(segs) >= 2 and re.fullmatch(r"\d{12}", segs[0] or ""):
            acct = segs[0]
        return region, acct
    except Exception:
        return None, None


def log_sqs_url_vs_credentials(settings: "Settings", queue_url: str, *, context: str) -> None:
    """
    Log full queue URL and compare URL region/account to API AWS_REGION and STS caller.
    Catches wrong queue (other account/region) while SQS send can still succeed.
    """
    q_region, q_account = sqs_queue_url_identity(queue_url)
    api_region = (settings.aws_region or "").strip() or "us-east-1"
    logger.info(
        "%s QUEUE_URL=%s parsed_queue_region=%s parsed_queue_account=%s api_AWS_REGION=%s",
        context,
        queue_url,
        q_region,
        q_account,
        api_region,
    )
    if q_region and q_region != api_region:
        logger.error(
            "%s SQS region mismatch: queue URL is %s but API AWS_REGION is %s — "
            "SQS client uses API region; planner mapping must use the SAME region as this queue.",
            context,
            q_region,
            api_region,
        )
    try:
        session = boto3_session_for_api(settings)
        ident = session.client("sts").get_caller_identity()
        c_acct = str(ident.get("Account") or "")
        arn = str(ident.get("Arn") or "")
        logger.info("%s sts_caller_account=%s sts_arn=%s", context, c_acct, arn)
        if q_account and c_acct and q_account != c_acct:
            logger.error(
                "%s SQS queue account %s != STS caller account %s — messages go to a queue "
                "the planner Lambda in this deployment will never consume.",
                context,
                q_account,
                c_acct,
            )
    except Exception as e:
        logger.warning("%s sts_get_caller_identity skipped: %s", context, e)

def credential_source_hint(settings: "Settings") -> str:
    if (settings.aws_profile or "").strip():
        return "AWS_PROFILE"
    if (settings.aws_access_key_id or "").strip() and (settings.aws_secret_access_key or "").strip():
        return "static_env_keys"
    return "default_chain"


_AWS_CREDENTIALS_ERROR = (
    "AWS credentials not configured. Run aws configure or set AWS_PROFILE. "
    "Alternatively set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (and optional "
    "AWS_SESSION_TOKEN for temporary credentials). "
    "Verify with: aws sts get-caller-identity"
)


def boto3_session_for_api(settings: "Settings"):
    """Build a Session with explicit ``region_name`` and optional profile / static keys."""
    import boto3

    region = (settings.aws_region or "").strip() or "us-east-1"
    kwargs: dict = {"region_name": region}

    profile = (settings.aws_profile or "").strip()
    if profile:
        kwargs["profile_name"] = profile

    access = (settings.aws_access_key_id or "").strip()
    secret = (settings.aws_secret_access_key or "").strip()
    if access and secret:
        kwargs["aws_access_key_id"] = access
        kwargs["aws_secret_access_key"] = secret
        token = (settings.aws_session_token or "").strip()
        if token:
            kwargs["aws_session_token"] = token

    return boto3.Session(**kwargs)


def validate_boto_credentials_when_sqs_configured(settings: "Settings") -> None:
    """
    When ``SQS_QUEUE_URL`` is set, require resolvable credentials (env keys, profile,
    shared config, or Lambda execution role). Fails fast to avoid NoCredentialsError on
    first ``send_message``.
    """
    if not (settings.sqs_queue_url or "").strip():
        return

    if settings.node_env == "development":
        access = (settings.aws_access_key_id or "").strip()
        secret = (settings.aws_secret_access_key or "").strip()
        if access and not secret:
            raise ValueError(
                "AWS_ACCESS_KEY_ID is set but AWS_SECRET_ACCESS_KEY is missing. "
                "Set both, or remove the key variables and use AWS_PROFILE / aws configure."
            )
        if secret and not access:
            raise ValueError(
                "AWS_SECRET_ACCESS_KEY is set but AWS_ACCESS_KEY_ID is missing. "
                "Set both, or use AWS_PROFILE / aws configure instead."
            )

    session = boto3_session_for_api(settings)
    creds = session.get_credentials()
    if creds is None:
        raise ValueError(_AWS_CREDENTIALS_ERROR)

    logger.info(
        "AWS credentials resolved for SQS (region=%s, credential_source=%s)",
        (settings.aws_region or "").strip() or "us-east-1",
        credential_source_hint(settings),
    )


def get_sqs_client(settings: "Settings"):
    """Return a boto3 SQS client using ``region_name`` from settings (AWS_REGION)."""
    session = boto3_session_for_api(settings)
    region = (settings.aws_region or "").strip() or "us-east-1"
    return session.client("sqs", region_name=region)
