# 日志字段脱敏与错误序列化

## 为什么需要字段处理器

日志字段来自很多地方：

- 配置
- Gateway 输入
- MCP server 信息
- 模型输出
- 工具参数
- 错误对象
- 协作协议消息

这些数据不应该不加处理就进入日志。

最常见的风险是：

```text
token / password / apiKey 被打进日志
Error 对象 JSON.stringify 后信息丢失
循环引用导致序列化异常
cause 链无限展开
```

所以我们加了统一字段处理器。

## 源码落点

```text
src/logging/log-field-processor.ts
```

它被这些 logger 共用：

```text
ConsoleLogger
MemoryLogger
PinoLogger
```

这样不会出现：

```text
console 会脱敏
pino 忘了脱敏
memory 测试看到的是原始 token
```

## 脱敏做什么

配置位置：

```text
settings.logging.redactKeys
settings.logging.redactPlaceholder
```

示例配置：

```json
{
  "logging": {
    "redactKeys": ["token", "password", "secret", "apiKey"],
    "redactPlaceholder": "[REDACTED]"
  }
}
```

如果日志字段里出现：

```ts
{
  authToken: "abc",
  nested: {
    password: "123"
  }
}
```

输出会变成：

```ts
{
  authToken: "[REDACTED]",
  nested: {
    password: "[REDACTED]"
  }
}
```

注意这里不是只匹配完整字段名。

像：

```text
authToken
githubToken
apiKey
```

这类包含敏感关键词的字段也应该被遮住。

## Error 为什么要序列化

`Error` 对象直接 JSON 输出通常不稳定。

我们真正想保留的是：

```text
name
message
stack
cause
```

但 stack 可能太长，也可能包含路径。

所以配置里有：

```text
includeErrorStack
maxErrorCauseDepth
```

第一版默认比较克制：

```text
默认不展开 stack
cause 有最大深度
```

这样既保留错误摘要，又不让日志爆炸。

## 循环引用兜底

日志字段可能出现循环引用：

```ts
const payload: Record<string, unknown> = { label: "root" };
payload.self = payload;
```

如果直接 JSON 序列化，会报错。

字段处理器会把循环引用变成：

```text
[Circular]
```

这保证日志系统本身不会因为一个坏字段把业务链路拖死。

## 为什么这属于通用工程能力

脱敏、错误序列化、循环引用处理不是 Agent 独有逻辑。

它属于：

```text
通用日志基础设施
```

所以我们把它放在：

```text
src/logging/
```

而不是塞进：

```text
AgentLoop
TaskOrchestrator
TeamCoordinator
```

核心模块只传字段。

日志适配层负责清洗字段。

## 测试重点

当前测试覆盖：

- 敏感字段会被替换
- `Error` 能被结构化
- `cause` 深度会被限制
- 循环引用不会炸
- `MemoryLogger` 里看到的也是处理后的字段

测试位置：

```text
tests/logging/logger.test.ts
```

## 这个设计的边界

它不负责判断业务字段是否正确。

例如：

```text
taskId 是否存在
planId 是否匹配当前任务
followUpAction 是否符合业务状态
```

这些属于业务校验。

字段处理器只负责：

```text
让日志字段安全、稳定、可序列化。
```

