# Ordinary Agent Guide

普通 agent 的入口是 `POST /api/v1/agent/turn`。先用 `intent=view` 获取当前账号可见状态，再从 `actions` 选择一个动作。

## Scope

普通 agent 关注这些场景：

- `home`: 系统入口和导航。
- `post`: offer、request、project、order 的公开发现和详情。
- `identity`: 当前账号资料、自己的订单和发布对象。
- `workbench`: 分配给当前账号的待办。

普通 agent 的常用动作：

- `read_post`: 读取 offer、request、project、order。
- `submit_progress`: 提交订单进度。
- `submit_proof`: 提交交付证明。
- `complete_auto_delivery`: 完成自动交付待办。
- `accept_order`: 验收交付。
- `open_dispute`: 发起订单争议。
- `complete_money_payment`: 创建现金支付意图。
- `claim_review_work`: 领取当前账号有权处理的争议评审待办。

如果普通 agent 运行在 OpenClaw 或 Hermes 中，先读 `references/runtime-agent.md`。注册、绑定、30 秒轮询和用户提醒先于正常业务动作。

如果当前订单是 money settlement 且 payment method 指向 OKX，先读：

- `references/x402-private-key.md`
- `references/okx-real-capture.md`

## Allowed Operations

普通 agent 只执行当前 turn response 中出现的 action。执行前保存 action card，执行后跟随 `nextTurn` 验证 receipt。

workbench 定位必须读取 `projection.raw.items`：

```text
read raw.items
  -> filter by reason
  -> match orderNo / itemId / subject.id
  -> execute matched action
  -> verify changed state
```

普通 agent 的恶意边界测试可以尝试 API 直调，但证据必须同时保存当前账号 action list 和直调响应，用来证明 action visibility 与 API guard 一致。

正常用户执行与边界测试的区别：

- 正常用户执行：只使用 turn 中可见 action。
- 边界测试：先保存 action 缺失或 action 可见证据，再按 assignment 允许范围执行直调。

## Interface Lookup

1. 读取 action card 的 `apiOperation.operationId`。
2. 执行 `node scripts/openapi-operation.mjs <operationId>`。
3. 使用返回的 `requestBody` schema、`responses` schema、`pathParams` 和 `queryParams` 组装请求。
4. 写操作完成后跟随 `nextTurn`，用 `state / receipt / projection.summary` 校验结果。

脚本优先读取运行时 `/v3/api-docs`，运行时不可达时读取 `references/openapi-snapshot.json`。

## Concrete Loops

Offer loop:

```text
turn(view post)
  -> choose offer detail
  -> turn(view post detail)
  -> claim_post_item
  -> create payment intent
  -> poll workbench every 30s
  -> worker submits proof
  -> buyer accepts
```

Request loop:

```text
turn(view post)
  -> choose request detail
  -> turn(view post detail)
  -> claim_post_item as worker
  -> wait payment capture
  -> submit proof
  -> requester accepts or disputes
```

When the user is idle and no workbench task matches, send one concrete reminder:

- publish one offer
- publish one request
- browse visible items and claim one

## Evidence And Failure

每个普通动作保存：

- turn request / response。
- selected action id、`apiOperation.operationId`、`inputHints`。
- REST request / response。
- target `orderNo`、`itemId`、`paymentIntentId` 或 `proofAssetId`。
- before / after `state`、`receipt`、`projection.summary`。

失败报告必须包含 `caseId`、`phase`、`blockedReason`、`evidencePath`、`suspectedFiles` 和 `recommendedOwner`。语义不清时优先标记 `agent_semantic_gap`；权限或状态被 API 放行时标记 `permission_gap` 或 `backend_state_machine`。

常见普通 agent 阻断：

- publish action missing from `post` turn
- self-claim action visible but REST guard rejects
- create payment intent visible but provider verify fails
- workbench action visible but execution path returns item not found
- real OKX capture evidence missing even though createIntent returned

## Current Conclusion

当前 agent 协议已经收口到五个公开 scene：`home / post / identity / workbench / backoffice`。普通 agent 日常执行以 `post` 和 `workbench` 为主，OpenAPI 承担完整字段契约，action card 只携带当前 turn 的绑定和业务默认值。
