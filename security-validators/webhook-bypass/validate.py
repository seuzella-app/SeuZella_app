#!/usr/bin/env python3
"""
Webhook Signature Bypass Validation
====================================
Testa que TODOS os webhooks do Seu Zélla rejeitam requests sem assinatura
HMAC válida. Valida fail-closed behavior em runtime.
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
    if body:
        req_headers["Content-Type"] = "application/json"
    conn.request(method, path, payload, req_headers)
    resp = conn.getresponse()
    resp_body = resp.read().decode("utf-8", errors="replace")
    result = {"status": resp.status, "body": resp_body[:1000]}
    conn.close()
    return result


def main():
    parser = argparse.ArgumentParser(description="Webhook signature bypass validation")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    base_url = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3000")

    evidence = {
        "test": "webhook-signature-bypass",
        "timestamp": str(__import__("datetime").datetime.now()),
        "results": [],
        "expected_status": 401,
        "passed": True,
        "failures": [],
    }

    test_payload = {
        "event": "PAYMENT_RECEIVED",
        "payment": {"id": "pay_test", "externalReference": "tenant_test", "value": 197},
    }

    webhooks = [
        {
            "name": "asaas_no_signature",
            "path": "/api/webhooks/asaas",
            "headers": {},
            "expected": 401,
        },
        {
            "name": "asaas_invalid_signature",
            "path": "/api/webhooks/asaas",
            "headers": {"asaas-signature": "sha256=invalid_hash"},
            "expected": 401,
        },
        {
            "name": "mercadopago_no_signature",
            "path": "/api/webhooks/mercadopago",
            "headers": {},
            "expected": 401,
        },
        {
            "name": "mercadopago_invalid_signature",
            "path": "/api/webhooks/mercadopago",
            "headers": {"x-signature": "invalid"},
            "expected": 401,
        },
        {
            "name": "stripe_no_signature",
            "path": "/api/webhooks/stripe",
            "headers": {},
            "expected": 401,
        },
        {
            "name": "stripe_invalid_signature",
            "path": "/api/webhooks/stripe",
            "headers": {"stripe-signature": "t=123,v1=invalid"},
            "expected": 401,
        },
        {
            "name": "stripe_replay_old_timestamp",
            "path": "/api/webhooks/stripe",
            "headers": {"stripe-signature": "t=1000000000,v1=old_hash"},
            "expected": 401,
        },
        {
            "name": "whatsapp_no_signature",
            "path": "/api/webhooks/whatsapp",
            "headers": {},
            "expected": 401,
        },
        {
            "name": "whatsapp_invalid_signature",
            "path": "/api/webhooks/whatsapp",
            "headers": {"x-hub-signature-256": "sha256=invalid"},
            "expected": 401,
        },
    ]

    for test in webhooks:
        result = http_request(base_url, "POST", test["path"], body=test_payload, headers=test["headers"])
        result["test_name"] = test["name"]
        result["expected"] = test["expected"]
        result["passed"] = result["status"] == test["expected"]
        if not result["passed"]:
            evidence["passed"] = False
            evidence["failures"].append(
                f"{test['name']}: got {result['status']} (expected {test['expected']})"
            )
        evidence["results"].append(result)

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
