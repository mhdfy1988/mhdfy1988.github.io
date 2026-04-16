# 04 - TaskPlan 与 TaskSnapshot 的分离

## 先说结论

`TaskPlan` 是静态计划，`TaskSnapshot` 是动态执行态。

一句话：

```text
TaskPlan 回答“要做什么”
TaskSnapshot 回答“做到哪了”
```

源码落点：

- `../../src/planning/planning-types.ts`
- `../../src/task-state/task-snapshot.ts`
- `../v3-orchestration-snapshot-design.md`

## 为什么要分离

如果把计划定义和执行状态混在一起，会很快变乱。

比如一个任务：

```text
t1. 梳理任务范围与关键文件
```

计划层关心：

```text
标题是什么
说明是什么
依赖谁
建议谁做
完成标准是什么
```

执行层关心：

```text
尝试了几次
什么时候开始
什么时候完成
为什么 blocked
最近一次执行结果是什么
异常来源是什么
```

这两类信息生命周期不同，所以应该分开。

## TaskPlan 里有什么

`TaskPlan` 偏静态：

```text
planId
goal
summary
status
assumptions
constraints
tasks
```

`TaskItem` 包含：

```text
id
title
description
kind
status
priority
suggestedOwner
acceptance
dependsOn
relatedPaths
notes
```

这些信息适合由 planner 生成。

## TaskSnapshot 里有什么

`TaskSnapshot` 偏动态：

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

这些信息适合由 orchestrator 和 runtime 执行过程更新。

## ActivePlanState 为什么同时保存 plan 和 snapshot

`ActivePlanState` 是：

```ts
{
  plan,
  snapshot,
}
```

原因是恢复时两边都需要：

```text
plan 告诉你任务定义和依赖
snapshot 告诉你执行进度和状态
```

只有 snapshot 没有 plan，系统不知道任务说明和依赖。  
只有 plan 没有 snapshot，系统不知道做到哪了。

## 和 replan 的关系

replan 需要知道：

```text
原计划是什么
当前哪个任务 blocked
blockedReason 是什么
哪些任务已经 completed
当前 revision 是多少
```

这些信息来自：

```text
TaskPlan + PlanSnapshot
```

如果没有 snapshot，replan 就只能“重新生成一张计划”，而不是“基于当前执行态修订计划”。

## 常见误解

### 误解一：TaskItem 里有 status，就不用 Snapshot

不对。`TaskItem.status` 只是计划项上的轻状态，`TaskSnapshot` 才是完整运行态。

### 误解二：Snapshot 是重复数据

它不是重复，而是对计划执行过程的记录。

### 误解三：执行状态可以靠聊天历史恢复

聊天历史是文本，不是可靠状态。恢复应该依赖结构化 snapshot。

## 值得记住

```text
计划是地图，快照是当前位置。
```

成熟 Agent 系统只要涉及多步任务，就应该尽早区分“任务定义”和“执行态”。

