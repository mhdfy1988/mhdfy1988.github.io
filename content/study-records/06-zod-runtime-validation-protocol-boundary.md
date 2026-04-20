# 学习记录-06-Zod 运行时校验与协议边界

这一阶段我们开始把运行时不可信输入交给 Zod 校验，而不是只依赖 TypeScript interface。

重点覆盖：

- 配置文件读取后的运行时校验
- 模型输出 / 协作协议的判别式联合校验
- 文件快照读取边界校验
- schema 校验和业务校验分层

---
# Zod 运行时校验接入设计

这份文档描述如何把 `zod` 接入 `harness-agent-lab`。

目标不是“为了用库而用库”，而是解决当前项目中一个真实问题：

```text
TypeScript interface 只能约束编译期
配置文件、模型输出、任务快照、协作日志都是运行时数据
运行时数据必须有运行时校验
```

## 为什么第一批选择 Zod

当前项目已经有大量手写运行时判断：

- `config-loader` 中的 `validateSettings`、`parseEnum`、`parseBoolean`。
- `plan-validator` 中的字段非空、状态合法性校验。
- `task-execution-evaluator` 中的 `JSON.parse` 和字段判断。
- `FileTaskStore` 和 `FileCollaborationLog` 中读取 JSON 后直接类型断言。

这些代码短期能跑，但随着协议增加，会出现几个问题：

- 字段判断越来越分散。
- 错误路径不够清晰。
- interface 和运行时校验容易漂移。
- 外部输入不可信时，类型断言会掩盖脏数据。

`zod` 的价值是把“类型描述”和“运行时校验”拉到同一个地方。

## 接入边界

Zod 只进入边界层，不进入核心决策逻辑。

适合使用 Zod 的地方：

- 配置文件读取边界。
- 环境变量转换后校验。
- 模型结构化输出解析边界。
- 文件快照读取边界。
- 协作协议消息读取边界。
- Gateway / MCP 外部输入边界。

不适合用 Zod 替代的地方：

- `TaskOrchestrator` 的状态推进规则。
- `TeamCoordinator` 的 followUp / escalation 决策。
- `Replanner` 的计划修订策略。
- `AgentLoop` 的执行循环。

换句话说：

```text
Zod 校验“这个数据是不是合法形状”
业务代码判断“这个合法数据下一步应该怎么走”
```

## 第一批 Schema 设计

### 1. 配置 Schema

建议文件：

```text
src/config/settings-schema.ts
```

覆盖对象：

- `AppSettings`
- `AgentSettings`
- `ModelSettings`
- `MemorySettings`
- `LearningSettings`
- `ReflectionSettings`
- `PermissionSettings`
- `HookSettings`
- `PluginSettings`
- `McpServerSettings`
- `McpSettings`
- `GatewaySettings`
- `CliSettings`
- `HarnessSettings`

第一版职责：

- 校验枚举值。
- 校验端口为正整数。
- 校验 MCP server 基本结构。
- 校验配置文件最终合并结果。

不在第一版做：

- 不做复杂跨字段推导。
- 不做配置迁移。
- 不支持 YAML/JSON5。

示意：

```ts
export const HarnessSettingsSchema = z.object({
  app: AppSettingsSchema,
  agent: AgentSettingsSchema,
  model: ModelSettingsSchema,
  memory: MemorySettingsSchema,
  learning: LearningSettingsSchema,
  reflection: ReflectionSettingsSchema,
  permissions: PermissionSettingsSchema,
  hooks: HookSettingsSchema,
  plugins: PluginSettingsSchema,
  mcp: McpSettingsSchema,
  gateway: GatewaySettingsSchema,
  cli: CliSettingsSchema
});
```

### 2. 计划 Schema

建议文件：

```text
src/planning/plan-schema.ts
```

覆盖对象：

- `TaskPlan`
- `TaskItem`
- `TaskPlanDraft`
- `TaskItemDraft`

职责划分：

```text
Zod:
  - 字段类型
  - 枚举合法性
  - 数组结构
  - 可选字段

PlanValidator:
  - task.id 唯一
  - dependsOn 必须指向存在任务
  - task 不能依赖自己
  - tasks 不能为空
```

这样 `PlanValidator` 不会消失，而是变成业务规则校验。

当前状态：

- 已完成。
- 已新增 `src/planning/plan-schema.ts`。
- 已导出 `TaskPlanSchema`、`TaskPlanDraftSchema`、`parseTaskPlanShape()`、`parseTaskPlanDraftShape()` 和 `PlanSchemaValidationError`。
- `assertValidTaskPlan()` 现在先调用 `parseTaskPlanShape()` 做结构校验，再调用 `validateTaskPlan()` 做业务规则校验。
- `PlanValidator` 继续保留 `task.id` 唯一、`dependsOn` 必须存在、不能依赖自己等计划规则。
- 已新增 `tests/planning/plan-schema.test.mjs` 覆盖字符串裁剪、非法枚举、未知字段拒绝、Draft 校验、结构校验与业务校验分层。

### 3. 任务状态 Schema

建议文件：

```text
src/task-state/task-state-schema.ts
```

覆盖对象：

- `TaskSnapshot`
- `PlanSnapshot`
- `ActivePlanState`
- `ArchivedPlanState`
- `TaskExecutionRecord`
- `TaskReviewRecord`

使用位置：

- `FileTaskStore.getActive()`
- `FileTaskStore.listHistory()`
- `FileTaskStore.restoreArchived()`

第一版重点：

- 读取文件后校验结构。
- 校验失败时抛出可读错误。
- 不做自动修复。

后续增强：

- 增加 `schemaVersion`。
- 支持旧版本快照迁移。

当前状态：

- 已完成。
- 已新增 `src/task-state/task-state-schema.ts`。
- 已导出 `ActivePlanStateSchema`、`ArchivedPlanStateSchema`、`ArchivedPlanStateListSchema` 和 `TaskStateSchemaValidationError`。
- `FileTaskStore.getActive()` 读取 active plan 文件后，会先调用 `parseActivePlanStateShape()`。
- `FileTaskStore.listHistory()` 读取 history 文件后，会先调用 `parseArchivedPlanStateListShape()`。
- `FileTaskStore.save()` 和 `writeHistory()` 写入前也会校验状态，避免把内部坏状态落盘。
- `InMemoryTaskStore.save()` 也会校验 active state，让测试替身和文件 store 的基本契约一致。
- schema 会校验 `TaskSnapshot`、`PlanSnapshot`、`lastExecution`、`reviews`、`followUp`、`escalation` 等嵌套结构。
- schema 额外校验 `snapshot.planId` 必须和 `plan.planId` 一致，`snapshot.tasks` / `runnableTaskIds` 里的任务必须存在于 `plan.tasks`。
- schema 额外校验 `snapshot.goal` 和 `plan.goal` 一致，`plan.tasks` 与 `snapshot.tasks` 任务集合完全对应，且 `plan.status` 与 `snapshot.status` 保持同步。
- 已补充测试覆盖 active 快照结构损坏、plan/snapshot 不一致、history 归档结构损坏。

### 4. 结构化任务结果 Schema

建议文件：

```text
src/orchestration/task-execution-result-schema.ts
```

覆盖对象：

- `StructuredTaskExecutionResult`

使用位置：

- `parseStructuredCandidate`

替换目标：

```text
JSON.parse 后手写:
  if (!isTaskExecutionStatus(parsed.status) || typeof parsed.summary !== "string") ...

替换为:
  StructuredTaskExecutionResultSchema.safeParse(parsed)
```

注意：

- JSON 提取逻辑可以保留。
- 关键词兜底逻辑可以保留。
- 只替换结构化字段校验。

### 5. 协作协议 Schema

建议文件：

```text
src/team/collaboration-schema.ts
```

覆盖对象：

- `CollaborationEnvelope`
- `TaskHandoffRequest`
- `CompletionSummary`
- `ReviewRequest`
- `ReviewResult`
- `BlockerReport`
- `ClarificationRequest`
- `EscalationNotice`

使用位置：

- `FileCollaborationLog.readAll()`
- Runtime 创建协作消息前的测试辅助。
- 后续 Gateway / MCP / 多 Agent 跨进程通信边界。

第一版做法：

- 先校验 envelope 的公共字段。
- payload 根据 `kind` 做 discriminated union。

示意：

```ts
export const CollaborationEnvelopeSchema = z.discriminatedUnion("kind", [
  TaskHandoffEnvelopeSchema,
  CompletionSummaryEnvelopeSchema,
  ReviewRequestEnvelopeSchema,
  ReviewResultEnvelopeSchema,
  BlockerReportEnvelopeSchema,
  EscalationNoticeEnvelopeSchema
]);
```

当前状态：

- 已完成。
- 已新增 `src/team/collaboration-schema.ts`。
- 已导出 `CollaborationEnvelopeSchema`、`CollaborationEnvelopeListSchema`、各类 payload schema 和 `CollaborationSchemaValidationError`。
- `FileCollaborationLog.append()` 会先校验单条协作消息，再写入文件。
- `FileCollaborationLog.readAll()` 会在读取文件后调用 `parseCollaborationEnvelopeListShape()`。
- `FileCollaborationLog.writeAll()` 写文件前也会校验整组消息，避免内部误写坏协议。
- `InMemoryCollaborationLog.append()` 也会校验单条协作消息，让测试替身和文件日志的基本契约一致。
- `kind` 和 `payload` 已经通过 `z.discriminatedUnion("kind", ...)` 绑定，比如 `completion-summary` 不能再配 `task-handoff` 的 payload。
- 已补充测试覆盖非法 owner、kind/payload 不匹配、未知字段拒绝、文件中损坏协作日志拒绝。

## 错误处理策略

Zod 错误不能直接原样甩给用户。需要包一层项目错误：

```text
ConfigValidationError
PlanSchemaValidationError
TaskStateSchemaValidationError
CollaborationSchemaValidationError
TaskResultSchemaValidationError
```

错误信息应包含：

- 数据来源，例如配置文件路径、快照文件路径、模型输出。
- 字段路径，例如 `gateway.web.port`。
- 原始错误摘要。
- 当前动作是否中止。

## 迁移步骤

### 第 1 步：只安装和新增 Schema

只新增 schema，不改行为。

目标：

- 让类型和 schema 先成型。
- 通过 `npm.cmd run build`。

当前状态：

- 已安装 `zod`。
- 已新增 `src/config/settings-schema.ts`。
- 已导出 `HarnessSettingsSchema`、`parseHarnessSettings` 和 `SettingsValidationError`。

### 第 2 步：配置接入

替换：

- `validateSettings`

保留：

- `readEnvOverrides`
- `mergeSettings`
- `resolveConfigPath`

配置是最适合第一批接入的地方，因为入口清晰、测试容易补。

当前状态：

- 已完成。
- `loadSettings()` 会在默认配置、配置文件、环境变量和 CLI overrides 合并之后，统一调用 `parseHarnessSettings()` 做最终运行时校验。
- 环境变量的字符串转换仍保留在 `config-loader` 内，例如端口字符串先转数字，再交给 schema 校验。
- 已新增 `tests/config/settings-schema.test.mjs` 覆盖默认配置、非法 provider、非法端口、MCP transport 跨字段约束、环境变量端口转换和未知字段拒绝。

### 第 3 步：计划结构接入

替换：

- `assertValidTaskPlan` 入口处的结构合法性假设。

保留：

- `validateTaskPlan` 中的业务规则。
- `DefaultPlanner` 和 `DefaultReplanner` 的 normalize + validate 流程。

当前状态：

- 已完成。
- `src/planning/plan-schema.ts` 负责 `TaskPlan` / `TaskItem` / `TaskPlanDraft` / `TaskItemDraft` 的运行时结构校验。
- `PlanSchemaValidationError` 表示计划形状不合法。
- `PlanValidationError` 表示计划形状合法，但业务规则不成立。
- 这一步形成了两层门：

```text
parseTaskPlanShape()
  ↓
确认字段、枚举、数组、时间戳等结构合法
  ↓
validateTaskPlan()
  ↓
确认 task.id 唯一、dependsOn 存在、不能依赖自己
```

### 第 4 步：结构化任务结果接入

替换：

- `parseStructuredCandidate` 中的手写字段判断。

保留：

- JSON 代码块提取。
- 关键词兜底。

当前状态：

- 已完成。
- 已新增 `src/orchestration/task-execution-result-schema.ts`。
- 已导出 `StructuredTaskExecutionResultSchema` 和 `parseStructuredTaskExecutionResult()`。
- `parseStructuredCandidate()` 现在只负责提取和 `JSON.parse`，字段合法性统一交给 Zod schema。
- 非法结构化 JSON 不会直接抛出中断任务，而是返回 `null`，让 evaluator 继续回退到关键词启发式判断。
- 已补充测试覆盖字段裁剪、非法 status、空 summary、未知字段拒绝，以及非法结构化 JSON 的启发式回退。

### 第 5 步：文件快照接入

替换：

- `FileTaskStore.getActive()`
- `FileTaskStore.listHistory()`

目标：

- 防止损坏文件被当成合法状态继续执行。

当前状态：

- 已完成。
- 文件读取仍然保留 `JSON.parse`，但 parse 后不再直接 `as ActivePlanState` / `as ArchivedPlanState[]`。
- active plan 读取失败会抛出 `TaskStateSchemaValidationError`。
- history 读取失败也会抛出 `TaskStateSchemaValidationError`，避免损坏归档污染 restore。

### 第 6 步：协作日志接入

替换：

- `FileCollaborationLog.readAll()`

目标：

- 确保跨轮协作历史不会污染 `TeamCoordinator`。

当前状态：

- 已完成。
- `FileCollaborationLog` 现在在 append、readAll、writeAll 三个点都走协作协议 schema。
- runtime 生成的 `task-handoff`、`completion-summary`、`review-request`、`review-result`、`blocker-report`、`escalation-notice` 已通过完整测试链路验证。

## 测试计划

新增测试建议：

```text
tests/config/settings-schema.test.mjs
tests/planning/plan-schema.test.mjs
tests/task-state/task-state-schema.test.mjs
tests/orchestration/task-execution-result-schema.test.mjs
tests/team/collaboration-schema.test.mjs
```

重点覆盖：

- 合法数据能通过。
- 缺少必填字段会失败。
- 非法枚举会失败。
- 错误路径可读。
- 旧测试全部保持通过。

## 风险

### 风险 1：Schema 和 interface 漂移

缓解：

- 尽量从 schema 推导类型，或者让 schema 与已有 interface 放在同一模块附近。
- 关键结构新增字段时，同时改 schema 和测试。

### 风险 2：一次性改太多

缓解：

- 先改配置。
- 再改任务计划。
- 再改结构化任务结果。
- 再改文件快照。
- 最后改协作协议。

### 风险 3：业务规则被误放进 schema

缓解：

- Schema 只做结构和基本约束。
- 依赖关系、状态推进、不变式仍放在业务层。

## 完成标准

第一阶段完成后，应达到：

- 配置文件有运行时 schema 校验。
- 任务计划有运行时 schema 校验，并和业务规则校验分层。
- 模型结构化任务结果有运行时 schema 校验。
- 文件快照读取有运行时 schema 校验。
- 协作日志读取有运行时 schema 校验。
- 旧的核心架构不被 Zod 反向污染。
