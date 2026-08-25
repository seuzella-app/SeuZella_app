#!/usr/bin/env python3
"""
Run all security validators sequentially.
Used by: npm run security:validators
"""

import subprocess
import sys
import os
from pathlib import Path

VALIDATORS = [
    ("cross-tenant-access", "Cross-Tenant Access"),
    ("webhook-bypass", "Webhook Signature Bypass"),
    ("alexa-jwt-bypass", "Alexa JWT Bypass"),
    ("payment-idempotency", "Payment Idempotency"),
]

def main():
    base_dir = Path(__file__).parent
    output_dir = Path(os.environ.get("SECURITY_REPORT_DIR", "../security-reports/validators"))
    output_dir.mkdir(parents=True, exist_ok=True)

    all_passed = True
    results = []

    for dirname, name in VALIDATORS:
        script = base_dir / dirname / "validate.py"
        if not script.exists():
            print(f"SKIP: {name} (script not found)")
            continue

        output_file = output_dir / f"{dirname}.json"
        print(f"\n{'='*60}")
        print(f"Running: {name}")
        print(f"{'='*60}")

        result = subprocess.run(
            [sys.executable, str(script), "--output", str(output_file)],
            capture_output=True, text=True, timeout=60,
        )

        passed = result.returncode == 0
        results.append({"validator": name, "passed": passed, "output_file": str(output_file)})
        if not passed:
            all_passed = False

        print(result.stdout)
        if result.stderr:
            print(f"STDERR: {result.stderr}")

    print(f"\n{'='*60}")
    print(f"SUMMARY: {'ALL PASSED' if all_passed else 'FAILURES DETECTED'}")
    print(f"{'='*60}")
    for r in results:
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"  {status} {r['validator']}")

    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
