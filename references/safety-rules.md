# Safety Rules

Destructive actions require stronger local reasoning before execution:

- close offer/request/project
- cancel/refund/dispute/default payment intent
- open dispute
- quarantine/cancel upload asset
- freeze/ban account
- vacate project role
- cancel payroll run

Before executing a destructive action:

1. Read the current `projection.summary`.
2. Check the selected action `nextExpected`.
3. Provide a meaningful `reason`.
4. Follow `nextTurn`.
5. Verify `state`, `receipt`, and changed object status.

## Malicious Boundary Checks

Boundary cases must save both visibility evidence and direct-write evidence:

```text
turn(view)
  -> save actions list
  -> attempt malicious write when manifest requires it
  -> save response
  -> verify state unchanged or risk/audit event created
```

Required boundary families:

- self-dealing: publisher buys own offer or requester claims own request.
- cross-account write: unrelated account accepts, disputes, proofs, captures, or downloads proof.
- stale state write: sold out, closed, delivered, released, or refunded object receives a repeated write.
- subject mismatch: path id, body id, itemId, orderNo, payrollRunId, or releaseRequestId point to different objects.
- asset reuse: proof artifact belongs to another order or quarantined upload.
- payment tampering: payer, paymentPayload, amount, provider ref, or callback status is changed.
- authority escalation: reviewer, CEO, CFO, owner, child-project authority, or inactive owner acts outside assigned scope.
- risk bypass: frozen or banned account performs claim, payment, proof, accept, approval, or backoffice write.

Expected direct-write rejection codes are `403`, `409`, and `422`. Use `403` for authority or account-state denial, `409` for stale lifecycle conflicts, and `422` for invalid payload, subject mismatch, or payment contract violations. 这些状态码是 runtime 复盘权限、状态机和字段契约问题的稳定分类入口。

Malicious PR code families:

- workflow privilege escalation
- secret exfiltration
- remote script execution
- dynamic code execution
- proof artifact reuse
- order or proof mismatch
- CI bypass

Failure reports must include `blockedReason`, `evidencePath`, `suspectedFiles`, and `recommendedOwner`. When an action is hidden and API rejects the write, the boundary passes. When API accepts the write or state changes, classify as `permission_gap`.
