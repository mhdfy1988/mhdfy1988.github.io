# Schema 校验与业务校验分层

## 它是什么

Schema 校验与业务校验分层，是指不要把所有校验都塞进一个地方。

在当前项目里，Zod 负责回答：

```text
这个数据长得对不对？
```

业务校验器负责回答：

```text
这个数据虽然长得对，但在当前业务规则下能不能用？
```

这两个问题看起来很像，但其实不一样。

## 为什么要分层

如果不分层，常见结果是：

- Zod schema 越写越复杂，里面塞满业务判断。
- 业务校验函数继续手写大量 `typeof` 和枚举判断。
- 错误信息混在一起，不知道是数据格式错，还是业务规则错。
- 以后协议升级时，很难判断应该改 schema 还是改业务逻辑。

分层后，每层都更清楚。

```text
外部数据
  ↓
Schema 校验：字段、类型、枚举、数组、基础范围
  ↓
业务校验：依赖关系、状态流转、唯一性、领域不变式
  ↓
核心逻辑
```

## 当前仓库里的例子

本轮 Zod 第三刀落在 planning：

```text
src/planning/plan-schema.ts
src/planning/plan-validator.ts
```

现在 `assertValidTaskPlan()` 的流程是：

```text
assertValidTaskPlan(plan)
  ↓
parseTaskPlanShape(plan)
  ↓
validateTaskPlan(parsedPlan)
  ↓
返回 TaskPlan
```

`parseTaskPlanShape()` 来自 Zod schema。

它负责：

- `planId`、`goal`、`summary` 不能为空。
- `status` 必须是 `draft` / `ready` / `superseded` / `completed`。
- `tasks` 至少有一个任务。
- 每个任务的 `kind`、`status`、`priority`、`suggestedOwner` 必须是合法枚举。
- `acceptance` 至少有一个验收条件。
- 未知字段直接拒绝。

`validateTaskPlan()` 继续负责业务规则。

它负责：

- `task.id` 不能重复。
- `dependsOn` 必须指向存在的任务。
- 任务不能依赖自己。
- 每个任务必须有可执行的核心内容。

## 一个具体例子

下面这个计划是结构错误：

```json
{
  "status": "doing"
}
```

`doing` 不是合法计划状态。这个错误不需要进入业务校验，Zod 就应该拦住。

下面这个计划是业务错误：

```json
{
  "tasks": [
    { "id": "t1", "...": "..." },
    { "id": "t1", "...": "..." }
  ]
}
```

每个任务字段本身可能都合法，但两个任务 ID 重复，计划不能执行。

这类错误应该由 `PlanValidator` 拦住。

## 为什么这对 Agent 架构重要

Agent 系统里很多数据都来自运行时：

- 模型输出。
- 任务计划。
- 任务快照。
- 协作消息。
- Gateway 请求。
- MCP 返回值。

如果没有 schema，脏数据会直接流进核心逻辑。

如果只有 schema，没有业务校验，系统会把“形状合法但无法执行”的数据当成好数据。

所以更稳的设计是：

```text
Schema 让数据可信
业务校验让行为可信
```

## 第一版怎么做

第一版不要追求完美抽象。

先做到：

- 每个重要边界都有一个 schema 文件。
- 每个 schema 文件只处理结构问题。
- 每个领域模块保留自己的业务校验器。
- 错误类型拆开，例如 `PlanSchemaValidationError` 和 `PlanValidationError`。
- 测试里分别覆盖结构错误和业务错误。

## 后续怎么增强

后续可以继续把这个模式扩到：

- `TaskSnapshot`：schema 校验文件结构，orchestrator 校验状态推进。
- `CollaborationEnvelope`：schema 校验消息协议，coordinator 校验协作策略。
- `GatewayRequest`：schema 校验请求体，用例层校验权限和动作。

这样项目越长，边界越清楚。
