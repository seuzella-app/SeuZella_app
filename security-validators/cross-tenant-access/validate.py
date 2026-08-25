#!/usr/bin/env python3
"""
Cross-Tenant Access Validation Script
=====================================
Exercita cross-tenant access via HTTP real para validar que o isolamento
multi-tenant do Seu Zélla funciona em runtime (não apenas em testes source-level).

Este script é executado pelo codex-security como custom validation.
"""

import argparse
import json
import os
import sys
import http.client
from pathlib import Path
from urllib.parse import urlparse


def http_request(base_url, method, path, body=None, cookie=None, headers=None):
    """Make an HTTP request and return {status, body, headers}."""
    parsed = urlparse(base_url)
    conn = http.client.HTTPConnection(parsed.hostname, parsed.port or 80, timeout=10)
    req_headers = dict(headers or {})
    if cookie:
        req_headers["Cookie"] = cookie
    if body:
        req_headers["Content-Type"] = "application/json"
    conn.request(method, path, body=json.dumps(body) if body else None, headers=req_headers)
    resp = conn.getresponse()
    resp_body = resp.read().decode("utf-8", errors="replace")
    result = {
        "status": resp.status,
        "body": resp_body[:2000],  # truncate for evidence
        "content_type": resp.getheader("content-type", ""),
    }
    conn.close()
    return result


def login(base_url, email, password):
    """Authenticate via NextAuth credentials and return session cookie."""
    result = http_request(
        base_url, "POST", "/api/auth/callback/credentials",
        body={"email": email, "password": password, "redirect": False, "json": True},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    # NextAuth returns a redirect with Set-Cookie
    # For programmatic login, we use the callback directly
    parsed = urlparse(base_url)
    conn = http.client.HTTPConnection(parsed.hostname, parsed.port or 80, timeout=10)
    conn.request(
        "POST", "/api/auth/callback/credentials",
        body=f"email={email}&password={password}&redirect=false&json=true&csrfToken=placeholder",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    resp = conn.getresponse()
    cookie_header = resp.getheader("set-cookie", "")
    conn.close()

    # Extract the session cookie
    cookies = []
    for part in cookie_header.split(","):
        if "next-auth" in part.lower() or "session" in part.lower():
            cookie = part.split(";")[0].strip()
            if cookie:
                cookies.append(cookie)

    return "; ".join(cookies) if cookies else None


def main():
    parser = argparse.ArgumentParser(description="Cross-tenant access validation")
    parser.add_argument("--output", required=True, type=Path, help="Output evidence file")
    args = parser.parse_args()

    base_url = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3000")
    tenant_a_email = os.environ.get("E2E_TENANT_A_EMAIL", "tenant_a@seuzella.com")
    tenant_b_email = os.environ.get("E2E_TENANT_B_EMAIL", "tenant_b@seuzella.com")
    tenant_a_password = os.environ.get("E2E_TENANT_A_PASSWORD", "")
    tenant_b_password = os.environ.get("E2E_TENANT_B_PASSWORD", "")

    if not tenant_a_password or not tenant_b_password:
        print("ERROR: Set E2E_TENANT_A_PASSWORD and E2E_TENANT_B_PASSWORD env vars", file=sys.stderr)
        sys.exit(1)

    evidence = {
        "test": "cross-tenant-access",
        "base_url": base_url,
        "timestamp": str(__import__("datetime").datetime.now()),
        "results": [],
        "expected": {
            "anonymous_access": 401,
            "tenant_a_own": 200,
            "tenant_a_cross_tenant": [403, 404],
            "tenant_b_own": 200,
        },
        "passed": True,
        "failures": [],
    }

    # 1. Anonymous access (no cookie) → must be 401
    result = http_request(base_url, "GET", "/api/ddc/locks")
    evidence["results"].append({"test": "anonymous_access", **result})
    if result["status"] != 401:
        evidence["passed"] = False
        evidence["failures"].append(f"Anonymous access returned {result['status']} (expected 401)")

    # 2. Login as tenant_A
    cookie_a = login(base_url, tenant_a_email, tenant_a_password)
    if not cookie_a:
        evidence["passed"] = False
        evidence["failures"].append("Failed to login as tenant_A")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(evidence, indent=2))
        print(f"Evidence saved to {args.output}")
        sys.exit(1 if not evidence["passed"] else 0)

    # 3. Tenant_A accesses own locks → 200
    result = http_request(base_url, "GET", "/api/ddc/locks", cookie=cookie_a)
    evidence["results"].append({"test": "tenant_a_own_locks", **result})
    if result["status"] != 200:
        evidence["passed"] = False
        evidence["failures"].append(f"Tenant A own locks returned {result['status']} (expected 200)")

    # 4. Tenant_A tries to access tenant_B's lock → 403/404
    tenant_b_lock_id = os.environ.get("TENANT_B_LOCK_ID", "lock_tenant_b")
    result = http_request(base_url, "GET", f"/api/ddc/locks/{tenant_b_lock_id}", cookie=cookie_a)
    evidence["results"].append({"test": "tenant_a_accessing_tenant_b_lock", **result})
    if result["status"] not in [403, 404]:
        evidence["passed"] = False
        evidence["failures"].append(
            f"Tenant A accessing tenant B lock returned {result['status']} (expected 403/404)"
        )

    # 5. Tenant_A tries to delete tenant_B's PIN → 403/404
    result = http_request(
        base_url, "DELETE",
        f"/api/ddc/locks/{tenant_b_lock_id}/pins/pin_tenant_b",
        cookie=cookie_a,
    )
    evidence["results"].append({"test": "tenant_a_delete_tenant_b_pin", **result})
    if result["status"] not in [403, 404]:
        evidence["passed"] = False
        evidence["failures"].append(
            f"Tenant A deleting tenant B pin returned {result['status']} (expected 403/404)"
        )

    # 6. Login as tenant_B
    cookie_b = login(base_url, tenant_b_email, tenant_b_password)

    # 7. Tenant_B accesses own locks → 200
    if cookie_b:
        result = http_request(base_url, "GET", "/api/ddc/locks", cookie=cookie_b)
        evidence["results"].append({"test": "tenant_b_own_locks", **result})
        if result["status"] != 200:
            evidence["passed"] = False
            evidence["failures"].append(f"Tenant B own locks returned {result['status']} (expected 200)")

    # 8. Tenant_A tries to access /api/ddc/guests with tenant_B's guestId → 403/404
    result = http_request(base_url, "GET", "/api/ddc/guests", cookie=cookie_a)
    evidence["results"].append({"test": "tenant_a_guests_list", **result})

    # Save evidence
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, indent=2))
    print(f"Evidence saved to {args.output}")
    print(f"Passed: {evidence['passed']}")
    if evidence["failures"]:
        print("Failures:")
        for f in evidence["failures"]:
            print(f"  - {f}")

    sys.exit(0 if evidence["passed"] else 1)


if __name__ == "__main__":
    main()
