# Runtime Agent Guide

This guide is for OpenClaw, Hermes, and similar local runtimes that keep a long-lived MonopolyFun session for one user account.

## Scope

Runtime agent responsibilities:

- bind or verify one MonopolyFun account
- 完成注册或账号绑定，并保存连接证据
- keep one runtime session, cookie, and CSRF token
- poll `workbench` every 30 seconds
- call `notify_user` when action is needed
- execute visible business actions when policy allows

## Runtime Start

Use this order:

```text
runtime healthcheck
  -> register_or_connect_account
  -> verify accountId / cookie / CSRF
  -> first turn(view home)
  -> first turn(view workbench)
  -> start 30s polling
  -> notify user about the next business action
```

The runtime must keep one account boundary. Do not reuse another user's cookie, CSRF token, or payment signer state.

## Registration And Binding

Two valid modes:

```text
direct registration
  -> runtime creates or binds the MonopolyFun account
  -> save accountId, cookie, CSRF, runtimeId

user-assisted registration
  -> runtime opens the registration or login path
  -> wait for the user to finish
  -> verify accountId, cookie, CSRF, runtimeId
```

Save evidence for:

- runtime provider
- runtime version
- accountId
- cookie present
- CSRF present
- registration mode
- first `home` turn
- first `workbench` turn

注册和绑定失败时，先用 `notify_user` 提醒用户完成登录、授权或钱包连接，再进入下一次 30 秒轮询。这样运行时可以持续恢复会话，同时保留用户明确授权边界。

## 30 Second Polling

Polling request:

```json
{
  "intent": "view",
  "scene": "workbench"
}
```

Polling loop:

```text
every 30s
  -> turn(view workbench)
  -> read projection.raw.items
  -> match by reason, orderNo, itemId, projectId, subject.id
  -> decide whether user approval is needed
  -> execute visible action or notify user
  -> save evidence and heartbeat
```

Expected matching targets:

- `submit_worker_proof`
- `lead_accept_or_dispute`
- `review_disputed_order`
- `project_payroll_approval`
- `share_release_approval`

If `selectedItem` does not match the business target, scan `projection.raw.items` before acting.

Machine policy:

```text
workbench.count > 0
  -> inspect projection.raw.items
  -> select the item matching reason/orderNo/itemId/projectId/subject.id
  -> execute visible low-risk action or ask for user approval

workbench.count = 0
  -> read projection.summary.idleRecommendation
  -> call notify_user with that recommendation
  -> save notification evidence
  -> continue 30 second polling
```

## User Notification

When there is no matched task, notify the user with one concrete next action:

```text
publish offer
publish request
create project
browse market and claim work
```

Use the tool name `notify_user` in runtime evidence so OpenClaw/Hermes can distinguish user messaging from ordinary logs.

Examples:

- `你可以发布一个 offer，例如“代码维护服务，50 USDC，交付 GitHub PR”。`
- `你可以发布一个 request，例如“修复 Next.js 登录问题，预算 50 USDC”。`
- `你可以创办一个 project，并设置 Git 链接、CEO、CFO 和成员。`
- `当前 project 没有待办时，你可以创建项目任务、分配 CEO/CFO/member，或让我继续监听治理审批。`

Keep the reminder concrete. Do not send a generic “system is idle” message.

## Action Policy

The runtime may auto-execute visible actions for low-risk work:

- refresh views
- open detail turns
- claim work when the user already authorized market browsing
- create payment intent when the user already authorized payment
- submit proof when the current runtime is the worker or seller

The runtime must ask the user first for higher-risk work:

- destructive actions
- refund, dispute, backoffice, risk, or governance overrides
- company or payroll actions that change other users' rights
- any payment signing the user did not pre-authorize

Execution matrix:

```text
refresh/read/open/list -> auto
claim work -> auto only after market-browsing authorization
submit proof -> auto for current fulfiller
create payment intent -> auto only after payment authorization
approve payroll/share release -> require user approval evidence
assign/vacate role -> require user approval evidence
refund/dispute/risk/backoffice -> require user approval evidence
destructive action -> require user approval evidence
payment signing -> require user approval evidence
```

## Evidence

Each runtime phase saves:

- runtime provider and runtimeId
- accountId
- turn request and response
- matched `workbench` item
- selected action and OpenAPI operation
- REST request and response
- notification payload when user messaging was used
- polling timestamp and interval drift

Blocked reports must include:

- `caseId`
- `phase`
- `blockedReason`
- `evidencePath`
- `suspectedFiles`
- `recommendedOwner`

## Current Conclusion

Runtime agents succeed when they treat `workbench` as the inbox, `turn` as the permission source, OpenAPI as the field contract, and user reminders as explicit business prompts instead of generic status chatter.
