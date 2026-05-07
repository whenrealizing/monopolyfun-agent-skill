# Business Flows

```text
Public discovery
view home
  -> view post
  -> view post/{offer|request|project}

Worker delivery
view workbench
  -> selectedItem.reason=submit_worker_proof
  -> action submit_proof
  -> OpenAPI submitProof
  -> follow nextTurn
  -> verify state delivered

Lead acceptance
view workbench
  -> selectedItem.reason=lead_accept_or_dispute
  -> action accept_order or open_dispute
  -> OpenAPI acceptOrder or openDispute
  -> follow nextTurn
  -> verify accepted or disputed

Payment
view post/order
  -> action complete_money_payment
  -> OpenAPI createIntent
  -> follow nextTurn
  -> verify payment intent state

Backoffice upload review
view backoffice/upload_case
  -> action verify_upload_asset or quarantine_upload_asset
  -> OpenAPI verify or quarantine
  -> follow nextTurn
  -> verify proofAsset status

Share release approval
view workbench
  -> selectedItem.reason=share_release_approval
  -> action approve_share_release
  -> OpenAPI approveShareReleaseRequest
  -> follow nextTurn
  -> verify shareReleaseRequest status

Project payroll approval
view workbench
  -> selectedItem.reason=project_payroll_approval
  -> action approve_project_payroll_run
  -> OpenAPI approveRun
  -> follow nextTurn
  -> verify projectPayrollRun status

Dispute review claim
view workbench
  -> selectedItem.reason=review_disputed_order
  -> action claim_review_work
  -> OpenAPI claimReviewTask
  -> follow nextTurn
  -> verify receipt status

Risk account handling
view backoffice/risk_case
  -> action freeze_account, unfreeze_account, ban_account, or watch_account
  -> OpenAPI freezeRiskAccount, unfreezeRiskAccount, banRiskAccount, or watchRiskAccount
  -> follow nextTurn
  -> verify riskAccount status
```
