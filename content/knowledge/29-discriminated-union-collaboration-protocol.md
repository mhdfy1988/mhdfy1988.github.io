# 判别式联合与协作协议

## 它是什么

判别式联合（Discriminated Union）是一种用固定字段区分数据形状的建模方式。

在当前项目里，这个固定字段就是：

```text
kind
```

例如：

```text
kind = task-handoff
payload = TaskHandoffRequest

kind = completion-summary
payload = CompletionSummaryPayload

kind = review-result
payload = ReviewResultPayload
```

也就是说，`kind` 决定 `payload` 应该长什么样。

## 为什么需要它

多 Agent 协作协议里，所有消息都有一层公共信封：

```text
protocolVersion
messageId
conversationId
planId
taskId
fromOwner
toOwner
status
createdAt
updatedAt
reason
payload
```

但不同消息的 `payload` 完全不一样。

例如：

```text
task-handoff:
  goal
  taskTitle
  taskSummary
  expectedOutput
  acceptanceCriteria

review-result:
  verdict
  summary
  findings
  requiredActions
  suggestedFollowUp
```

如果只校验公共字段，就会出现一种危险情况：

```text
kind 写的是 completion-summary
payload 却还是 task-handoff 的结构
```

这种数据单看外层是合法的，但传给 `TeamCoordinator` 后会读错字段。

## 当前仓库里的落点

本轮新增：

```text
src/team/collaboration-schema.ts
```

核心 schema：

```ts
export const CollaborationEnvelopeSchema = z.discriminatedUnion("kind", [
  TaskHandoffEnvelopeSchema,
  CompletionSummaryEnvelopeSchema,
  ReviewRequestEnvelopeSchema,
  ReviewResultEnvelopeSchema,
  BlockerReportEnvelopeSchema,
  ClarificationRequestEnvelopeSchema,
  EscalationNoticeEnvelopeSchema,
]);
```

接入位置：

```text
src/team/file-collaboration-log.ts
```

现在 `FileCollaborationLog` 会在三个点校验协议：

```text
append:
  写入前校验单条消息

readAll:
  从文件读出后校验整组消息

writeAll:
  写文件前再次校验整组消息
```

## 它解决什么问题

这一步解决的是“跨 Agent 消息不可信”的问题。

协作日志虽然是项目自己写的文件，但它会跨轮、跨命令、未来甚至跨进程存在。

所以它不能被当成纯内部对象。

它必须像这样被检查：

```text
协作日志文件
  ↓
JSON.parse()
  ↓
CollaborationEnvelopeSchema
  ↓
可信协作消息
  ↓
TeamCoordinator
```

## 和普通 union 的区别

普通 union 是：

```text
这个数据可能是 A，也可能是 B，也可能是 C。
```

判别式联合是：

```text
先看 kind。
kind 是 A，就按 A 的 schema 校验。
kind 是 B，就按 B 的 schema 校验。
```

它更适合协议消息，因为协议消息通常天然有一个类型字段。

## 一个具体例子

下面这条消息应该失败：

```json
{
  "kind": "completion-summary",
  "payload": {
    "goal": "实现协作日志",
    "taskTitle": "补日志"
  }
}
```

原因是：

```text
completion-summary 需要 summary / outputs / artifactRefs。
goal / taskTitle 属于 task-handoff。
```

这就是判别式联合的价值：它不只是看字段是不是存在，还看字段和消息类型是不是匹配。

## 对 Agent 架构的意义

V6 显式协作协议会越来越依赖这些消息：

- `task-handoff`：上游把任务交给下游。
- `completion-summary`：执行者返回完成摘要。
- `review-request`：请求审查。
- `review-result`：返回审查结论。
- `blocker-report`：汇报阻塞。
- `escalation-notice`：升级到人工、replan 或主协调者。

如果这些消息不稳定，多 Agent 协作就会变成“大家说的不是同一种话”。

所以协议 schema 的作用是：

```text
让每个 Agent 说同一种格式的话。
```

这比单纯写 TypeScript interface 更进一步，因为它能在运行时拦住坏消息。

## 后续怎么增强

后续可以继续增强：

- 给协议加 `schemaVersion` 或继续使用 `protocolVersion` 做迁移。
- 给每种消息加更细的不变式，例如 `review-result.parentMessageId` 必须指向 `review-request`。
- 给 `conversationId / planId / taskId` 做跨消息一致性校验。
- 在 Gateway / MCP / 多进程 Agent 通信中复用这套 schema。

第一版先不做这些复杂规则。

当前这一刀先保证：

```text
消息类型和 payload 形状必须匹配。
```
