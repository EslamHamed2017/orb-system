#!/usr/bin/env python3
"""Fail-closed validation for an owner-approved deployed UAT target."""

from __future__ import annotations

import ipaddress
import socket
import sys
from collections.abc import Callable, Sequence
from urllib.parse import urlparse

Resolver = Callable[..., Sequence[tuple]]


def validate_target(target: str, resolver: Resolver = socket.getaddrinfo) -> None:
    parsed = urlparse(target)
    if parsed.scheme != "https" or not parsed.netloc or not parsed.hostname:
        raise ValueError("owner UAT target must be an absolute HTTPS URL")
    if parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("owner UAT target must contain only a credential-free origin without a path, query, or fragment")

    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
        raise ValueError("owner UAT target must be an owner-approved deployed host")

    try:
        records = resolver(host, parsed.port or 443, type=socket.SOCK_STREAM)
    except (OSError, UnicodeError) as error:
        raise ValueError("owner UAT target did not resolve") from error
    addresses = {record[4][0] for record in records if len(record) > 4 and record[4]}
    if not addresses:
        raise ValueError("owner UAT target did not resolve to an address")
    for address in addresses:
        try:
            globally_routable = ipaddress.ip_address(address).is_global
        except ValueError as error:
            raise ValueError("owner UAT target resolved to an invalid address") from error
        if not globally_routable:
            raise ValueError("owner UAT target must resolve only to globally routable addresses")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate_owner_uat_target.py HTTPS_URL", file=sys.stderr)
        return 2
    try:
        validate_target(argv[1])
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
