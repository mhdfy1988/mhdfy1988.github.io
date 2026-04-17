# 22 - Runnable Batch 与准备/提交分离

## 先说结论

当前项目已经有了最小并行执行基础，但它不是简单地：

```text
把所有任务 Promise.all
```

而是分成：

```text
prepare
-> run
-> commit
```

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/orchestration/task-orchestrator.ts`
- `../../src/team/default-team-coordinator.ts`
- `../../src/team/coordination-frame.ts`

## 为什么不能直接并行写状态

任务并行真正危险的地方不在“同时跑模型”，而在：

```text
同时改 TaskSnapshot
```

如果多个任务并发执行后同时写回 active plan，很容易出现：

- 后写覆盖先写
- runnable batch 计算错
- 一个任务 failed 后另一个任务还把计划写成 executing
- history 里记录不一致

所以当前设计允许并行执行，但写回仍然串行。

## Runnable Batch 是谁决定的

`DefaultTeamCoordinator.buildRunnableBatch(...)` 会基于 assignments 判断：

```text
当前 runnable tasks 是否可以组成 batch
```

第一版规则是：

```text
只有 worker / explorer 适合并行
且当前没有 pending review plan
```

如果有 reviewer gating，或者任务 owner 不适合并行，就退回串行。

## prepare 做什么

`prepareTaskForExecution(...)` 负责执行前准备：

1. 从 `CoordinationFrame.assignments` 找当前任务分配。
2. 如果 `assignedOwner` 和 snapshot 不一致，就调用：

```text
taskOrchestrator.assignTask(...)
```

3. 返回准备后的 `CurrentTaskState`。

它解决的是：

```text
TeamCoordinator 决定谁执行
TaskSnapshot 记录谁执行
```

这两件事必须先对齐。

## run 做什么

`runPreparedTask(...)` 负责真正执行：

```text
buildTaskExecutionPrompt(...)
-> taskExecutors.resolve(owner)
-> executor.run(...)
-> evaluateTaskExecutionReply(...)
-> reviewPolicy.plan(...)
-> executeReviewPlan(...)
-> summarizeTaskExecutionWithTeamCoordinator(...)
```

这个阶段会得到 `PreparedTaskExecution`，但还不直接写回最终状态。

## commit 做什么

`commitPreparedTaskExecution(...)` 最终调用：

```text
applyTaskEvaluation(...)
```

再根据评估结果写回：

```text
completeTask
blockTask
failTask
```

也就是说，真正改 active plan 的动作集中在 commit。

## executeRunnableBatch 为什么先 Promise.all 再排序提交

`executeRunnableBatch(...)` 里先并发运行：

```text
Promise.all(batch.tasks.map(...runPreparedTask...))
```

然后把结果放入 `commitQueue`：

```text
completed < blocked < failed
```

再逐个 `commitPreparedTaskExecution(...)`。

这里的意图是：

```text
执行可以并发
状态写回必须有序
```

这就是最小版的“并行执行，串行提交”。

## 为什么 blocked / failed 的提交顺序要谨慎

如果一个 batch 里有多个任务：

- 有的 completed
- 有的 blocked
- 有的 failed

最终计划状态会受到最严重结果影响。

当前做法是先提交低严重度，再提交高严重度，让更严重的状态最后收口。

这不是完整事务系统，但已经比“谁先跑完谁先写”稳定。

## 常见误解

### 误解一：有 Promise.all 就是并行任务系统

不对。

真正难的是并行之后怎么写回状态。

### 误解二：Orchestrator 应该负责并行执行

不对。

`TaskOrchestrator` 只负责状态机。

并行执行属于 runtime 用例层。

### 误解三：TeamCoordinator 直接启动 batch

不对。

TeamCoordinator 只产出 `RunnableBatchPlan`。

启动任务和写回状态仍由 runtime + orchestrator 完成。

## 值得记住

```text
并行任务的第一版不要急着做复杂调度器。
先做到：团队层给 batch，runtime 并行 run，orchestrator 串行 commit。
```

