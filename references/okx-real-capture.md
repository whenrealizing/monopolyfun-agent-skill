# OKX Real Capture

Use this before marking any OKX money settlement complete.

## Scope

This runbook is for real OKX payment evidence:

- verify
- settle
- settle/status
- chain reconciliation
- A2A payment link / callback gap tracking

## Command

```bash
pnpm okx:real-capture -- --amount-minor 1 --run-id <run-id>
```

## Required Evidence

The run must produce:

```text
docs/evidence/okx-real-payment/<run-id>/reconciliation.json
```

Record these fields:

- `verify.isValid`
- `settle.success`
- `settleStatus.status`
- `chain.receiptStatus`
- `chain.transferLogCount`
- `payerBefore`
- `payerAfter`
- `recipientBefore`
- `recipientAfter`
- `txHash`

## Pass Rules

All of these must be true:

```text
verify.isValid = true
settle.success = true
settleStatus.status = success
chain.receiptStatus = success
chain.transferLogCount >= 1
payerAfter lower than payerBefore by the expected USDC amount
recipientAfter higher than recipientBefore by the expected USDC amount
reconciliation.json exists
```

## Transaction Field Compatibility

OKX settle/status may return the chain reference as any of:

- `transaction`
- `txHash`
- `transactionHash`

Treat them as the same chain transaction reference and normalize them into one evidence field.

## Failure Rules

If any pass rule is missing:

```text
record blockedReason
record upstream verify / settle / settleStatus payload
record reconciliation path
stop the payment branch as blocked
```

Do not mark money settlement complete from `authorized` or partial provider evidence.

## A2A Payment Link / Callback Closure

A2A payment link and app callback evidence is a separate closure path from x402 capture. Use it when the business flow explicitly requires:

```text
create payment link -> buyer pay -> provider status -> app callback -> app captured state -> chain reconciliation
```

Required implementation before marking A2A callback complete:

- `onchainos payment a2a-pay create` creates a paymentId for the seller.
- `onchainos payment a2a-pay pay --payment-id <id>` completes the buyer payment.
- `onchainos payment a2a-pay status --payment-id <id>` reaches a terminal success status.
- The app has a real provider callback endpoint with signature, timestamp, paymentId, amount, currency, recipient, orderNo, and txHash validation.
- Callback handling is idempotent and records duplicate callback, bad signature, stale timestamp, amount mismatch, recipient mismatch, and order mismatch as risk evidence.
- Chain receipt/log/balance evidence is written beside the callback result.

Repository command:

```bash
pnpm okx:a2a-real-callback -- --amount-minor 1 --intent-id <payment-intent-id> --order-no <order-no>
```

App callback endpoint:

```text
POST /api/v1/payments/callback/okx/a2a
```

Suggested evidence path:

```text
docs/evidence/okx-a2a-real-payment/<run-id>/reconciliation.json
```

Minimum evidence fields:

- `paymentId`
- `paymentUrl`
- `payer`
- `recipient`
- `amount`
- `status.status`
- `status.txHash`
- `callback.intentId`
- `callback.applied`
- `callback.idempotent`
- `chain.receiptStatus`
- `chain.transferLogCount`
- `payerBefore`
- `payerAfter`
- `recipientBefore`
- `recipientAfter`

Current repository boundary:

```text
The fake app callback endpoint is /api/v1/payments/callback/fake.
The OKX A2A callback endpoint is /api/v1/payments/callback/okx/a2a.
PaymentService.handleOkxA2aCallback validates timestamp, HMAC signature, paymentId, orderNo, amount, currency, recipient, txHash, idempotency, and chain evidence.
```
