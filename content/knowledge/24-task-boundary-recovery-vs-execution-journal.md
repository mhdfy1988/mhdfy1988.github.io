# 24 - 任务边界恢复与轮内执行日志

## 先说结论

当前项目已经支持“任务边界恢复”，但还没有支持“轮内精确恢复”。

这两个概念一定要分清。

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/orchestration/task-orchestrator.ts`
- `../../src/task-state/file-task-store.ts`
- `../../src/task-state/task-snapshot.ts`
- `../../src/entry/cli.ts`

## 当前已经做到什么

当前 `resume` 的逻辑是：

```text
读取 active plan
-> recover(...)
-> 把遗留 in_progress 任务退回 pending
-> startNextAndExecute()
```

也就是说，如果上一次命令中断时有任务停在：

```text
in_progress
```

下一次恢复时会把它重新排队：

```text
pending
```

然后从这项任务边界重新执行。

## 为什么这是任务边界恢复

因为它恢复的是：

```text
这项任务应该重新执行
```

而不是：

```text
这项任务内部已经执行到第几个 tool call
```

所以它能处理：

- 跨命令恢复
- 进程退出后重新读 active plan
- 上次任务卡在 in_progress

但它不能处理：

- 当前任务已经跑到第 3 轮工具调用
- 第 2 个 tool 已经成功
- 模型下一步应该接着第 4 个 tool call

这些属于轮内精确恢复。

## 当前恢复数据存在哪里

CLI 的持久化 runtime 会用：

```text
FileTaskStore
```

默认路径：

```text
.harness-agent/active-plan.json
.harness-agent/plan-history.json
```

`active-plan.json` 保存的是：

```text
TaskPlan + PlanSnapshot
```

它能知道：

- 哪些任务 pending
- 哪些任务 in_progress
- 哪些任务 completed / blocked / failed
- 最近一次 lastExecution 是什么

但它还没有保存：

- AgentLoop 当前 round
- 每个 tool call 的输入输出
- 已完成但未提交的中间结果
- 模型原始 decision 序列

## recover 具体做了什么

`DefaultTaskOrchestrator.recover(...)` 会：

1. 找到所有 `in_progress` 任务。
2. 把它们退回 `pending`。
3. 清掉 `startedAt`。
4. 写入 `lastResultSummary` 说明恢复原因。
5. 把整张计划设为 `paused`。
6. 刷新 `runnableTaskIds`。

然后 runtime 再重新启动下一项。

## 为什么不直接继续 in_progress

因为进程已经中断后，系统无法确定：

- 模型有没有完成输出
- 工具有没有真的执行完
- 中间副作用有没有落盘
- 上次结果是否已经写回快照

所以第一版选择最保守的策略：

```text
退回任务边界，重新执行这项任务
```

它可能多做一点，但状态不会假装连续。

## 将来要补什么

未来如果要做到轮内精确恢复，需要新增一层：

```text
Execution Journal
```

它至少要记录：

- taskId
- executorOwner
- agentSessionId
- round index
- model decision
- tool call id
- tool call input
- tool result
- result committed 与否

这样 resume 时才有可能判断：

```text
上次已经完成哪些 tool call
这次应该从哪里继续
哪些副作用不能重复执行
```

## 常见误解

### 误解一：有 resume 就等于能从中断点继续

不对。

当前只能从任务边界继续，不是从 tool call 边界继续。

### 误解二：把 in_progress 留着就能继续

不对。

`in_progress` 只是状态，不是执行日志。

没有 journal，就不知道内部执行到了哪里。

### 误解三：任务边界恢复没价值

也不对。

它已经解决了跨命令最常见的问题：

```text
不要让任务永远卡在 in_progress
```

只是它还不是最终形态。

## 值得记住

```text
TaskSnapshot 能恢复任务边界。
Execution Journal 才能恢复轮内细节。
```

