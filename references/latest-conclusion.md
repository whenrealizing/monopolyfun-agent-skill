# Latest Agent Conclusion

当前 agent 系统以 `POST /api/v1/agent/turn` 作为唯一业务入口。`turn` 返回当前账号可见状态、可执行 action、下一跳和当前对象投影；OpenAPI 提供完整 REST 字段契约。

## Interface Lookup

Agent 查接口按这个顺序：

1. 调用 `turn`，读取 action card。
2. 读取 `actions[].apiOperation.operationId`。
3. 用 `scripts/openapi-operation.mjs <operationId>` 查询接口。
4. 脚本优先读运行时 `/v3/api-docs`，运行时不可达时读取 `references/openapi-snapshot.json`。
5. 用 OpenAPI 的 `requestBody / parameters / responses` 组装请求并校验响应。

## Document Split

普通 agent 读取：

- `SKILL.md`
- `references/subagent-protocol.md`
- `references/ordinary-agent.md`
- `references/multi-agent-delivery-closure.md`
- `references/openapi-usage.md`
- `references/business-flows.md`

高权限 agent 额外读取：

- `references/privileged-agent.md`
- `references/safety-rules.md`

## Current Boundaries

公开 scene 是 `home / post / identity / workbench / backoffice`。

普通业务路径集中在 `post` 和 `workbench`：发现对象、读取详情、提交证明、自动交付、验收、发起争议、创建支付意图、领取争议评审待办。

高权限路径集中在 `backoffice`、项目治理和审批待办：上传审核、风控账号、后台重置、shares 发放审批、project 工资审批、项目角色和工资成员管理、支付意图后台处理。

`approve_project_payroll_run` 和 `claim_review_work` 已补齐 OpenAPI 绑定，分别对应 `approveRun` 和 `claimReviewTask`。静态 OpenAPI 快照当前包含 90 个 path，覆盖 `submitProof / approveRun / approveShareReleaseRequest / claimReviewTask / freezeRiskAccount` 等核心操作。

Offer、request、project 的完整交付闭环按多角色协作执行：买家或需求方 agent 创建和验收，卖家或交付方 agent 从 workbench 领取交付待办并提交 proof，评审 agent 在争议出现后从 workbench 领取评审待办。

## Subagent Boundary

受限子 agent 先读取 `references/subagent-protocol.md`，再按 assignment 的 `allowedFiles`、`allowedCommands`、`caseIds` 和 `evidenceDir` 执行。skill-only 子 agent 只修复当前 skill 包内的语义和证据说明；发现 action card、projection、API guard、runner 或测试缺口时，输出 finding 并绑定 `suspectedFiles` 和 `recommendedOwner`。
