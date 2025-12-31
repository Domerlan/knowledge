from __future__ import annotations

from urllib.parse import urlparse

import bleach

from app.core.config import settings

ALLOWED_TAGS = [
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "iframe",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "ul",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "iframe": [
        "src",
        "width",
        "height",
        "frameborder",
        "allow",
        "allowfullscreen",
        "title",
        "loading",
        "referrerpolicy",
    ],
    "img": ["src", "alt", "title", "width", "height"],
}

ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def _allowed_iframe_hosts() -> set[str]:
    return {
        host.strip().lower() for host in settings.iframe_allowed_hosts.split(",") if host.strip()
    }


def _is_allowed_iframe_src(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except ValueError:
        return False

    if parsed.scheme != "https":
        return False

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False

    for allowed in _allowed_iframe_hosts():
        if hostname == allowed or hostname.endswith(f".{allowed}"):
            return True
    return False


def _attribute_filter(tag: str, name: str, value: str) -> str | None:
    allowed = ALLOWED_ATTRIBUTES.get(tag)
    if not allowed or name not in allowed:
        return None

    if tag == "iframe" and name == "src":
        return value if _is_allowed_iframe_src(value) else None

    return value


def sanitize_html(content: str) -> str:
    return bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=_attribute_filter,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
