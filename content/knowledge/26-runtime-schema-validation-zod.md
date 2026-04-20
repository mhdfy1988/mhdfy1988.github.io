# Zod 运行时 Schema 校验

## 它是什么

Zod 运行时 Schema 校验，是指在程序真正运行时检查外部数据是否符合项目要求。

TypeScript interface 只在编译期生效，运行时并不会检查真实数据。

例如：

```ts
const parsed = JSON.parse(raw) as HarnessSettings;
```

这行代码并没有真的证明 `parsed` 是合法配置，只是告诉 TypeScript：

```text
相信我，它就是 HarnessSettings。
```

Zod 的作用是把这句话变成真正的检查：

```ts
const settings = HarnessSettingsSchema.parse(parsed);
```

如果数据结构不对，就在边界处失败。

## 它解决什么问题

当前项目里有很多运行时数据来源：

- 配置文件。
- 环境变量。
- CLI 参数。
- 模型结构化输出。
- 任务快照文件。
- 归档历史文件。
- 多 Agent 协作消息。
- 未来 Gateway 请求体。
- 未来 MCP 返回数据。

这些数据都不是 TypeScript 能天然保证的。

如果没有运行时校验，脏数据可能会流进核心逻辑，导致：

- Runtime 启动后才在深层报错。
- 错误字段难定位。
- 任务快照损坏后仍继续执行。
- 模型输出格式错误却被误判为合法。
- 协作协议消息缺字段，污染 TeamCoordinator。

Zod 的价值就是把这些问题挡在入口边界。

## 在当前仓库哪里出现

本轮新增：

```text
src/config/settings-schema.ts
```

核心导出：

```text
HarnessSettingsSchema
parseHarnessSettings()
SettingsValidationError
```

接入位置：

```text
src/config/config-loader.ts
```

当前流程变成：

```text
createDefaultSettings()
  ↓
readConfigFile()
  ↓
readEnvOverrides()
  ↓
mergeSettings()
  ↓
parseHarnessSettings()
  ↓
返回可信 HarnessSettings
```

第二个落点是模型结构化任务结果：

```text
src/orchestration/task-execution-result-schema.ts
src/orchestration/task-execution-evaluator.ts
```

当前流程变成：

```text
Agent 回复文本
  ↓
提取直接 JSON 或 ```json 代码块
  ↓
JSON.parse()
  ↓
parseStructuredTaskExecutionResult()
  ↓
合法则 source = structured
  ↓
非法则返回 null，继续走关键词启发式判断
```

第三个落点是任务计划：

```text
src/planning/plan-schema.ts
src/planning/plan-validator.ts
```

当前流程变成：

```text
DefaultPlanner / DefaultReplanner
  ↓
normalizeTaskPlan()
  ↓
assertValidTaskPlan()
  ↓
parseTaskPlanShape()
  ↓
validateTaskPlan()
  ↓
返回可信 TaskPlan
```

这里要注意两种错误已经拆开了：

```text
PlanSchemaValidationError:
  数据形状不合法，例如 status 非法、字段为空、未知字段混入。

PlanValidationError:
  数据形状合法，但计划业务规则不成立，例如 task.id 重复、dependsOn 指向不存在任务。
```

第四个落点是任务状态快照：

```text
src/task-state/task-state-schema.ts
src/task-state/file-task-store.ts
```

当前流程变成：

```text
FileTaskStore.getActive()
  ↓
读取 active-plan.json
  ↓
JSON.parse()
  ↓
parseActivePlanStateShape()
  ↓
cloneActivePlanState()
  ↓
返回可信 ActivePlanState
```

history 也是同样的思路：

```text
FileTaskStore.listHistory()
  ↓
读取 plan-history.json
  ↓
JSON.parse()
  ↓
parseArchivedPlanStateListShape()
  ↓
cloneArchivedPlanState()
  ↓
返回可信 ArchivedPlanState[]
```

这一步的重点不是“让内存对象更强类型”，而是防止磁盘上的坏 JSON 被当成合法运行状态继续推进。

第五个落点是多 Agent 协作协议：

```text
src/team/collaboration-schema.ts
src/team/file-collaboration-log.ts
```

当前流程变成：

```text
FileCollaborationLog.append()
  ↓
parseCollaborationEnvelopeShape()
  ↓
写入 collaboration-log.json
```

读取时：

```text
FileCollaborationLog.readAll()
  ↓
读取 collaboration-log.json
  ↓
JSON.parse()
  ↓
parseCollaborationEnvelopeListShape()
  ↓
返回可信 CollaborationEnvelope[]
```

这一步最重要的是 `kind` 和 `payload` 的绑定：

```text
kind = task-handoff
  payload 必须是 TaskHandoffRequest

kind = completion-summary
  payload 必须是 CompletionSummaryPayload

kind = review-result
  payload 必须是 ReviewResultPayload
```

也就是说，不能再出现“消息类型说自己是 completion-summary，但 payload 还是 task-handoff 结构”的协议漂移。

测试位置：

```text
tests/config/settings-schema.test.mjs
tests/planning/plan-schema.test.mjs
tests/task-state/file-task-store.test.mjs
tests/team/collaboration-schema.test.mjs
tests/team/collaboration-log.test.mjs
```

覆盖内容：

- 默认配置可以通过。
- 非法 `model.provider` 会失败。
- 非法 `gateway.web.port` 会失败。
- `mcp.transport = stdio` 时 `command` 必填。
- `mcp.transport = http` 时 `url` 必填。
- 环境变量端口先转换成数字，再交给 schema 校验。
- 未知配置字段会被拒绝。
- 计划里的字符串字段会被裁剪。
- 计划非法枚举会被拒绝。
- 计划未知字段会被拒绝，避免协议漂移。
- `TaskPlanDraft` 可以先校验 planner 输出的半成品计划。
- `assertValidTaskPlan` 会先做结构校验，再做业务规则校验。
- `FileTaskStore` 会拒绝损坏的 active plan 快照。
- `FileTaskStore` 会拒绝 plan 和 snapshot 不一致的数据。
- `FileTaskStore` 会拒绝损坏的 history 归档快照。
- `FileCollaborationLog` 会拒绝 kind 和 payload 不匹配的协作消息。
- `FileCollaborationLog` 会拒绝损坏的协作日志文件。
- 协作协议会拒绝未知字段，避免跨 Agent 消息悄悄漂移。

## 关键设计点

### 1. Zod 管结构，业务层管规则

Zod 适合判断：

- 字段是否存在。
- 类型是否正确。
- 枚举是否合法。
- 数字范围是否合法。
- 字符串是否为空。
- 某些简单跨字段约束是否满足。

但复杂业务规则仍然应该留在业务层。

例如任务计划里：

```text
task.id 不能重复
task 不能依赖自己
dependsOn 必须指向存在任务
状态是否允许从 pending 变成 completed
```

这些更适合放在 `PlanValidator` 或 `TaskOrchestrator` 中。

### 2. 最终合并后再校验

配置不是单一来源，而是多个来源叠加：

```text
默认配置
配置文件
环境变量
CLI overrides
```

所以校验点应该放在最后：

```text
mergeSettings(...) 之后
```

这样可以校验最终 Runtime 真正拿到的配置。

### 3. 环境变量转换和 Schema 校验可以分工

环境变量天然都是字符串。

例如：

```text
HARNESS_AGENT_WEB_GATEWAY_PORT=3999
```

它进来时是 `"3999"`，但项目里需要的是数字 `3999`。

当前设计是：

```text
config-loader 负责把 env 字符串转换成 override
Zod 负责校验最终 port 是合法数字
```

这样比直接对所有字段用 `z.coerce` 更可控。

尤其布尔值要谨慎，因为 JavaScript 里 `"false"` 也是 truthy，不能粗暴转换。

### 4. strict 可以拒绝拼写错误

`HarnessSettingsSchema` 使用 `.strict()`。

这意味着：

```json
{
  "gateawy": {}
}
```

不会静默通过。

这对配置文件很重要，因为拼写错误如果被忽略，用户会以为配置生效了，实际没有。

### 5. 模型输出边界要允许温和失败

配置文件非法时，通常应该直接抛错。

但模型输出不一样。模型可能没有严格按协议返回 JSON，此时不能让整个任务执行直接崩掉。

当前设计是：

```text
结构化 JSON 合法:
  使用 structured 结果

结构化 JSON 不合法:
  返回 null
  回退到 heuristic 关键词判断
```

这体现了一个边界策略：

```text
系统配置边界要严格失败
模型输出边界要优先校验，但保留兜底
```

### 6. 结构校验和业务校验要分层

任务计划这次接入 Zod 时，没有把 `PlanValidator` 删除。

原因是两者职责不同：

```text
Zod:
  这是不是一张形状合法的 TaskPlan？

PlanValidator:
  这张形状合法的 TaskPlan，在业务上能不能执行？
```

例如 `status = "doing"` 是结构错误，Zod 应该拦住。

例如两个任务都叫 `t1`，每个字段本身都合法，但计划不能执行，这是业务规则，应该由 `PlanValidator` 拦住。

这就是边界校验和领域规则的区别。

## 常见误解

### 误解 1：用了 Zod 就不用 TypeScript interface

不是。

TypeScript 和 Zod 是互补关系：

```text
TypeScript 管编译期
Zod 管运行时
```

### 误解 2：Zod 应该替代所有校验函数

不是。

Zod 适合边界数据校验，不适合替代所有业务规则。

### 误解 3：所有输入都应该自动转换

不是。

环境变量和 CLI 参数可以适度转换，因为它们天然是字符串。

但模型输出、任务快照、协作协议应更严格，错误就应该暴露出来，不要偷偷猜。

## 后续还能展开什么

下一步可以继续把 Zod 用到：

- Gateway 请求体。
- MCP 外部返回值。
- 后续插件 manifest。

推荐顺序：

```text
Gateway 请求
  ↓
MCP 返回值
  ↓
插件 manifest
```

这样风险最小，也最符合当前 Agent 架构演进节奏。
