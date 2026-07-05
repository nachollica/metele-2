"""
Email validation for profile updates.

Runs two layered checks before we accept an email change from the user:

1. A hardcoded blocklist of well-known disposable / throwaway mail domains
   (cheapest check, no I/O).
2. ``email-validator`` for syntactic + (optionally) DNS-MX deliverability.

The order matters: the local blocklist short-circuits before we burn DNS
lookups. Each layer raises ``HTTPException(422, …)`` with a user-facing
detail string so the frontend can show the reason verbatim.

Auth0-supplied emails (from social-login ``/userinfo`` payloads) skip this
validator: we trust whatever the provider says about its own users. Only
emails the caller types into the profile editor go through here.
"""

from __future__ import annotations

from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, status

# Hardcoded blocklist. Intentionally small + curated: the goal is to keep
# obvious throwaway services out, not to chase the long tail.
DISPOSABLE_EMAIL_DOMAINS: frozenset[str] = frozenset(
    {
        "10minutemail.com",
        "guerrillamail.com",
        "guerrillamail.net",
        "guerrillamail.org",
        "mailinator.com",
        "mailinator.net",
        "yopmail.com",
        "tempmail.com",
        "temp-mail.org",
        "trashmail.com",
        "trashmail.net",
        "throwawaymail.com",
        "getnada.com",
        "sharklasers.com",
        "fakeinbox.com",
        "maildrop.cc",
        "discard.email",
        "dispostable.com",
        "spam4.me",
        "moakt.com",
    }
)


def _check_hardcoded_blocklist(email: str) -> None:
    """Reject obvious disposable-mail domains we maintain in-process."""
    try:
        domain = email.split("@", 1)[1].lower().strip()
    except IndexError:
        # No '@' at all — leave the precise message to email-validator below.
        return
    if domain in DISPOSABLE_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Disposable email addresses are not allowed.",
        )


def _check_email_validator(email: str, *, check_deliverability: bool) -> str:
    """Run ``email-validator`` and return the normalized email."""
    try:
        result = validate_email(email, check_deliverability=check_deliverability)
    except EmailNotValidError as exc:
        # ``email-validator`` already produces a human-readable message
        # (e.g. "The domain name foo.invalid does not exist.").
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    return result.normalized


def validate_email_address(email: str, *, check_deliverability: bool = True) -> str:
    """
    Run all local checks and return the normalized email string.

    Raises ``HTTPException(422)`` if any layer rejects the address.
    """
    _check_hardcoded_blocklist(email)
    return _check_email_validator(email, check_deliverability=check_deliverability)
