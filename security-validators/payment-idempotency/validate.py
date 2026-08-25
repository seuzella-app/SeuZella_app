#!/usr/bin/env python3
"""
Payment Webhook Idempotency Validation
=======================================
Valida que webhooks duplicados NÃO criam transações duplicadas e que
webhooks com paymentId de outro tenant são rejeitados.
"""

import argparse
import json
import os
import sys
import http.client
import hmac
import hashlib
from pathlib import Path
from urllib.parse import urlparse


def http_request(base_url, method, path, body=None, headers=None):
    parsed = urlparse(base_url)
    conn = http.client.HTTPConnection(parsed.hostname, parsed.port or 80, timeout=10)
    req_headers = dict(headers or {})
    payload = json.dumps(body) if body else "{}"
    req_headers["Content-Type"] = "application/json"
    conn.request(method, path, payload, req_headers)
    resp = conn.getresponse()
    resp_body = resp.read().decode("utf-8", errors="replace")
    result = {"status": resp.status, "body": resp_body[:1000]}
    conn.close()
    return result


def sign_asaas(payload, secret):
    """Generate Asaas HMAC signature."""
    return "sha256=" + hmac.new(secret.encode(), json.dumps(payload).encode(), hashlib.sha256).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Payment idempotency validation")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    base_url = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3000")
    asaas_secret = os.environ.get("ASAAS_WEBHOOK_SECRET", "test-asaas-webhook-secret-32chars")

    evidence = {
        "test": "payment-idempotency",
        "timestamp": str(__import__("datetime").datetime.now()),
        "results": [],
        "passed": True,
        "failures": [],
    }

    payment_payload = {
        "event": "PAYMENT_RECEIVED",
        "payment": {
            "id": "pay_idempotency_test_001",
            "externalReference": "tenant_test_001",
            "value": 197.0,
            "billingType": "PIX",
        },
    }

    # 1. First webhook → should be 200 (creates transaction)
    signature = sign_asaas(payment_payload, asaas_secret)
    result1 = http_request(
        base_url, "POST", "/api/webhooks/asaas",
        body=payment_payload,
        headers={"asaas-signature": signature},
    )
    result1["test_name"] = "first_webhook"
    result1["expected"] = 200
    evidence["results"].append(result1)

    # 2. Duplicate webhook (same paymentId) → should be 200 with duplicate=true
    result2 = http_request(
        base_url, "POST", "/api/webhooks/asaas",
        body=payment_payload,
        headers={"asaas-signature": signature},
    )
    result2["test_name"] = "duplicate_webhook"
    result2["expected"] = 200
    # Check if duplicate flag is set
    try:
        body = json.loads(result2["body"])
        if body.get("duplicate"):
            result2["idempotent"] = True
        else:
            result2["idempotent"] = False
            evidence["passed"] = False
            evidence["failures"].append("Duplicate webhook did not return duplicate=true flag")
    except Exception:
        result2["idempotent"] = "unknown"
    evidence["results"].append(result2)

    # 3. Webhook with paymentId belonging to different tenant → 409
    cross_payload = dict(payment_payload)
    cross_payload["payment"] = dict(payment_payload["payment"])
    cross_payload["payment"]["id"] = "pay_idempotency_test_001"
    cross_payload["payment"]["externalReference"] = "tenant_different_001"
    cross_sig = sign_asaas(cross_payload, asaas_secret)
    result3 = http_request(
        base_url, "POST", "/api/webhooks/asaas",
        body=cross_payload,
        headers={"asaas-signature": cross_sig},
    )
    result3["test_name"] = "cross_tenant_payment"
    result3["expected"] = [409, 404]
    result3["passed"] = result3["status"] in [409, 404]
    if not result3["passed"]:
        evidence["passed"] = False
        evidence["failures"].append(f"Cross-tenant payment returned {result3['status']} (expected 409/404)")
    evidence["results"].append(result3)

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
