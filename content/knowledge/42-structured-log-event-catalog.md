# 结构化日志事件目录

## 为什么日志要变成事件

坏的日志写法是：

```ts
logger.info(`gateway ${name} started`);
```

这对人眼短期看可以，但对系统长期演进不友好。

它的问题是：

```text
字符串不稳定
不好搜索聚合
测试难断言
字段语义丢失
同一个意思可能写成多种文本
```

所以我们改成：

```ts
logger.info(LOG_EVENTS.gatewayStarted, {
  gatewayName: name,
});
```

这里的核心变化是：

```text
message = 稳定事件名
fields  = 结构化字段
```

## 源码落点

事件定义：

```text
src/logging/log-events.ts
```

字段定义：

```text
src/logging/log-field-definitions.ts
```

字段类型：

```text
src/logging/log-fields.ts
```

事件目录渲染器：

```text
src/logging/log-catalog-renderer.ts
```

自动生成文档：

```text
docs/integrations/logger-event-catalog.md
```

生成命令：

```text
npm run generate:logger-catalog
```

## LOG_EVENTS 的作用

`LOG_EVENTS` 是代码使用的事件枚举。

例如：

```text
runtime.start.begin
runtime.start.done
gateway.started
agent.turn.start
task.completed
review.completed
followup.applied
replan.applied
```

代码里不要到处手写字符串。

推荐写法是：

```ts
logger.info(LOG_EVENTS.taskCompleted, {
  taskId,
  taskTitle,
});
```

这样做的好处：

- 事件名统一
- 重命名可控
- 测试可以检查事件目录完整性
- 文档可以自动生成
- 后续日志平台可以按事件名聚合

## LOG_EVENT_DEFINITIONS 的作用

`LOG_EVENT_DEFINITIONS` 是事件元数据。

它描述：

```text
事件名
默认等级
所属分类
中文说明
关键字段
```

它不是给业务逻辑做分支判断的。

它更像“日志协议表”。

比如一条事件不只是：

```text
task.completed
```

它还应该知道：

```text
category = task
level    = info
fields   = planId / snapshotId / taskId / taskStatus / summary
```

## 字段目录的意义

字段目录统一这些名字：

```text
traceId
runId
planId
snapshotId
taskId
taskTitle
gatewayName
serverName
toolName
errorMessage
attemptCount
durationMs
```

如果没有字段目录，很容易出现：

```text
gateway / gatewayName 混用
mcpServer / serverName 混用
task / taskId 混用
error / errorMessage 混用
```

字段名一乱，日志平台和测试都会变得很难维护。

## 当前事件分类

当前事件大致分成：

```text
runtime
plugin
gateway
mcp
tool
agent
task
team
collaboration
review
followup
retry
replan
```

这说明日志已经覆盖了：

- Runtime 生命周期
- Gateway 入口管理
- MCP 连接管理
- Agent 单轮执行
- 任务状态推进
- TeamCoordinator 协调决策
- CollaborationLog 协议事实读写
- Review 子流程
- FollowUp / Retry / Replan 自动推进

## 自动生成目录的价值

如果事件文档靠手写，后面一定会过期。

所以当前采用：

```text
代码里的事件定义
  -> renderLogEventCatalogMarkdown()
  -> logger-event-catalog.md
```

这样文档不是“另写一份真相”，而是从代码事实源渲染出来。

这条经验很重要：

```text
凡是容易和代码脱节的协议表，尽量让代码成为事实源。
```

## 新增事件的规则

新增日志事件时，建议按这个顺序：

1. 先确认它属于哪个分类。
2. 在 `LOG_EVENTS` 里加稳定事件名。
3. 在 `LOG_EVENT_DEFINITIONS` 里写中文说明、等级、字段。
4. 字段如果是新语义，先加到字段目录。
5. 写测试覆盖事件出现或顺序。
6. 重新生成 `logger-event-catalog.md`。

不要临时在业务代码里写一个字符串就完事。

## 它和业务协议的区别

日志事件不是业务协议。

例如：

```text
collaboration.message.appended
```

只是说“协作消息被写入日志观察到了”。

真正的协作事实在：

```text
CollaborationLog
```

同理：

```text
task.completed
```

只是观察记录。

真正的任务状态事实在：

```text
TaskSnapshot
```

这个边界要一直守住。

