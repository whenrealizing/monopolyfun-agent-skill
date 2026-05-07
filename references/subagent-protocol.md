# Subagent Protocol

This protocol is for constrained MonopolyFun subagents that receive a narrow file allowlist and must produce evidence before claiming success.

## Assignment Contract

The supervisor must provide:

- `assignmentId`: unique worker assignment id.
- `caseIds`: case ids under test or repair.
- `role`: `ordinary_agent`, `privileged_agent`, `case_runner`, `skill_repair_agent`, or `code_fix_agent`.
- `allowedFiles`: writable paths.
- `readOnlyFiles`: readable paths for evidence and orientation.
- `allowedCommands`: exact command families available to this worker.
- `evidenceDir`: run directory for JSON, screenshots, traces, and findings.
- `stopRules`: blockers that require a report.

## File Allowlist

Default skill-only allowlist:

```text
./**
```

Plan-prep allowlist:

```text
docs/agent-system-autonomous-test-final-plan.md
./**
```

Runtime test artifacts:

```text
docs/evidence/agent-system-autonomous/**
```

When a gap points to `apps/**`, `scripts/**`, migration files, or test files outside the assignment, record a finding with `recommendedOwner` and keep the local patch inside the allowlist.

## Allowed Runtime Operations

Every runtime operation starts from current account visibility:

```text
POST /api/v1/agent/turn
  -> read actions
  -> select action
  -> resolve apiOperation.operationId
  -> lookup one OpenAPI operation
  -> execute matching REST operation
  -> follow nextTurn
  -> verify receipt and projection
```

Allowed scenes:

- `home`
- `post`
- `identity`
- `workbench`
- `backoffice`

Allowed action execution rules:

- Execute only actions present in the current turn response for the current account.
- Use `projection.raw.items` to match target workbench items by `reason`, `orderNo`, `itemId`, or `subject.id`.
- Use `apiOperation.pathParams`, `apiOperation.queryParams`, `inputHints`, and one OpenAPI operation to build the REST request.
- Preserve CSRF and cookie ownership for the current account.
- For destructive actions, include a meaningful `reason` and save the before/after state.

## Evidence Expectations

Each phase saves:

```json
{
  "caseId": "offer-full-lifecycle",
  "phase": "seller_submit_proof",
  "agentId": "seller",
  "scene": "workbench",
  "turnRequestPath": "api/seller_submit_proof.turn.request.json",
  "turnResponsePath": "api/seller_submit_proof.turn.response.json",
  "operationId": "submitProof",
  "apiRequestPath": "api/seller_submit_proof.request.json",
  "apiResponsePath": "api/seller_submit_proof.response.json",
  "verificationPath": "api/seller_submit_proof.verify.json",
  "screenshotPath": "screenshots/seller_submit_proof.png",
  "tracePath": "traces/seller_submit_proof.zip",
  "status": "passed"
}
```

Minimum evidence:

- turn request and response for each view.
- selected action card and OpenAPI operation id.
- REST request and response for each write.
- before/after state for target order, post item, payment intent, proof asset, payroll run, share release, or risk account.
- screenshot and trace for browser-driven steps.
- blocked finding when evidence cannot be collected.

## Case Manifest Rules

Runner behavior comes from the manifest:

- `actors[]` maps accounts to roles and capabilities.
- `preconditions[]` creates or locates business objects.
- `phases[]` defines expected scene, action, operation, success state, and required evidence.
- `maliciousBoundaries[]` defines attacker account, attempted action, expected rejection, and risk area.
- `regressionCommands[]` binds the exact focused checks for a fix.

Agent behavior must use manifest phase ids in evidence paths and failure reports.

## Judge And Fix Loop

```text
run phase
  -> collect evidence
  -> judge lifecycle / permission / malicious / semantic / performance
  -> write finding
  -> patch assigned files
  -> rerun focused command
  -> update fix summary
```

Judge output must include:

- `findingId`
- `caseId`
- `phase`
- `severity`
- `type`
- `blockedReason`
- `evidencePath`
- `suspectedFiles`
- `recommendedOwner`
- `regressionCommands`

Skill-only repair handles `agent_semantic_gap` and `evidence_gap` in skill wording. Code, API, test, and script gaps become findings for the matching owner.

## Skill Repair Rules

- Keep global rules in `SKILL.md`.
- Keep ordinary market and workbench execution in `ordinary-agent.md`.
- Keep backoffice, risk, payroll, share release, and authority execution in `privileged-agent.md`.
- Keep multi-account relay and closure rules in `multi-agent-delivery-closure.md`.
- Keep destructive action requirements in `safety-rules.md`.
- Keep OpenAPI lookup behavior in `openapi-usage.md`.
- Keep turn request/response shape in `turn-protocol.md`.
- Add concrete evidence and failure reporting text when a semantic gap repeats.

## Failure Report

Return this JSON shape when blocked:

```json
{
  "assignmentId": "worker-c-skill-prep-001",
  "status": "blocked",
  "changedFiles": [],
  "evidencePaths": [],
  "verificationCommands": [],
  "failures": [
    {
      "caseId": "request-full-lifecycle",
      "phase": "worker_claim",
      "blockedReason": "expected action hidden from worker account",
      "evidencePath": "docs/evidence/agent-system-autonomous/runs/run-.../api/worker_claim.turn.response.json",
      "suspectedFiles": ["apps/api/src/main/java/com/monopolyfun/..."],
      "recommendedOwner": "backend_state_machine"
    }
  ]
}
```

The final report must list changed files, evidence paths, commands, and remaining blockers.
