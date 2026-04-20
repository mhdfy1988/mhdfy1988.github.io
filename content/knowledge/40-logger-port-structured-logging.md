# LoggerPort 与结构化日志总览

这篇只做总览，不再把所有细节揉在一起。

logger 这一轮真正完成的是一条可观察性基础链路：

```text
LoggerPort
  -> 日志实现
  -> 事件目录
  -> 字段处理
  -> trace 上下文
  -> 文件日志与轮转
  -> 场景 preset
  -> 测试 matcher
  -> ExecutionJournal 的第一版边界记录
```

## 当前阶段结论

```text
logger 主体已完成一版。
后续重点不是继续堆 logger 类，
而是继续做可观察性、诊断工具和恢复流水账。
```

当前已经完成：

- `LoggerPort` 端口
- `ConsoleLogger / SilentLogger / MemoryLogger / PinoLogger`
- `pretty / json / file / rotation`
- 脱敏与 `Error` 结构化序列化
- 事件名和字段规范
- 事件目录自动生成
- 日志领域 matcher
- `dev / ci / service` 日志策略
- runtime / gateway / mcp / task / team / collaboration 主链 trace
- review / follow-up / retry / replan trace
- execution checkpoint trace
- 内存版 `ExecutionJournalStore`

还没做、但属于后续增强：

- 文件持久化版 `ExecutionJournalStore`
- tool call / round 级精确恢复
- 日志查看命令
- 远端 transport / 日志平台

## 为什么要拆成多篇

原来的这篇文档同时讲了：

- 日志端口
- 适配器模式
- 事件目录
- 字段脱敏
- trace 上下文
- pino 文件日志
- flush / dispose 生命周期
- preset
- matcher
- ExecutionJournal

作为阶段开发记录没问题，但作为知识点复习会很难查。

现在拆成：

```text
40 总览：logger 这一轮完成了什么
41 端口与适配器：为什么核心模块只依赖 LoggerPort
42 结构化事件目录：为什么日志要用稳定事件名和字段
43 字段脱敏与错误序列化：不可信字段怎么进入日志
44 ScopedLogger 与 trace 上下文：怎么把一条链路串起来
45 pino 文件日志与轮转：成熟库怎么接入基础设施能力
46 flush / dispose 生命周期：刷日志和释放资源不是一回事
47 dev / ci / service preset：不同入口的日志策略
48 日志 matcher：测试里怎么断言日志行为
49 ExecutionJournal vs Logger：观察日志和恢复流水账的边界
```

## 入口索引

1. [LoggerPort 端口与适配器](./41-logger-port-and-adapter.md)
2. [结构化日志事件目录](./42-structured-log-event-catalog.md)
3. [日志字段脱敏与错误序列化](./43-log-field-redaction-error-serialization.md)
4. [ScopedLogger 与 Trace 上下文](./44-scoped-logger-trace-context.md)
5. [Pino 文件日志与轮转](./45-pino-file-logging-rotation.md)
6. [Logger flush / dispose 生命周期](./46-logger-flush-dispose-lifecycle.md)
7. [日志 Preset：dev / ci / service](./47-logging-presets-dev-ci-service.md)
8. [日志 Matcher 与测试断言](./48-log-matchers-testing.md)
9. [ExecutionJournal 与 Logger 的边界](./49-execution-journal-vs-logger.md)

## 源码主入口

```text
src/logging/
src/runtime/factories/logger-factory.ts
src/runtime/runtime-bundle.ts
src/agent/agent-loop.ts
src/team/
src/execution-journal/
tests/logging/
```

如果只想从代码入口开始看，建议顺序是：

```text
src/logging/logger.ts
  -> src/logging/logger-factory.ts
  -> src/runtime/factories/logger-factory.ts
  -> src/runtime/runtime-bundle.ts
  -> tests/logging/logger.test.ts
```
