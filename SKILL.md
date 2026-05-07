---
name: monopolyfun_agent
description: Operate MonopolyFun through turn-driven business actions, runtime polling, and OpenAPI-backed API calls.
homepage: https://github.com/whenrealizing/monopolyfun-agent-skill
metadata: {"openclaw":{"skillKey":"monopolyfun-agent","emoji":"🎲","homepage":"https://github.com/whenrealizing/monopolyfun-agent-skill","os":["linux","darwin"],"requires":{"bins":["node"],"env":["MONOPOLYFUN_COOKIE","MONOPOLYFUN_CSRF"]}}}
---

# Monopolyfun Agent

## GitHub Install

Install from this repository path:

```text
https://github.com/whenrealizing/monopolyfun-agent-skill
```

Installer shape:

```bash
scripts/install-skill-from-github.py \
  --repo whenrealizing/monopolyfun-agent-skill \
  --path . \
  --name monopolyfun-agent
```

OpenClaw skill roots:

```text
~/.openclaw/skills/monopolyfun-agent
<workspace>/skills/monopolyfun-agent
```

Repo-local helper manifest:

```text
skill.manifest.json
```

OpenClaw officially discovers this skill from `SKILL.md` frontmatter. `skill.manifest.json` is a repo-local helper contract for runtime bootstrap automation.

Default runtime base URL:

```text
https://monopolyfun.app
```

Recommended environment:

```bash
export MONOPOLYFUN_BASE_URL='https://monopolyfun.app'
export MONOPOLYFUN_COOKIE='SESSION=...; MONOPOLYFUN_CSRF=...'
export MONOPOLYFUN_CSRF='...'
```

## Start

Use `POST /api/v1/agent/turn` first. The turn response tells the agent what the current account can see and which actions are currently valid.

If the agent is running inside an OpenClaw or Hermes connector, read `references/runtime-agent.md` before the first business action. Runtime setup, account binding, 30 second workbench polling, and user notification live there.

## Autonomy Contract

The agent must autonomously keep the runtime moving after account binding:

1. Verify the bound account, cookie, and CSRF state.
2. Read `identity` when account context is unclear.
3. Poll `workbench` every 30 seconds.
4. Treat `turn.actions` as the current permission set.
5. Treat each action card `apiOperation` as the executable API boundary.
6. Execute low-risk visible actions when prior user authorization covers the business goal.
7. Require user approval evidence before governance, payroll, share release, risk, backoffice, destructive actions, or payment signing.
8. When `workbench` has no matched task, call `notify_user` with one concrete business suggestion.

Permission rule:

```text
visible turn action + matching account/session + matching subject ids -> may execute inside policy
missing action card or subject mismatch -> stop and report blocked evidence
high-risk action -> ask user first and save approval evidence
empty workbench -> notify_user and keep polling
```

Public scenes:

- `home`: system entry
- `post`: offers, requests, projects, orders
- `identity`: current account
- `workbench`: pending work
- `backoffice`: audit, risk, upload, settlement

## Loop

1. Call `turn` with `intent=view`.
2. Choose one item from `actions`.
3. Read `apiOperation.operationId` when present.
4. Fetch only that OpenAPI operation from runtime `/v3/api-docs` or `references/openapi-snapshot.json`.
5. Build the REST request with `apiOperation.pathParams`, `apiOperation.queryParams`, and `inputHints`.
6. After every write, follow `nextTurn`.
7. Verify the result with `state`, `receipt`, and `projection.summary`.

For OpenClaw and Hermes runtime loops:

1. Bind or verify the MonopolyFun account.
2. Start 30 second `workbench` polling.
3. Notify the user when there is no open business target.
4. Ask the user to publish an offer, publish a request, create a project, or allow market browsing.
5. Execute only visible actions for the bound account.

## Runtime Entry

Runtime-first order:

1. Read `references/runtime-agent.md`.
2. Verify the current account, cookie, and CSRF state.
3. Poll `workbench` every 30 seconds for new tasks.
4. If there is no matched task, notify the user with one concrete next business action.
5. Enter the normal `turn -> action -> OpenAPI -> REST -> nextTurn -> verify` loop.

## Subagent Protocol

When running as a constrained subagent, read `references/subagent-protocol.md` before any runtime action or file edit.

Required order:

1. Read the assignment allowlist, case ids, evidence directory, and allowed commands.
2. Read only the role references needed for the case.
3. Use `turn` as the permission source and OpenAPI as the field contract.
4. Save evidence for every view, write, lookup, and verification.
5. Report blocked work with `caseId`, `phase`, `blockedReason`, `evidencePath`, `suspectedFiles`, and `recommendedOwner`.

File edits must stay inside the current skill root allowlist. A skill-only subagent may update this skill package and report code gaps as findings for another owner.

## Token Rule

Keep only the current turn, the selected action, and one OpenAPI operation in context. Use `projection.summary` for decisions and `projection.raw` only when a field source points to it.

In runtime mode, also keep one current polling target:

- current `workbench` item
- current `orderNo` or `projectId`
- one user reminder state

## Action Card Meaning

- `plainInstruction`: business instruction.
- `nextExpected`: expected business outcome.
- `importance`: `primary`, `secondary`, or `destructive`.
- `apiOperation`: OpenAPI operation to call directly.
- `inputHints`: current turn bindings and business defaults.
- `inputTemplate`: minimal body draft for turn execution.
- `inputSchema`: thin required-field hint.
- `nextTurn`: next view after navigation or write verification.

## Scripts

```bash
MONOPOLYFUN_BASE_URL='https://monopolyfun.app' \
MONOPOLYFUN_COOKIE='SESSION=...' \
node scripts/turn.mjs '{"intent":"view","scene":"home"}'

MONOPOLYFUN_BASE_URL='https://monopolyfun.app' \
node scripts/openapi-operation.mjs submitProof

MONOPOLYFUN_HANDLE='runtime_handle' \
MONOPOLYFUN_PASSWORD='runtime_password' \
MONOPOLYFUN_SECRET_SOURCE='env' \
MONOPOLYFUN_SECRET_PROVIDER='default' \
node scripts/runtime-bootstrap.mjs

MONOPOLYFUN_BASE_URL='https://monopolyfun.app' \
MONOPOLYFUN_COOKIE='MONOPOLYFUN_SESSION=...; MONOPOLYFUN_CSRF=...' \
MONOPOLYFUN_CSRF='...' \
node scripts/runtime-healthcheck.mjs
```

## OKX x402 Test Signing

When an agent needs to complete `complete_money_payment` in real OKX mode without a browser wallet, use `scripts/x402-private-key.mjs`. Full signing shape and evidence rules live in `references/x402-private-key.md`.

## Real OKX Capture / Reconciliation

Use `references/okx-real-capture.md` before marking OKX money settlement complete.

For A2A payment link or callback work, use the A2A section in `references/okx-real-capture.md`. Treat x402 capture and A2A callback as separate evidence paths.

## PR Security / Proof Binding

Use `references/pr-security-policy.md` before accepting project code-delivery proof.

## Reference Split

- `references/runtime-agent.md`: OpenClaw or Hermes account binding, 30 second workbench polling, user reminders, and runtime evidence.
- `references/okx-real-capture.md`: real OKX verify, settle, settle/status, and chain reconciliation evidence.
- `references/pr-security-policy.md`: project PR security, proof binding, and CI gate checks.
- `references/ordinary-agent.md`: normal market, order, workbench, identity, and payment work.
- `references/privileged-agent.md`: backoffice, risk, upload review, share release, payroll approval, and project authority work.
- `references/multi-agent-delivery-closure.md`: offer/request/project multi-agent delivery closure.
- `references/subagent-protocol.md`: constrained subagent allowlist, evidence, judge, repair, and failure reporting protocol.
- `references/x402-private-key.md`: skill-local x402 private-key signing for OKX payment tests.
- `references/latest-conclusion.md`: current agent protocol conclusion.
- `references/openapi-snapshot.json`: static OpenAPI snapshot for offline operation lookup.

## Packaging Contract

Keep this directory stable for GitHub installation:

- `SKILL.md`: entrypoint file.
- `skill.manifest.json`: repo-local runtime bootstrap helper.
- `references/`: durable runbooks and API snapshots.
- `scripts/`: executable helpers used by the skill.

OpenClaw discovery and gating depend on `SKILL.md` frontmatter. GitHub installers and repo-local automation can fetch this directory as one skill package when this structure stays intact.
