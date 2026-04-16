# 05 - TaskOrchestrator 编排器

## 先说结论

`TaskOrchestrator` 是任务推进器。

它不负责执行任务，而负责：

```text
选出下一项任务
标记任务开始
根据执行结果更新任务状态
维护整张计划状态
处理中断恢复和重试
```

源码落点：

- `../../src/orchestration/task-orchestrator.ts`
- `../../src/orchestration/orchestration-types.ts`
- `../../src/runtime/runtime-bundle.ts`

## 它为什么不是 AgentLoop

`AgentLoop` 执行的是一轮模型调用和工具循环。

`TaskOrchestrator` 管的是任务板：

```text
哪项 pending
哪项 in_progress
哪项 completed
哪项 blocked
当前 currentTaskId 是谁
整张计划是 executing 还是 paused
```

所以它们关系是：

```text
TaskOrchestrator 选任务
Runtime 把任务变成 prompt
AgentLoop 执行这一轮
Runtime 评估结果
TaskOrchestrator 更新状态
```

## 当前核心方法

### initialize

把静态 `TaskPlan` 变成动态 `PlanSnapshot`。

```text
TaskPlan
  -> PlanSnapshot(status=idle)
  -> TaskSnapshot[](status=pending)
```

### startNext

按顺序找下一项可执行任务。

可执行条件：

```text
status 是 pending
依赖任务都 completed
当前没有别的 in_progress
```

找到后：

```text
task.status = in_progress
snapshot.status = in_progress
attemptCount += 1
currentTaskId = task.id
planSnapshot.status = executing
```

### completeTask

执行成功后：

```text
任务 -> completed
写入 completedAt
写入 lastResultSummary
写入 lastExecution
清空 currentTaskId
如果全部完成，整张计划 -> completed
```

### blockTask

任务受阻后：

```text
任务 -> blocked
写入 blockedReason
写入 lastExecution
整张计划 -> paused
```

### failTask

任务失败后：

```text
任务 -> failed
写入 lastExecution
整张计划 -> failed
```

### recover

跨命令恢复时，如果发现遗留 `in_progress`：

```text
in_progress -> pending
currentTaskId 清空
计划 -> paused
```

这样下一次 `startNext()` 可以重新调度。

### retryTask

把 blocked / failed 任务重置：

```text
blocked/failed -> pending
清空 blockedReason
计划 -> paused
```

## 为什么状态更新要集中在 orchestrator

如果 CLI、Runtime、AgentLoop 都能直接改任务状态，会出现：

```text
状态更新分散
不变式没人维护
测试难覆盖
恢复逻辑难统一
```

集中在 orchestrator 后，状态变化就有一个权威入口。

## 当前不变式

当前设计隐含这些规则：

```text
同一时刻最多一个 currentTaskId
只有 pending 且依赖完成的任务能 startNext
complete/block/fail 只能作用于 in_progress 任务
completed 任务不会随便回到 pending，除非进入明确 retry/replan 机制
```

## 常见误解

### 误解一：Orchestrator 负责调用模型

不负责。调用模型由 Runtime / AgentLoop 完成。

### 误解二：Orchestrator 可以直接生成新计划

当前不负责。生成修订计划是 `Replanner` 的职责。

### 误解三：CLI 里直接改 JSON 文件更简单

短期简单，长期会破坏状态一致性。

## 值得记住

```text
TaskOrchestrator 是任务板推进器，不是任务执行器。
```

它让多步任务从“打印计划”升级成“可推进的执行态”。

