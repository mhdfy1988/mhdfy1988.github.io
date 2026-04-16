# 08 - Memento 备忘录模式

## 先说结论

备忘录模式（Memento Pattern）保存对象在某一刻的状态，用于恢复、回看或审计。

当前项目里的备忘录就是：

```text
PlanSnapshot
TaskSnapshot
ArchivedPlanState
```

源码落点：

- `../../src/task-state/task-snapshot.ts`
- `../../src/task-state/file-task-store.ts`
- `../../src/task-state/in-memory-task-store.ts`

## 为什么 Agent 需要备忘录

Agent 执行多步任务时，不能只靠聊天记录判断进度。

聊天记录可能有：

```text
用户说了什么
模型回答了什么
工具返回了什么
```

但它不稳定地表达：

```text
当前任务 ID 是什么
这项任务尝试了几次
是否 blocked
blocked 原因是什么
最近一次结构化执行结果是什么
当前 revision 是多少
```

这些应该由结构化快照保存。

## PlanSnapshot 保存什么

`PlanSnapshot` 保存整张计划的动态状态：

```text
snapshotId
planId
goal
revision
status
currentTaskId
tasks
createdAt
updatedAt
```

它回答：

```text
整张计划现在处于什么状态？
当前正在执行哪一项？
这一版计划是第几个 revision？
```

## TaskSnapshot 保存什么

`TaskSnapshot` 保存单项任务的动态状态：

```text
taskId
status
attemptCount
assignedOwner
startedAt
completedAt
blockedReason
lastResultSummary
lastExecution
updatedAt
```

它回答：

```text
这项任务做到哪了？
失败或阻塞过吗？
最近一次执行判断是什么？
```

## ArchivedPlanState 为什么重要

归档不是把计划转成纯文本，而是保存完整状态：

```text
ActivePlanState + archivedAt + archiveReason
```

所以 history 里的计划可以：

```text
查看详情
恢复成 active plan
保留 lastExecution
```

这就是备忘录模式的价值。

## 和恢复流程的关系

恢复时：

```text
FileTaskStore.getActive()
  -> 读 active-plan.json
  -> 得到 ActivePlanState
  -> TaskOrchestrator.recover()
  -> in_progress 退回 pending
  -> startNext 继续执行
```

如果没有 snapshot，系统只能从聊天记录猜。

## 常见误解

### 误解一：快照就是日志

不对。日志记录发生过什么，快照记录当前状态是什么。

### 误解二：只保存 currentTaskId 就够

不够。还要保存任务状态、attemptCount、blockedReason、lastExecution 等。

### 误解三：history 只需要保存标题

不够。要支持 restore，就必须保存完整状态。

## 值得记住

```text
Snapshot 是 Agent 任务系统的恢复点。
```

多步 Agent 想支持中断恢复，就必须有结构化备忘录。

