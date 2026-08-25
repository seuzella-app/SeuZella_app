#!/usr/bin/env python3
"""
Alexa JWT Bypass Validation
===========================
Testa que o endpoint /api/alexa/smart-home rejeita todos os tipos de
token JWT inválidos. Valida o hardening implementado em Onda 5C.
"""

import argparse
import json
import os
import sys
import time
import http.client
import base64
import hmac
import hashlib
from pathlib import Path
from urllib.parse import urlparse


def make_jwt(payload, secret=None, alg="HS256"):
    """Create a JWT token for testing. If secret is None and alg='none', creates unsigned."""
    header = {"alg": alg, "typ": "JWT"}

    def b64encode_json(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    header_b64 = b64encode_json(header)
    payload_b64 = b64encode_json(payload)

    if alg == "none":
        token = f"{header_b64}.{payload_b64}."
    else:
        signing_input = f"{header_b64}.{payload_b64}".encode()
        signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
        token = f"{header_b64}.{payload_b64}.{sig_b64}"

    return token


def http_request(base_url, method, path, headers=None):
    parsed = urlparse(base_url)
    conn = http.client.HTTPConnection(parsed.hostname, parsed.port or 80, timeout=10)
    conn.request(method, path, headers=headers or {})
    resp = conn.getresponse()
    resp_body = resp.read().decode("utf-8", errors="replace")
    result = {"status": resp.status, "body": resp_body[:500]}
    conn.close()
    return result


def main():
    parser = argparse.ArgumentParser(description="Alexa JWT bypass validation")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    base_url = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3000")
    jwt_secret = os.environ.get("ALEXA_JWT_SECRET", "test-secret-32-chars-minimum-length-xyz")

    evidence = {
        "test": "alexa-jwt-bypass",
        "timestamp": str(__import__("datetime").datetime.now()),
        "results": [],
        "expected_status": 401,
        "passed": True,
        "failures": [],
    }

    now = int(time.time())
    discovery_payload = {
        "directive": {
            "header": {"namespace": "Alexa.Discovery", "name": "Discover", "payloadVersion": "3", "messageId": "test-001"},
            "payload": {"scope": {"type": "BearerToken", "token": "placeholder"}},
        }
    }

    def send_with_token(token, test_name, expected=401):
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        result = http_request(base_url, "POST", "/api/alexa/smart-home", headers=headers)
        result["test_name"] = test_name
        result["expected"] = expected
        result["passed"] = result["status"] == expected
        if not result["passed"]:
            evidence["passed"] = False
            evidence["failures"].append(f"{test_name}: got {result['status']} (expected {expected})")
        evidence["results"].append(result)

    # 1. No Bearer token
    result = http_request(base_url, "POST", "/api/alexa/smart-home",
                          headers={"Content-Type": "application/json"})
    result["test_name"] = "no_token"
    result["expected"] = 401
    result["passed"] = result["status"] == 401
    if not result["passed"]:
        evidence["passed"] = False
        evidence["failures"].append(f"no_token: got {result['status']} (expected 401)")
    evidence["results"].append(result)

    # 2. Token with alg=none
    token_none = make_jwt({"sub": "user_1", "tenantId": "tenant_1", "scope": "smart_home:locks"}, alg="none")
    send_with_token(token_none, "alg_none")

    # 3. Token without jti
    token_no_jti = make_jwt({"sub": "user_1", "tenantId": "tenant_1", "scope": "smart_home:locks", "iat": now}, jwt_secret)
    send_with_token(token_no_jti, "missing_jti")

    # 4. Token without iat
    token_no_iat = make_jwt({"sub": "user_1", "tenantId": "tenant_1", "scope": "smart_home:locks", "jti": "jti_001"}, jwt_secret)
    send_with_token(token_no_iat, "missing_iat")

    # 5. Token with old iat (>5 min)
    token_old = make_jwt({"sub": "user_1", "tenantId": "tenant_1", "scope": "smart_home:locks", "jti": "jti_002", "iat": now - 600}, jwt_secret)
    send_with_token(token_old, "expired_token")

    # 6. Token without tenantId
    token_no_tenant = make_jwt({"sub": "user_1", "scope": "smart_home:locks", "jti": "jti_003", "iat": now}, jwt_secret)
    send_with_token(token_no_tenant, "missing_tenantId")

    # 7. Token without scope
    token_no_scope = make_jwt({"sub": "user_1", "tenantId": "tenant_1", "jti": "jti_004", "iat": now}, jwt_secret)
    send_with_token(token_no_scope, "missing_scope")

    # 8. Token from future (iat in the future)
    token_future = make_jwt({"sub": "user_1", "tenantId": "tenant_1", "scope": "smart_home:locks", "jti": "jti_005", "iat": now + 120}, jwt_secret)
    send_with_token(token_future, "future_token")

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
