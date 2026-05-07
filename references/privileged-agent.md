# Privileged Agent Guide

高权限 agent 使用同一个 `POST /api/v1/agent/turn` 协议，通过账号 capability、项目角色和后台权限获得扩展动作。

如果高权限 agent 运行在 OpenClaw 或 Hermes 中，先完成 `references/runtime-agent.md` 里的账号绑定和 30 秒轮询，再处理治理任务。

## Scope

高权限 agent 关注这些能力：

- `backoffice`: 审计、上传异常、风控账号、结算异常。
- 上传资产审核：`verify_upload_asset`、`quarantine_upload_asset`、`cancel_upload_asset`。
- 风控账号处理：`freeze_account`、`unfreeze_account`、`ban_account`、`watch_account`。
- 后台账号协助：`issue_password_reset_token`。
- Shares 发放审批：`approve_share_release`。
- Project 工资审批：`approve_project_payroll_run`。
- Project 权限操作：`claim_project_owner`、`assign_project_role`、`vacate_project_role`、`add_project_payroll_member`、`update_project_payroll_member`、`create_project_payroll_run`、`cancel_project_payroll_run`。
- 支付意图处理：`refresh_payment_intent`、`cancel_payment_intent`、`dispute_payment_intent`、`refund_payment_intent`、`default_payment_intent`。

## Execution Rules

高权限动作执行前读取 `projection.summary` 和 `nextExpected`，在 `input.reason` 中写入可审计原因。执行后跟随 `nextTurn`，校验目标对象状态和 `receipt`。

`importance=destructive` 的动作需要保留操作理由、对象 id、当前状态和预期结果，方便审计事件回放。

## Allowed Operations

高权限 agent 只使用当前账号可见的 `backoffice`、`workbench` 和项目 action。审批类动作必须从 `projection.raw.items` 定位目标待办：

```text
read raw.items
  -> match reason=project_payroll_approval or share_release_approval
  -> match projectId / payrollRunId / releaseRequestId
  -> execute approve action
  -> verify status and audit receipt
```

风控和后台动作必须保存目标账号、当前风险状态、操作理由、执行人账号和执行后状态。权限边界 case 需要同时验证 action hidden、API forbidden、state unchanged 和 audit / risk event。

## Concrete Loops

Project payroll loop:

```text
turn(view workbench)
  -> read projection.raw.items
  -> match reason=project_payroll_approval
  -> verify projectId / payrollRunId / expected role
  -> approve_project_payroll_run
  -> follow nextTurn
  -> verify payroll status changed
```

Share release loop:

```text
turn(view workbench)
  -> match reason=share_release_approval
  -> verify releaseRequestId and projectId
  -> approve_share_release
  -> follow nextTurn
  -> verify release request and settlement hold status
```

Backoffice risk loop:

```text
turn(view backoffice)
  -> locate risk case or upload case
  -> verify current state and reason
  -> execute visible action
  -> verify audit or risk event

Before approving share release, payroll, or project code acceptance:

- verify proof belongs to the current order
- verify proof asset status is `uploaded` or `verified`
- verify `pnpm security:pr-policy` passed when delivery is PR-based code work
- verify no unresolved malicious PR finding remains
- verify real OKX captured evidence when settlement is money
```

## Evidence And Failure

每个高权限动作保存：

- turn request / response。
- action card、`importance`、`nextExpected`、`input.reason`。
- REST request / response。
- target account / payment intent / payroll run / share release / proof asset id。
- before / after status、receipt、audit event 或 risk event。

失败报告必须绑定 `caseId`、`phase`、`blockedReason`、`evidencePath`、`suspectedFiles` 和 `recommendedOwner`。越权可执行时标记 `permission_gap`，状态机提前闭合时标记 `backend_state_machine`，文档定位成本过高时标记 `agent_semantic_gap`。

常见高权限阻断：

- publish project action missing from turn but REST publish works
- project create item action absent while permission guard exists
- share release request never appears after accepted order
- duplicate payroll approve returns idempotent success instead of conflict

## Current Conclusion

高权限能力已经挂在主 scene 之下：上传和风控归 `backoffice`，支付和项目操作归 `post`，审批待办归 `workbench`。这套结构让普通 agent 只处理业务执行，高权限 agent 通过账号权限进入治理动作。
