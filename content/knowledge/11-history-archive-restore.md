# 11 - History / Archive / Restore 任务历史设计

## 先说结论

任务历史系统把“当前正在推进的计划”和“已经收起来的历史计划”分开。

当前边界是：

```text
active-plan.json   当前正在推进的计划
plan-history.json  已归档的计划列表
```

源码落点：

- `../../src/task-state/task-store.ts`
- `../../src/task-state/file-task-store.ts`
- `../../src/entry/cli.ts`

## 为什么需要 history/archive/restore

如果只有 active plan，会有几个问题：

```text
做完一轮后怎么保存结果？
旧计划怎么看？
误归档后怎么恢复？
多个阶段计划怎么区分？
```

所以需要：

```text
archive  把当前计划收进历史
history  查看历史
restore  把历史重新恢复成 active
```

## active 和 archive 的边界

`active` 表示：

```text
当前 runtime / CLI 会继续操作的计划
```

这些命令都看 active：

```text
resume
status
retry
replan
```

`archive` 表示：

```text
已经从当前执行态移出的计划
```

这些命令看 history：

```text
history
history 1
restore-plan 1
```

这样职责不会混：

```text
继续执行只看 active
历史查看只看 archive
```

## archiveActive 做了什么

归档时：

```text
读取 active state
  -> 包装成 ArchivedPlanState
  -> 追加到 plan-history.json
  -> 删除 active-plan.json
```

`ArchivedPlanState` 不只是标题，而是完整状态：

```text
plan
snapshot
archivedAt
archiveReason
```

所以后续可以恢复。

## history detail 做了什么

`history` 默认列出历史摘要：

```text
planId
revision
status
goal
archivedAt
archiveReason
任务统计
```

`history 1` 查看详情：

```text
每项任务状态
blockedReason
lastResultSummary
lastExecution
```

这让 history 不只是列表，而是可复盘的任务记录。

## restoreArchived 做了什么

恢复时：

```text
从 plan-history.json 选择一条 archived plan
  -> clone 成 ActivePlanState
  -> 写入 active-plan.json
```

选择方式：

```text
不传 selector：恢复最近一条
传 index：按历史序号恢复
传 planId / snapshotId：按 ID 恢复
```

CLI 里还有 `--force`：

```text
如果当前已有 active plan，默认不覆盖
只有 --force 才覆盖
```

这是为了避免误伤当前正在推进的计划。

## 为什么 save 后还要 move 到有道目录

这是有道同步里的经验，和本地 history 不同，但思想类似：

```text
先创建
确认创建成功
如果没落到目标目录，再 move
最后 list/read 验证
```

本质都是在处理“状态已经创建，但位置不一定正确”的问题。

## 当前还没做什么

V3 第一版只做了基础 history：

```text
list
detail
archive
restore
```

还没做：

```text
搜索
分页
按状态过滤
删除某条历史
导出历史
压缩清理策略
多项目历史索引
```

这些可以作为后续增强。

## 常见误解

### 误解一：history 就是日志

不准确。这里的 history 是可恢复的 archived plan，不只是文本日志。

### 误解二：archive 后 active 应该还保留

当前设计是 archive 会清空 active，表示这张计划已经退出当前推进线。

### 误解三：restore 默认覆盖更方便

危险。默认不覆盖更安全。

## 值得记住

```text
active 负责继续执行，archive 负责历史保存，restore 负责把历史重新变成当前。
```

