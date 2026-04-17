# 23 - FollowUp 自动推进循环

## 先说结论

`followUp` 不是展示文案。

它已经是 runtime 可以读取并自动执行的下一步动作协议。

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/team/default-team-coordinator.ts`
- `../../src/team/coordination-rules.ts`
- `../../src/task-state/task-snapshot.ts`
- `../../src/entry/cli.ts`

## followUp 回答什么问题

任务执行结果回答的是：

```text
这轮任务结果是什么？
```

例如：

- completed
- blocked
- failed

但 `followUp` 回答的是：

```text
系统下一步建议怎么做？
```

当前支持四种动作：

```text
continue
retry
replan
manual
```

## 四种动作分别是什么意思

### continue

当前任务可以收口，继续下一项。

runtime 会调用：

```text
startNextAndExecute()
```

### retry

当前任务值得重试，可能要换 owner。

runtime 会：

```text
retryTask(...)
可选 assignTask(...)
startNextAndExecute()
```

### replan

当前任务不是简单重试能解决，需要修订计划。

runtime 会调用：

```text
replanBlockedTaskAndExecute(...)
```

### manual

自动推进不稳，先停下来。

runtime 会返回停止原因，不再继续执行。

## followUp 从哪里来

主要来自 `TeamCoordinator.summarizeFrame(...)`。

它会根据：

- 当前任务
- 执行结果
- review 结果
- attemptCount
- blocked / failed 状态

生成后续建议。

底层规则在 `coordination-rules.ts` 里，例如：

- completed -> continue
- review 未通过 -> retry worker
- blocked -> replan
- 尝试次数过多 -> manual

## Runtime 如何自动推进

入口是：

```text
runtime.driveFollowUp(initial, { maxSteps })
```

内部循环是：

```text
for index < maxSteps:
  step = applyFollowUpStep(current)
  如果 step 没有 execution -> 停止
  否则 current = step.execution
```

这说明自动推进是“受限循环”，不是无限自治。

## CLI 如何暴露这个能力

`execute-plan`、`resume`、`replan`、`retry` 都支持：

```text
--auto-follow-up
--max-auto-steps <number>
```

CLI 不自己判断下一步，而是调用：

```text
maybeDriveFollowUp(...)
-> runtime.driveFollowUp(...)
```

这仍然保持了：

```text
CLI 只做用例适配
Runtime 决定自动推进
```

## 为什么要有 maxSteps

自动推进最大的问题是失控。

如果没有上限，系统可能在：

- retry
- replan
- continue

之间循环很久。

所以当前默认：

```text
maxSteps = 8
```

达到上限就停止，并返回明确原因。

## 常见误解

### 误解一：followUp 只是给用户看的提示

不对。

它已经能驱动 runtime 自动动作。

### 误解二：completed 后一定 continue

多数情况下是，但如果 review 没通过，TeamCoordinator 可以把 followUp 改成 retry。

### 误解三：auto-follow-up 等于完全自动驾驶

不对。

它是受限自动推进：

- 有动作枚举
- 有 maxSteps
- manual 会停
- 缺上下文会停

## 值得记住

```text
followUp 是“任务结果”和“下一步调度”之间的协议。
它让系统从单步执行，走向有限自动推进。
```

