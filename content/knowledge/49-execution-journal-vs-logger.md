# ExecutionJournal 与 Logger 的边界

## 为什么它要从 logger 里拆出来

`ExecutionJournalStore` 很容易被误解成“更详细的日志”。

但它和 `LoggerPort` 不是一类东西。

可以这样区分：

```text
LoggerPort          = 观察系统发生了什么
ExecutionJournal    = 给恢复继续留下结构化依据
TaskSnapshot        = 保存当前任务状态事实
CollaborationLog    = 保存多 Agent 协作协议事实
```

所以 `ExecutionJournalStore` 应该单独成篇。

## LoggerPort 负责什么

LoggerPort 负责记录：

```text
runtime.start.done
task.started
agent.turn.start
review.completed
followup.applied
```

这些事件回答的是：

```text
什么时候发生了什么
当时带了哪些字段
```

它适合：

- 排查
- 监控
- 测试观察
- 后续日志平台采集

但它不适合承担恢复依据。

原因是：

```text
日志可以被采样
日志可能按等级过滤
日志可能只写 stdout
日志字段不一定完整到能恢复执行
```

## ExecutionJournalStore 负责什么

源码位置：

```text
src/execution-journal/
```

当前接口：

```text
append
list
listByTask
getLatestCheckpoint
```

当前 phase：

```text
resume_prepared
task_prepared
batch_prepared
task_committed
```

它回答的是：

```text
这个任务执行到了哪个边界
这个边界有没有足够结构化 payload
下次恢复可以从哪个任务边界重新调度
```

## 第一版记录哪些边界

第一版只记录任务边界级 checkpoint：

```text
resume_prepared
task_prepared
batch_prepared
task_committed
```

也就是说，现在能做到：

```text
任务执行前有准备记录
批次执行前有准备记录
任务提交后有提交记录
resume 时有恢复准备记录
```

它还不能做到：

```text
一轮 Agent 内第 3 个 tool call 后中断
下次从第 4 个 tool call 精确恢复
```

当前还是：

```text
任务边界恢复
```

不是：

```text
轮内精确恢复
```

## 为什么先做内存版

当前实现：

```text
InMemoryExecutionJournalStore
```

原因是：

```text
先把接口和调用点打通
先验证 Runtime 什么时候 append
先让测试能覆盖行为
```

如果一开始就做文件持久化，会同时面对：

- 文件格式
- schema 校验
- 并发写入
- 旧数据迁移
- 清理策略
- 恢复策略

第一版先不把问题堆在一起。

## 它和 TaskSnapshot 的关系

`TaskSnapshot` 是当前计划状态：

```text
任务是 pending / running / completed / blocked
谁是 owner
lastExecution 是什么
history/archive 是什么
```

`ExecutionJournalStore` 是执行流水账：

```text
某个时间点准备执行了什么
某个任务什么时候提交了结果
当时 traceId / runId 是什么
```

它们可以互相对照，但不替代。

如果只靠 TaskSnapshot，无法知道执行链路中间发生过哪些边界动作。

如果只靠 ExecutionJournal，也不能知道当前计划最终状态。

## 它和 CollaborationLog 的关系

`CollaborationLog` 保存协议消息：

```text
task-handoff
review-request
review-result
completion-summary
escalation-notice
```

这些是多 Agent 协作事实。

`ExecutionJournalStore` 保存执行边界。

比如：

```text
某个 handoff 写进 CollaborationLog
Runtime 准备执行该 task
Agent 执行完成
Runtime commit 结果
```

这些可以通过 `traceId / taskId` 串起来。

## 后续增强方向

下一步值得做：

1. 文件版 `ExecutionJournalStore`
2. Zod 校验 journal entry
3. CLI 查询命令
4. Runtime resume 时优先读取 latest checkpoint
5. tool call / round 级 execution journal
6. 中断后从轮内 checkpoint 精确恢复

当前阶段先记住一句：

```text
Logger 是观察系统，ExecutionJournal 是恢复依据。
```

