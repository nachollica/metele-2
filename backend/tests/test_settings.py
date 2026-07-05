"""
Environment-validator tests.

The ``Settings._enforce_environment_invariants`` model validator must
refuse to construct a ``Settings`` instance whose values would be unsafe
for the configured ``environment``. Failing here is what stops a misdeploy
from booting silently, so the rules below are load-bearing — keep them in
sync with the validator if you tweak them.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.settings import Settings


# Common helper: pass the minimum set of valid prod settings, then let each
# test mutate one knob to break it.
def _valid_prod_kwargs(**overrides) -> dict:
    base = {
        "environment": "production",
        "frontend_origin": "https://flowfic.app",
        "database_url": "postgresql+psycopg://u:p@db:5432/flowfic",
        "auth0_domain": "tenant.us.auth0.com",
        "auth0_audience": "https://api.flowfic.example",
        "dev_user_enabled": False,
        "dev_user_token": "rotated-prod-secret",
        "email_validation_check_deliverability": True,
    }
    base.update(overrides)
    return base


# ---- Production guardrails ------------------------------------------------


def test_production_requires_auth0_domain() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_valid_prod_kwargs(auth0_domain=""))
    assert "AUTH0_DOMAIN" in str(exc.value)


def test_production_requires_auth0_audience() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_valid_prod_kwargs(auth0_audience=""))
    assert "AUTH0_AUDIENCE" in str(exc.value)


def test_production_refuses_dev_user_enabled() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_valid_prod_kwargs(dev_user_enabled=True))
    assert "DEV_USER_ENABLED" in str(exc.value)


def test_production_refuses_localhost_frontend_origin() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_valid_prod_kwargs(frontend_origin="http://localhost:3000"))
    assert "FRONTEND_ORIGIN" in str(exc.value)


def test_production_refuses_sqlite_database() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_valid_prod_kwargs(database_url="sqlite:///./prod.db"))
    assert "DATABASE_URL" in str(exc.value)


def test_production_requires_deliverability_check() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_valid_prod_kwargs(email_validation_check_deliverability=False))
    assert "EMAIL_VALIDATION_CHECK_DELIVERABILITY" in str(exc.value)


def test_production_reports_all_problems_in_one_error() -> None:
    """
    Failure messages must enumerate every violation so an operator can
    fix them in one pass rather than discovering them one ``re-deploy`` at
    a time.
    """
    with pytest.raises(ValidationError) as exc:
        Settings(
            environment="production",
            auth0_domain="",
            auth0_audience="",
            dev_user_enabled=True,
            dev_user_token="some-token",
            frontend_origin="http://localhost:3000",
            database_url="sqlite:///./flowfic.db",
            email_validation_check_deliverability=False,
        )
    message = str(exc.value)
    for needle in (
        "AUTH0_DOMAIN",
        "AUTH0_AUDIENCE",
        "DEV_USER_ENABLED",
        "FRONTEND_ORIGIN",
        "DATABASE_URL",
        "EMAIL_VALIDATION_CHECK_DELIVERABILITY",
    ):
        assert needle in message, f"expected {needle!r} in {message!r}"


def test_production_accepts_a_fully_configured_settings() -> None:
    s = Settings(**_valid_prod_kwargs())
    assert s.is_production is True
    assert s.auth0_jwks_url.endswith("/.well-known/jwks.json")


# ---- Mandatory fields -----------------------------------------------------


def test_missing_mandatory_field_refuses_to_construct(monkeypatch) -> None:
    """
    A field with no default must come from the environment — drop one and
    construction fails rather than silently assuming a value.
    """
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    with pytest.raises(ValidationError) as exc:
        Settings(  # type: ignore[call-arg]
            environment="local",
            database_url="sqlite://",
            auth0_domain="",
            auth0_audience="",
        )
    assert "frontend_origin" in str(exc.value).lower()


# ---- Local / development relaxations --------------------------------------


def test_local_allows_missing_auth0_credentials() -> None:
    # Mandatory values come from the environment (pytest-env); Auth0 may be
    # empty outside production, which is how the dev backdoor works locally.
    s = Settings(environment="local", auth0_domain="", auth0_audience="")  # type: ignore[call-arg]
    assert s.auth0_domain == ""
    assert s.auth0_audience == ""
    assert s.is_production is False


def test_dev_user_backdoor_defaults_to_off(monkeypatch) -> None:
    monkeypatch.delenv("DEV_USER_ENABLED", raising=False)
    s = Settings(  # type: ignore[call-arg]
        environment="local",
        auth0_domain="",
        auth0_audience="",
    )
    assert s.dev_user_enabled is False


def test_development_allows_localhost_frontend() -> None:
    Settings(  # type: ignore[call-arg]
        environment="development",
        frontend_origin="http://localhost:3000",
        auth0_domain="",
        auth0_audience="",
    )


def test_dev_user_token_must_be_non_empty_when_backdoor_is_enabled() -> None:
    """
    Even in local/dev mode, an empty ``DEV_USER_TOKEN`` collapses the
    prefix check to trivially-empty — refuse to start.
    """
    with pytest.raises(ValidationError):
        Settings(  # type: ignore[call-arg]
            environment="local",
            auth0_domain="",
            auth0_audience="",
            dev_user_enabled=True,
            dev_user_token="",
        )


def test_dev_user_token_may_be_empty_when_backdoor_is_disabled() -> None:
    Settings(  # type: ignore[call-arg]
        environment="local",
        auth0_domain="",
        auth0_audience="",
        dev_user_enabled=False,
        dev_user_token="",
    )
