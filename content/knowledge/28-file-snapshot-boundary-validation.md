# 文件快照读取边界校验

## 它是什么

文件快照读取边界校验，是指从磁盘读取任务状态文件后，不能直接相信 `JSON.parse()` 的结果。

以前的写法类似：

```ts
const parsed = JSON.parse(content) as ActivePlanState;
```

这只是告诉 TypeScript：

```text
把它当成 ActivePlanState。
```

但它并没有真的检查文件内容。

现在的写法是：

```ts
const parsed = parseActivePlanStateShape(JSON.parse(content), filePath);
```

这才是真的运行时校验。

## 为什么它重要

我们的 Agent 后续会越来越依赖快照：

- `resume` 要从 active plan 继续。
- `history` 要展示历史计划。
- `archive` 要把当前状态长期保存。
- `restore` 要把历史状态重新变成 active。
- 后续中断恢复也会依赖任务边界快照。

如果磁盘文件坏了，系统不能继续假装它是合法状态。

否则会出现很难排查的问题：

- `snapshot.status` 是一个不存在的值，但 orchestrator 继续推进。
- `snapshot.planId` 和 `plan.planId` 不一致，恢复错计划。
- `snapshot.tasks` 里出现了计划中不存在的任务，调度器找不到对应 `TaskItem`。
- `lastExecution` 结构损坏，TeamCoordinator 汇总出错误 followUp。
- history 某条归档坏了，restore 时污染当前 active plan。

## 当前仓库里的落点

本轮新增：

```text
src/task-state/task-state-schema.ts
```

接入位置：

```text
src/task-state/file-task-store.ts
```

现在 `FileTaskStore.getActive()` 的流程是：

```text
读取 active plan 文件
  ↓
JSON.parse()
  ↓
parseActivePlanStateShape()
  ↓
cloneActivePlanState()
  ↓
返回 ActivePlanState
```

`FileTaskStore.listHistory()` 的流程是：

```text
读取 history 文件
  ↓
JSON.parse()
  ↓
parseArchivedPlanStateListShape()
  ↓
逐条 cloneArchivedPlanState()
  ↓
返回 ArchivedPlanState[]
```

## 这次校验了什么

`TaskStateSchema` 覆盖了这些结构：

- `TaskSnapshot`
- `PlanSnapshot`
- `ActivePlanState`
- `ArchivedPlanState`
- `TaskExecutionRecord`
- `TaskReviewRecord`
- `TaskFollowUpSuggestion`
- `TaskEscalationSuggestion`

它会校验：

- 状态枚举是否合法。
- 时间戳是否是非负整数。
- `attemptCount` 是否是非负整数。
- `lastExecution` 是否有合法 `status / source / artifacts`。
- `reviews` 是否是合法审查记录。
- `followUp` 和 `escalation` 是否是合法建议。
- `snapshot.planId` 是否和 `plan.planId` 一致。
- `snapshot.tasks` 里的任务是否都存在于 `plan.tasks`。
- `runnableTaskIds` 里的任务是否都存在于 `plan.tasks`。

## 这不是自动修复

这一步只做校验，不做修复。

也就是说：

```text
文件坏了
  ↓
抛出 TaskStateSchemaValidationError
  ↓
由上层决定提示用户、备份文件、清空状态、或后续做迁移
```

第一版不要偷偷修复坏文件。

原因是自动修复很容易误判，尤其是任务状态涉及恢复和历史归档，修错比报错更危险。

## 和内存 Store 的关系

`InMemoryTaskStore` 暂时没有接 Zod。

原因是：

```text
InMemoryTaskStore 主要用于测试和当前进程内传递。
FileTaskStore 是跨命令、跨进程、跨时间的外部边界。
```

Zod 第一优先级应该放在外部边界上。

后续如果内存 store 也要暴露给插件、Gateway 或外部服务，再考虑统一接入。

## 学到的设计经验

这刀的关键经验是：

```text
持久化文件不是内部对象。
它一旦落盘再读回来，就已经变成外部输入。
```

所以磁盘文件读取必须和配置文件、模型输出一样，通过运行时 schema 校验。

这对 Agent 很重要，因为 Agent 的“长期运行”和“中断恢复”本质上都依赖可信快照。
