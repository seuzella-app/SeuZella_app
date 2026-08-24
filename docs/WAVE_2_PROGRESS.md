# Wave 2 — Core Operational Progress

## Current scope

Wave 2 starts from merge commit `dc0f69b7c61dde18fa852d55ca781cf327157ad1`.

### Completed in this increment
- Checkout creation now uses the unified payment gateway contract.
- Production gateway scope is Asaas + Mercado Pago; Mock is test/development only.
- Provider-specific Mercado Pago PIX code was removed from the checkout route.
- Checkout now persists the provider payment identifier and gateway on the subscription/transaction.
- Gateway result supports PIX/Boleto/checkout URL through the common `CreatePaymentResult` contract.
- Regression test added for the gateway contract.

## Gate status

- C2.1 Booking/Checkout: **IN PROGRESS**
- Payment gateway wiring: **IMPLEMENTED**
- Real sandbox validation: **PENDING**
- Reservation lifecycle E2E: **PENDING**
- Notification + lock activation: **PENDING**

## Next sequence
1. Validate checkout build/tests.
2. Complete reservation-to-payment state transition.
3. Wire notification dispatch after approved payment.
4. Wire lock PIN creation only after the approved reservation/check-in transition.
5. Add E2E contract for reservation → payment → webhook → confirmation.
