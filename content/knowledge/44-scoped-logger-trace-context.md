# ScopedLogger 与 Trace 上下文

## 问题从哪里来

当日志事件越来越多以后，我们不只想知道：

```text
发生了什么
```

还想知道：

```text
这些事件是不是同一条执行链路里的
```

比如一项任务执行可能经过：

```text
task.started
team.frame.built
agent.turn.start
agent.tool.executed
review.completed
team.frame.summarized
task.completed
```

如果每条日志没有共同 ID，后面排查会很痛苦。

所以我们引入：

```text
traceId
runId
```

## traceId 和 runId 的区别

当前约定：

```text
traceId = 跨模块执行链路 ID
runId   = 某个具体执行单元的运行 ID
```

一个任务级 trace 可能包含多个 run：

```text
同一个 traceId
  -> main executor runId
  -> reviewer runId
  -> retry runId
```

所以：

```text
按 traceId 查，可以看整条任务链
按 runId 查，可以看某个执行单元
```

## ScopedLogger 解决什么

如果每条日志都手动写：

```ts
logger.info(LOG_EVENTS.agentTurnStart, {
  traceId,
  runId,
  sessionId,
  turnNumber,
});

logger.debug(LOG_EVENTS.agentContextBuilt, {
  traceId,
  runId,
  sessionId,
  turnNumber,
  messageCount,
});
```

代码会重复很多。

所以我们加了：

```text
ScopedLogger
```

源码位置：

```text
src/logging/scoped-logger.ts
src/logging/log-context.ts
```

使用方式：

```ts
const turnLogger = createScopedLogger(logger, {
  traceId,
  runId,
  sessionId,
  turnNumber,
});

turnLogger.info(LOG_EVENTS.agentTurnStart);
turnLogger.debug(LOG_EVENTS.agentContextBuilt, {
  messageCount,
});
```

每条日志都会自动带上 scope 字段。

## 为什么不把 scope 加进 LoggerPort

我们没有把接口改成：

```ts
logger.withFields(...)
```

原因是：

```text
LoggerPort 要保持最小
ScopedLogger 只是外层组合能力
底层 logger 不需要知道 scope 的存在
```

这样 `ConsoleLogger / MemoryLogger / PinoLogger` 都不用改接口。

## 字段合并规则

`ScopedLogger` 让 scope 字段优先级更高。

也就是说：

```ts
const logger = createScopedLogger(baseLogger, {
  traceId: "trace-fixed",
});

logger.info(LOG_EVENTS.taskStarted, {
  traceId: "trace-wrong",
});
```

最终还是：

```text
traceId = trace-fixed
```

原因是：

```text
链路 ID 不能被单条事件偷偷改掉
```

如果确实要切换 trace，就应该创建新的 scoped logger。

## 当前接入位置

当前已经接入：

```text
AgentLoop 单轮
Runtime 任务执行链
TeamCoordinator 协调帧
Review 子流程
FollowUp / Retry / Replan 链路
CollaborationLog 读写
```

关键源码：

```text
src/agent/agent-loop.ts
src/runtime/runtime-bundle.ts
src/team/default-team-coordinator.ts
src/team/in-memory-collaboration-log.ts
src/team/file-collaboration-log.ts
```

## 当前边界

现在已经做到：

```text
任务边界级 trace
review / followup / retry / replan 子链路 trace
协作日志读写 trace
```

还没做到：

```text
每一次 tool call 的独立 checkpoint
模型 token 级事件
round 内精确恢复
远端 trace 平台
```

这也是后续 `ExecutionJournalStore` 要继续补的方向。

