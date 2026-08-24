# Wave 2 — Core Operational Progress

## Baseline

Wave 2 starts from merge commit `dc0f69b7c61dde18fa852d55ca781cf327157ad1`.

## Domain boundary — critical

The project has **two different payment domains** and they must not be conflated:

1. **SaaS Billing (owner/hotelier)**
   - `Subscription`
   - `/api/checkout/*`
   - Production gateways: Asaas + Mercado Pago
   - Mock is development/test only

2. **Guest Reservation Payments (hotel stay)**
   - `Reservation`
   - `Transaction`
   - Guest/room/check-in/check-out lifecycle
   - This domain currently does **not** use the SaaS `Subscription` checkout contract.
   - A dedicated booking-charge contract is required before implementation of reservation payment flows.

### Completed in this increment
- SaaS checkout creation now uses the unified payment gateway contract.
- Production gateway scope is Asaas + Mercado Pago; Mock is development/test only.
- Provider-specific Mercado Pago PIX code was removed from the SaaS checkout route.
- SaaS checkout persists provider payment ID and gateway metadata on `Subscription` / `PaymentTransaction`.
- Gateway result supports the common PIX/Boleto/checkout URL contract.
- Regression test added for the gateway abstraction.

## Gate status

- C2.0 SaaS Billing gateway wiring: **IMPLEMENTED**
- C2.1 Guest Booking Payment: **NOT STARTED — DOMAIN CONTRACT PENDING**
- Reservation lifecycle: **EXISTING / NEEDS PAYMENT INTEGRATION**
- Real sandbox validation: **PENDING**
- Post-payment notifications: **PENDING**
- Lock PIN activation after approved reservation/check-in: **PENDING**
- Full E2E reservation → payment → webhook → confirmation: **PENDING**

## Next sequence
1. Define `BookingCharge` / guest-payment canonical contract without reusing `Subscription` semantics.
2. Map `Reservation` + `Transaction` fields needed for gateway identity, idempotency and state transitions.
3. Implement Asaas + Mercado Pago booking-charge adapters.
4. Implement booking payment endpoint and provider webhook mapping to reservation/transaction state.
5. Wire notification dispatch after approved booking payment.
6. Wire lock PIN creation only after the approved reservation/check-in transition.
7. Add E2E contract for reservation → booking payment → webhook → confirmation → notification → PIN.
