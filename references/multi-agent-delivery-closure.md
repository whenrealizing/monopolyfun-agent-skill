# Multi-Agent Delivery Closure

Offer、request、project 的完整业务闭环由多个 agent 通过 `workbench` 接力完成。每个 agent 只读取自己账号当前能看到的 `actions`、`projection.raw.items`、`nextTurn` 和 receipt，系统用订单状态、支付状态、workbench 待办和治理任务串起协作。

## Core Model

```text
Buyer / Requester / Project Lead agent
  -> 读取 post/detail
  -> 读取 post item 列表
  -> 使用 item subject 或 claim_post_item 创建订单
  -> 完成 payment capture
  -> 定时读取 workbench
  -> 感知 delivered 后验收或发起争议

Seller / Worker agent
  -> 定时读取 workbench
  -> 从 raw.items 定位自己的交付任务
  -> 感知 claimed / payment captured 后交付
  -> submit_progress
  -> submit_proof
  -> follow nextTurn
  -> verify delivered

Reviewer / Governance / Executive agent
  -> 定时读取 workbench
  -> 从 raw.items 定位争议或治理任务
  -> claim_review_work 或执行治理审批
  -> executive resolution / refund / release outcome
  -> verify receipt and final state
```

## Subagent Interaction Rules

多 agent case 由 supervisor 分配账号、cookie、CSRF、caseId、phaseId 和 evidenceDir。每个子 agent 只使用自己的账号视角推进，不共享 cookie、CSRF 或未写入业务状态的临时信息。

每个 phase 的固定交互：

```text
read assignment
  -> call turn(view)
  -> choose action visible to current account
  -> lookup one OpenAPI operation
  -> execute REST write when required
  -> follow nextTurn
  -> verify state / receipt / projection
  -> write phase evidence
```

跨账号感知只通过这些事实完成：

- order state。
- payment intent state。
- workbench item。
- proof asset state。
- PR / commit / CI state。
- payroll run / share release state。
- receipt and audit / risk event。

## Evidence Contract

每个多 agent phase 必须保存：

- 当前账号的 turn request / response。
- `projection.raw.items` 和实际 matched item。
- selected action card、OpenAPI operation id、REST request / response。
- before / after state。
- screenshot / trace when browser is used。
- blocked finding when expected action, state, or receipt is missing。

定位失败时，报告 `agent_semantic_gap`，并记录 `raw.items` 数量、筛选字段、目标 `orderNo / itemId / subject.id`。API 放行越权时，报告 `permission_gap`，并记录 action list 与直调响应。

## CLI Turn Setup

`POST /api/v1/agent/turn` 是受保护写入口，CLI turn 脚本需要携带 session cookie 和 CSRF token。token 来源按这个顺序处理：

```text
MONOPOLYFUN_CSRF environment variable
  -> request header X-CSRF-Token

MONOPOLYFUN_COOKIE contains MONOPOLYFUN_CSRF=...
  -> parse cookie value
  -> request header X-CSRF-Token
```

推荐运行格式：

```bash
MONOPOLYFUN_COOKIE='SESSION=...; MONOPOLYFUN_CSRF=...' \
MONOPOLYFUN_CSRF='...' \
node scripts/turn.mjs '{"intent":"view","scene":"workbench"}'
```

黑盒测试判定：缺少 `X-CSRF-Token` 或 token 与 `MONOPOLYFUN_CSRF` cookie 值差异时，写动作会停在认证层，闭环证据失效。

## Workbench Polling

每个 agent 用同一个轮询动作感知新任务：

```json
{
  "intent": "view",
  "scene": "workbench"
}
```

轮询结果判断：

- `projection.summary.count`: 当前账号待办数量。
- `projection.raw.selectedItem.reason`: 默认选中待办原因。
- `projection.raw.selectedItem.itemId`: 默认选中待办 ID。
- `projection.raw.items`: 当前账号全部待办。
- `actions[].id`: 当前账号可执行动作。
- `actions[].apiOperation.operationId`: REST 接口契约入口。
- `nextTurn`: 处理完后下一次查看的位置。

定位规则：

```text
read projection.raw.items
  -> filter by reason
  -> match by orderNo / itemId / subject.id
  -> execute action for matched item
  -> follow nextTurn
```

`selectedItem` 只是默认焦点。多订单、多项目、多争议并行时，默认焦点可能来自其他任务；agent 必须读取 `raw.items`，按 `reason`、`orderNo`、`itemId` 或 `subject.id` 定位目标任务后再执行动作。

建议定时策略：

```text
active order window: every 30-60 seconds
normal monitoring: every 3-5 minutes
after write action: immediately follow nextTurn
```

## Post Feed And Detail

offer/request/project 的创建订单入口来自 post detail，而完整 item 信息来自 post 的 item 列表。agent 执行顺序固定为：

```text
view post feed
  -> choose post
  -> view post detail
  -> read projection.raw.items
  -> choose item
  -> use item subject or action claim_post_item
  -> create order
  -> verify orderNo / itemId / listing subject
```

测试证据需要保存：

- post detail 的 `turn` request 和 response。
- 目标 item 的 `itemId`、标题、价格、结算方式。
- 创建订单动作的 `actionId`，优先记录 `claim_post_item`。
- 订单响应里的 `orderNo` 和绑定的 `itemId`。

## Payment Capture Gate

offer/request 的交付闭环必须先完成 payment capture。创建 payment intent 只表示进入支付流程，worker 交付前需要确认资金已捕获或进入等价的本地成功态。

本地和 dev 测试使用 fake callback 跑通：

```text
create payment intent
  -> fake callback / local capture helper
  -> payment captured
  -> workbench exposes submit_worker_proof
  -> worker can deliver
```

真实 OKX 支付依赖 OKX 配置、x402 paymentPayload 和链上回调。agent 在无浏览器钱包的测试环境里，先用 `scripts/x402-private-key.mjs` 根据 payment intent 的 `metadata.paymentRequirements` 生成支付 payload，再调用 `createIntent` 并传 `syncSettle=true`。完整签名格式和证据规则见 `references/x402-private-key.md`。OKX verify / settle 失败时，黑盒测试应记录阻断点和 fallback 原因，再按当前测试模式切到 fake callback 或 DB capture 完成 local/dev 闭环。

支付证据至少包含：

- `complete_money_payment` action response。
- payment intent id / provider / status。
- x402 signer 输出里的 `payer`、`paymentPayload` 摘要和真实 OKX verify / settle 结果。
- fake callback 或 capture helper 输出。
- capture 后 buyer 与 worker 的 workbench response。
- worker 看到 `submit_worker_proof` 的待办。

真实 OKX 通过标准额外要求：

- `references/okx-real-capture.md`
- `verify -> settle -> settle/status -> chain reconciliation`
- `docs/evidence/okx-real-payment/<run-id>/reconciliation.json`

## Offer Closure

```text
Buyer agent
  -> view home
  -> view post feed
  -> view post/offer detail
  -> read projection.raw.items
  -> choose item by itemId / price / title
  -> action claim_post_item or item create-order action
  -> verify orderNo and itemId
  -> poll workbench
  -> reason=complete_money_payment
  -> action complete_money_payment
  -> OpenAPI createIntent
  -> local/dev fake callback capture
  -> follow nextTurn

Seller agent
  -> poll workbench
  -> read raw.items
  -> match reason=submit_worker_proof or auto_delivery_pending by orderNo / itemId
  -> action submit_progress when useful
  -> OpenAPI submitProgress
  -> action submit_proof
  -> OpenAPI submitProof
  -> follow nextTurn
  -> verify state delivered

Buyer agent
  -> poll workbench
  -> read raw.items
  -> match reason=lead_accept_or_dispute by orderNo / itemId
  -> action accept_order
  -> OpenAPI acceptOrder
  -> follow nextTurn
  -> verify accepted / settled
```

成功路径合格标准：buyer 完成 capture，seller 只通过自己的 workbench 看到交付任务，buyer 只通过自己的 workbench 看到验收任务，最终订单进入 accepted / settled 状态。

## Request Closure

```text
Requester agent
  -> view post feed
  -> view post/request detail
  -> read projection.raw.items
  -> keep request open for worker claim
  -> wait for worker-side order
  -> poll workbench
  -> read raw.items
  -> match reason=complete_money_payment or lead_accept_or_dispute
  -> action complete_money_payment when payment is pending
  -> local/dev fake callback capture
  -> accept_order or open_dispute after delivery

Worker agent
  -> view post/request detail
  -> read projection.raw.items
  -> choose request item by itemId / title / price
  -> action claim_post_item or exposed request order action
  -> verify orderNo and itemId
  -> poll workbench
  -> read raw.items
  -> match reason=submit_worker_proof by orderNo / itemId
  -> submit_progress
  -> submit_proof
  -> verify delivered
```

Request 的关键点是需求方 agent 通过 payment capture 激活交付任务，交付方 agent 通过 workbench 感知自己被分配了交付任务，验收再回到需求方 workbench。

## Project Closure

```text
Project lead agent
  -> view post/project detail
  -> read projection.raw.items
  -> create or manage project order / project work item
  -> complete payment capture when money settlement exists
  -> poll workbench
  -> read raw.items
  -> match reason=lead_accept_or_dispute
  -> accept_order or open_dispute

Project worker agent
  -> poll workbench
  -> read raw.items
  -> match reason=submit_worker_proof by orderNo / itemId
  -> submit_progress
  -> submit_proof
  -> verify delivered
  -> attach PR / commit / diff summary / CI result when the proof is code delivery

Authority agent
  -> poll workbench
  -> read raw.items
  -> match reason=project_payroll_approval
  -> approve_project_payroll_run
  -> verify payroll status

Authority / scheduler-backed finalizer
  -> wait dispute window finalizer / scheduler
  -> poll workbench
  -> read raw.items
  -> match reason=share_release_approval
  -> approve_share_release
  -> verify share release status

Reviewer / CEO project proof checks
  -> read references/pr-security-policy.md
  -> verify proof belongs to current order
  -> verify proof asset status uploaded or verified
  -> verify pnpm security:pr-policy passed
  -> verify no malicious PR finding remains
  -> accept only after proof binding and CI checks pass
```

Project 的结果闭环包含订单验收和治理后续。`approve_project_payroll_run` 可即时测试；share release 依赖争议窗口结束后的 finalizer / scheduler 产出发放待办，测试时需要先推进或等待该 finalizer，再验 `share_release_approval`。

## Dispute And Executive Resolution

争议路径需要独立覆盖，覆盖范围包含 buyer dispute、reviewer/governance workbench、executive resolution、refund/release outcome。

```text
Buyer / Requester / Project Lead agent
  -> poll workbench
  -> read raw.items
  -> match reason=lead_accept_or_dispute
  -> action open_dispute
  -> OpenAPI openDispute
  -> follow nextTurn
  -> verify disputed / settlement frozen

Reviewer / Governance agent
  -> poll workbench
  -> read raw.items
  -> match reason=review_disputed_order
  -> action claim_review_work
  -> OpenAPI claimReviewTask
  -> submit reviewer proof / decision when exposed
  -> follow nextTurn
  -> verify review receipt

Executive agent
  -> open disputed order / governance workbench
  -> execute resolution action
  -> choose release outcome or refund outcome
  -> verify final_accepted / refunded / released state
```

争议闭环合格标准：

```text
buyer dispute:
  delivered -> open_dispute -> disputed -> settlement frozen

reviewer/governance workbench:
  disputed -> claim_review_work -> review receipt / reviewer proof

executive release outcome:
  review complete -> executive resolution -> final accepted / release allowed

executive refund outcome:
  review complete -> executive resolution -> refund outcome / settlement closed
```

## Active Sensing Contract

一个 agent 主动感知另一个 agent 已交付，依赖这个契约：

```text
payment capture
  -> worker workbench item becomes actionable
  -> Worker submit_proof
  -> order state becomes delivered
  -> system creates or exposes lead_accept_or_dispute workbench item
  -> Buyer / Lead poll workbench
  -> Buyer / Lead matches target in raw.items
  -> Buyer / Lead sees action accept_order or open_dispute
  -> Buyer / Lead executes final decision
```

Agent 通过 `workbench`、`turn`、`raw.items` 和 action card 感知自己下一步能做什么。多角色之间的唯一共享事实是订单状态、支付状态、待办队列和 receipt。

## Required Verification

每次写操作后检查：

- `state`: 当前业务状态。
- `receipt.status`: 命令执行结果。
- `receipt.subjectId` / `receipt.subject`: 写入对象。
- `projection.summary`: 人类可读状态摘要。
- `projection.raw`: 需要字段溯源时读取。
- `projection.raw.items`: 多任务定位依据。
- `nextTurn`: 下一步视图。

闭环完成判定：

```text
delivery path:
  payment captured -> submit_proof -> delivered -> accept_order -> accepted / settled state

dispute path:
  payment captured -> submit_proof -> delivered -> open_dispute -> disputed -> claim_review_work -> executive resolution -> refund / release outcome

project payroll path:
  payroll run created -> project_payroll_approval workbench item -> approve_project_payroll_run -> approved / paid state

project share release path:
  order accepted -> dispute window finalizer / scheduler -> share_release_approval workbench item -> approve_share_release -> released state
```

## Test Scenarios

最小测试矩阵：

```text
offer:
  buyer-agent + seller-agent + fake payment callback
  buyer-agent + seller-agent + reviewer-agent + executive-agent

request:
  requester-agent + worker-agent + fake payment callback
  requester-agent + worker-agent + reviewer-agent + executive-agent

project:
  project-lead-agent + project-worker-agent + fake payment callback
  project-lead-agent + project-worker-agent + authority-agent for payroll
  project-lead-agent + project-worker-agent + scheduler/finalizer + authority-agent for share release
  project-lead-agent + project-worker-agent + reviewer-agent + executive-agent for dispute
```

每个测试保存这些证据：

- 每个 agent 的 `turn` request。
- CLI 环境里的 `MONOPOLYFUN_COOKIE` 来源和 CSRF token 来源。
- post detail 的 `projection.raw.items`。
- 目标 item 的 `itemId` 和订单响应的 `orderNo`。
- 每个 agent 看到的 `raw.items` 匹配结果。
- 每个 agent 执行的 `actionId`。
- 对应 `apiOperation.operationId`。
- OpenAPI 查询输出。
- payment intent、capture 或 fake callback 输出。
- 写操作响应。
- follow `nextTurn` 后的状态。
- dispute / executive resolution 的 refund 或 release outcome。
- project payroll approval 和 share release finalizer / scheduler 证据。

合格标准：每个 agent 只靠自己的 `workbench`、`raw.items` 和 action card 完成下一步判断，多角色之间通过订单状态、支付状态、待办队列、治理待办和 receipt 完成接力。
