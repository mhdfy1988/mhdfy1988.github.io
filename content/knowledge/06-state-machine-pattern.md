# 06 - 状态机模式

## 先说结论

状态机模式把系统可能处于的状态，以及状态之间允许怎样转换，显式表达出来。

当前项目里至少有三套状态机：

```text
RuntimeStatus   系统运行时状态
SnapshotStatus  整张计划执行状态
TaskStatus      单项任务执行状态
```

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/task-state/task-snapshot.ts`
- `../../src/planning/planning-types.ts`
- `../../src/orchestration/task-orchestrator.ts`

## 为什么不用几个 boolean

如果用 boolean，很容易出现非法组合：

```ts
isRunning = true
isStopped = true
hasFailed = true
```

这三个值同时为 true 时，系统到底是什么状态？

状态机用一个枚举式状态替代多个互相打架的 boolean：

```text
ready
stopped
failed
```

同一时刻只能是其中一个。

## RuntimeStatus

Runtime 状态：

```text
created
starting
ready
stopping
stopped
failed
disposed
```

它回答：

```text
整个系统现在能不能接请求？
```

关键规则：

```text
只有 ready 才能 agent.run
starting 时不能重复 start
stopping 时不能 start
disposed 后不能 start
start 失败进入 failed
```

## SnapshotStatus

计划快照状态：

```text
idle
executing
completed
failed
paused
```

它回答：

```text
整张计划当前推进到什么阶段？
```

典型转换：

```text
idle
  -> executing
  -> completed
```

受阻时：

```text
executing
  -> paused
```

失败时：

```text
executing
  -> failed
```

## TaskStatus

任务状态：

```text
pending
in_progress
completed
blocked
failed
cancelled
```

它回答：

```text
某一项任务现在是什么状态？
```

正常路径：

```text
pending -> in_progress -> completed
```

阻塞路径：

```text
pending -> in_progress -> blocked
```

重试路径：

```text
blocked -> pending -> in_progress
```

失败路径：

```text
pending -> in_progress -> failed
```

## 状态机和不变式

状态机真正重要的是不变式。

例如任务系统里：

```text
completeTask 只能完成 in_progress 任务
blockTask 只能阻塞 in_progress 任务
failTask 只能失败 in_progress 任务
startNext 只能启动 pending 且依赖完成的任务
```

这些不是 UI 展示规则，而是系统正确性的基础。

## 状态机和恢复

中断恢复时，如果看到：

```text
currentTaskId = t1
t1.status = in_progress
```

系统不能假装它还在运行。因为进程已经断了。

当前恢复策略是：

```text
recover()
  -> in_progress 退回 pending
  -> currentTaskId 清空
  -> planSnapshot.status = paused
```

这就是状态机在恢复场景下的价值。

## 常见误解

### 误解一：状态只是字符串

不对。状态是行为约束。不同状态允许的操作不同。

### 误解二：状态越多越完整

不一定。状态太多会让转换关系爆炸。状态应该覆盖关键边界，不是越细越好。

### 误解三：状态变化随便在哪里改都行

不行。状态变化应该集中在 orchestrator / runtime 这类权威入口。

## 值得记住

```text
状态机不是为了画图，而是为了阻止系统进入非法状态。
```

看成熟 Agent 系统时，要重点看：

```text
任务状态有哪些
会话状态有哪些
运行时状态有哪些
状态转换由谁负责
非法状态怎么阻止
```

