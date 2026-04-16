# 10 - Replanner 修订机制

## 先说结论

`Replanner` 负责在计划执行受阻时，基于当前执行态生成新的计划 revision。

当前第一版处理的是：

```text
blocked task
  -> revision 2
  -> 插入解除阻塞任务
  -> 原 blocked task 依赖解除阻塞任务
```

源码落点：

- `../../src/planning/replanner.ts`
- `../../src/planning/default-replanner.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../../src/entry/cli.ts`

## 它解决什么问题

多步任务不可能永远顺利。

例如当前任务：

```text
t1. 梳理任务范围与关键文件
```

执行后发现：

```text
缺少 GatewayAdapter 抽象
```

这时不能直接继续 `t2`，因为前置条件不完整。也不能简单从头生成一张新计划，因为已完成任务可能要保留。

Replanner 要做的是：

```text
基于当前 active plan 和 blockedReason，生成一个修订版计划
```

## 当前 replan 输入

Replanner 输入包含：

```text
active
blockedTaskId
blockedReason
goal
currentSummary
relevantPaths
constraints
availableTools
availableSkills
```

其中最关键的是：

```text
active.plan
active.snapshot
blockedTaskId
blockedReason
```

因为 replan 不是凭空规划，而是基于当前执行态修订。

## 当前 DefaultReplanner 怎么做

第一版策略比较保守：

```text
1. 找到 blocked task
2. 生成新 planId，例如 plan-001-r2
3. revision 从 1 变成 2
4. 插入 r2-unblock 任务
5. blocked task 从 blocked 重置为 pending
6. blocked task 增加依赖 r2-unblock
7. 保留后续任务结构
```

这样做的好处是：

```text
不大规模打乱原计划
明确先解决阻塞
保留已有任务关系
方便 preview diff
```

## replan 和 preview 的区别

`previewReplanBlockedTask(...)`：

```text
生成新计划
生成 diff
不写 active plan
不执行任务
```

`replanBlockedTask(...)`：

```text
生成新计划
替换 active plan
不自动执行
```

`replanBlockedTaskAndExecute(...)`：

```text
生成新计划
替换 active plan
自动执行新计划第一项
```

CLI 里：

```text
replan --preview
```

就是走 preview。

## RuntimeReplanDiff

当前 diff 包括：

```text
addedTaskIds
removedTaskIds
statusChangedTaskIds
dependencyChangedTaskIds
preservedCompletedTaskIds
```

这让用户能看到：

```text
新增了什么
删掉了什么
哪些状态变了
哪些依赖变了
哪些完成项被保留
```

## 当前边界

已经完成：

```text
blocked -> revision 2
插入解除阻塞任务
preview diff
replan 后替换 active
replan 后自动执行第一项
```

还没完成：

```text
人工确认 merge
复杂任务重排
多种 replan 策略
冲突检测
用户编辑计划后的合并
可视化 diff
```

所以它是 V3 第一版，不是成熟 replanner。

## 常见误解

### 误解一：Replanner 就是重新 plan 一次

不对。重新 plan 会丢失当前执行态。Replanner 应该基于 active plan 修订。

### 误解二：blocked 后只要 retry 就行

不一定。如果 blocked 是计划本身缺步骤，应该 replan，而不是盲目 retry。

### 误解三：preview 没什么用

preview 很重要，因为它让用户能先看修订影响，再决定是否覆盖 active plan。

## 值得记住

```text
Replanner 不是“重来一遍”，而是“带着当前状态修订计划”。
```

