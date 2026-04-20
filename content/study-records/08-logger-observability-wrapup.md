# 学习记录-08-LoggerPort 与可观察性收口

这一阶段我们把 logger 从简单输出推进成系统可观察性的基础设施。

重点覆盖：

- LoggerPort 端口
- Console / Silent / Memory / Pino 多实现
- 结构化事件目录
- 字段脱敏与 Error 序列化
- ScopedLogger 与 trace 上下文
- pino 文件日志与轮转
- flush / dispose 生命周期
- dev / ci / service preset
- 日志 matcher
- ExecutionJournalStore 第一版

---
# LoggerPort 与结构化日志设计

这份文档只回答三件事：

1. `harness-agent-lab` 现在的日志系统已经做到哪里
2. logger 本体的边界是什么，哪些不属于 logger 本体
3. 下一步还值得继续补什么

如果想看完整事件名和字段口径，请直接看：

- [LoggerPort 事件命名表与字段规范](./logger-event-catalog.md)

---

## 一、当前状态

现在这条线已经不是“先抽一个接口”的阶段了，而是已经进入：

```text
LoggerPort 已建立
结构化事件已落地
脱敏和错误序列化已落地
pino 适配已落地
文件日志与轮转已落地
事件目录自动生成已落地
runtime / gateway / mcp / task / team / collaboration trace 已接入
```

也就是说，logger 现在已经具备：

- 统一日志接口
- 多实现切换
- 结构化字段
- 运行时校验后的稳定配置
- 面向长期运行的文件日志能力
- 面向测试的可断言能力

当前更缺的不是“怎么打印日志”，而是：

- 文档收口
- trace 继续贴近主线
- 后续平台化能力

阶段结论：

```text
logger 主体已经可以暂时告一段落。
后续不再按“补 logger”推进，
而是按“可观察性 / 诊断工具 / 恢复流水账”继续演进。
```

当前已经可以视为完成的范围：

- logger 端口与适配层
- pino / console / memory / silent 实现
- pretty / json / 文件日志 / 文件轮转
- 脱敏与错误序列化
- 事件目录自动生成
- 领域日志 matcher
- `dev / ci / service` 日志策略
- 主链结构化 trace
- execution checkpoint trace 与内存版 `ExecutionJournalStore`

---

## 二、设计目标

logger 这条线的目标不是“把一行字打到控制台”，而是：

```text
核心模块只表达“发生了什么”
基础设施层决定“这些事件最终写到哪里”
```

所以我们一直坚持这条边界：

```text
核心领域模块
  -> 只依赖 LoggerPort

日志库 / 输出目标 / 轮转 / pretty / json
  -> 都放在 logging 适配层里
```

这样做的原因很直接：

- Runtime 不应该知道 `pino` 的 API
- AgentLoop 不应该关心日志是否写文件
- Task / Team / Collaboration 不应该反向依赖某个第三方库
- 测试不应该只能靠拦截 `console.log`

---

## 三、核心边界

### 1. 属于 logger 本体的

这些文件属于 logger 核心能力：

```text
src/logging/logger.ts
src/logging/console-logger.ts
src/logging/silent-logger.ts
src/logging/memory-logger.ts
src/logging/pino-logger.ts
src/logging/logger-factory.ts
src/logging/scoped-logger.ts
src/logging/log-events.ts
src/logging/log-fields.ts
src/logging/log-field-definitions.ts
src/logging/log-field-processor.ts
src/logging/log-catalog-renderer.ts
src/logging/log-context.ts
```

这些能力解决的是：

- 日志接口长什么样
- 事件名和字段怎么统一
- 脱敏怎么做
- 错误怎么结构化
- 控制台 / 内存 / 静默 / pino 怎么切换
- 文件日志与轮转怎么做
- 事件目录怎么从源码自动生成

### 2. 不属于 logger 本体，但属于 logger 接入层的

下面这些不是 logger 核心，而是“谁来默认选哪套日志策略”：

```text
src/entry/cli.ts
src/entry/service.ts
src/entry/settings-loader.ts
scripts/run-vitest-with-log-preset.mjs
package.json
```

它们的职责是：

- CLI 默认走 `dev` 日志策略
- 测试脚本默认走 `ci` 日志策略
- service 入口默认走 `service` 日志策略

也就是说：

```text
logger 负责“日志能力”
entry / script 负责“默认选哪套策略”
```

### 3. 不属于 logger 的

下面这些虽然会产生日志，但不算 logger 自己的职责：

- Runtime 生命周期本身
- Gateway 启停逻辑
- MCP 连接逻辑
- TaskOrchestrator 状态推进
- TeamCoordinator 协调与汇总
- CollaborationLog 协议消息存储

logger 只负责观察它们，不负责替代它们。

---

## 四、当前能力地图

### 1. LoggerPort 与实现

核心接口在：

```text
src/logging/logger.ts
```

当前已有实现：

- `ConsoleLogger`
- `SilentLogger`
- `MemoryLogger`
- `PinoLogger`

工厂入口在：

```text
src/logging/logger-factory.ts
```

当前逻辑：

```text
level = silent -> SilentLogger
provider = pino -> PinoLogger
否则 -> ConsoleLogger
```

### 2. 结构化事件

事件名统一收敛在：

```text
src/logging/log-events.ts
```

字段口径统一收敛在：

```text
src/logging/log-fields.ts
src/logging/log-field-definitions.ts
```

这意味着业务层不再到处手写：

```ts
logger.info("task.completed", { ... })
```

而是优先引用统一事件常量和统一字段语义。

### 3. 字段处理

统一字段处理器在：

```text
src/logging/log-field-processor.ts
```

当前已经支持：

- 敏感字段脱敏
- `Error` 结构化序列化
- `cause` 深度控制
- 循环引用兜底

### 4. ScopedLogger

上下文预绑定在：

```text
src/logging/scoped-logger.ts
```

它解决的是：

```text
同一条 trace 里的每条日志都要重复拼 traceId / runId / planId / taskId
```

现在可以先创建带上下文的 logger，再记录单条事件自己的字段。

### 5. 文件日志与轮转

`PinoLogger` 已经支持：

- `stdout`
- 本地文件
- `json + rotation`
- `pretty + rotation`

轮转当前策略：

```text
仅支持 provider = pino
仅支持 destination = file
按大小切分
保留最近 N 份
```

Runtime 在 `stop()` 时会主动 `flush()`，在 `dispose()` 时会进一步释放 logger 资源。

这里要区分两件事：

```text
flush   = 把还在缓冲区里的日志刷出去
dispose = 刷出日志，并关闭文件 / rotation stream 等底层资源
```

这个区别在 Windows 上尤其重要：如果只 flush 不关闭文件流，测试临时目录或长期服务退出时可能还会被日志文件句柄占住。

### 6. 事件目录自动生成

当前事实源是：

```text
src/logging/log-events.ts
src/logging/log-field-definitions.ts
```

文档渲染器在：

```text
src/logging/log-catalog-renderer.ts
```

生成脚本：

```text
npm run generate:logger-catalog
```

产物：

- [logger-event-catalog.md](./logger-event-catalog.md)

---

## 五、当前配置模型

日志配置位于：

```text
src/config/settings.ts
src/config/settings-schema.ts
```

当前主要字段：

```json
{
  "logging": {
    "preset": "dev",
    "level": "info",
    "format": "pretty",
    "provider": "console",
    "destination": "stdout",
    "filePath": "./logs/runtime.log",
    "rotation": {
      "enabled": false,
      "maxSizeMb": 10,
      "maxFiles": 5
    },
    "includeErrorStack": false,
    "maxErrorCauseDepth": 2,
    "redactKeys": ["password", "secret", "token"],
    "redactPlaceholder": "[REDACTED]"
  }
}
```

### preset

当前内置三套：

```text
dev      -> pretty + console + stdout
ci       -> json + console + stdout
service  -> json + pino + file + rotation
```

注意这里不是“preset 一开就锁死”。

真实规则是：

```text
先展开 preset 作为场景底稿
再叠加当前层显式写的 logging 字段
```

所以这类配置是成立的：

```json
{
  "logging": {
    "preset": "service",
    "format": "pretty",
    "filePath": "./logs/custom.log"
  }
}
```

### 入口默认规则

当前入口层默认行为是：

```text
CLI 默认 -> dev
测试脚本默认 -> ci
service 入口默认 -> service
某些未显式指定 preset 的长期运行入口 -> 可根据 gateway 启用情况偏向 service
```

这里再次强调：

```text
这属于 entry / script 接入层，不属于 logger 本体
```

---

## 六、当前已经接到哪些主链

logger 现在已经不只是“有一个库”，而是已经接进主链观察。

### 1. Runtime

已经覆盖：

```text
runtime.start.begin
runtime.start.done
runtime.start.failed
runtime.stop.begin
runtime.stop.done
runtime.dispose.done
```

### 2. Gateway / MCP

已经覆盖：

```text
gateway.manager.*
gateway.adapter.*
mcp.manager.*
mcp.server.connected
mcp.server.disconnected
```

### 3. AgentLoop

已经覆盖：

```text
agent.turn.start
agent.context.built
agent.model.decided
agent.tool.requested
agent.tool.denied
agent.tool.executed
agent.learning.recorded
agent.reflection.completed
agent.turn.completed
agent.turn.failed
```

### 4. Task / Team

已经覆盖：

```text
task.plan.initialized
task.started
task.assigned
task.completed
task.blocked
task.failed
task.retry.scheduled
task.plan.paused
task.plan.recovered

team.frame.built
team.frame.summarized
```

### 5. review / follow-up / retry / replan

已经覆盖：

```text
review.plan.created
review.started
review.completed
review.failed

followup.decided
followup.applied
followup.skipped

retry.started
retry.prepared

replan.previewed
replan.applied
```

### 6. CollaborationLog

已经覆盖：

```text
collaboration.message.appended
collaboration.status.updated
collaboration.task.listed
collaboration.message.loaded
```

### 7. execution checkpoint trace 与 journal store 第一版

这一层现在已经分成两步落地：

第一步是 logger 观察事件：

```text
task.execution.prepared
task.batch.prepared
task.execution.committed
task.resume.prepared
```

第二步是执行流水账存储：

```text
src/execution-journal/
  execution-journal-entry.ts
  execution-journal-store.ts
  in-memory-execution-journal-store.ts
```

这一版的目标不是“真正从 task 内部断点恢复”，而是先把这些边界同时写进日志和 journal：

- 任务什么时候完成执行前准备
- batch 一次准备了几项任务
- 结构化结果什么时候真正写回 `lastExecution`
- `resume` 当前走的是不是任务边界恢复

所以它现在已经从：

```text
只能观察
```

升级成：

```text
可查询的内存执行流水账
```

但仍然还不是：

```text
文件持久化 journal
tool call 级精确续跑
```

---

## 七、测试与学习支撑

logger 现在不只是可运行，也已经可测试。

测试主要在：

```text
tests/logging/logger.test.ts
tests/logging/log-catalog-renderer.test.ts
```

另外还补了日志领域 matcher，可以直接断言：

- 是否出现某个日志事件
- 事件顺序是否正确

这让测试表达从：

```text
entries.find / entries.filter
```

升级成了：

```text
系统行为级断言
```

---

## 八、当前还缺什么

如果只问“logger 本体还缺什么”，我会把它分成三层。

### 第一层：最值得继续做的

1. **从内存 journal 走向持久化 execution journal**
   - 文件或数据库持久化记录 task 内部执行进度
   - 明确 tool round / tool call / commit checkpoint
   - 为未来精准 resume 做准备

2. **trace 继续补细**
   - reviewer 并行/顺序 trace
   - runnable batch trace
   - 多 agent 的 `agentId / workspaceId / owner` 维度

3. **日志查看能力**
   - `logs tail`
   - `logs trace <traceId>`
   - `logs task <taskId>`

这两类最贴近我们主线。

### 第二层：进入长期运行后很值

3. **远端 transport / 日志平台**
   - Loki
   - ELK / OpenSearch
   - Datadog
   - 云日志服务

当前还没有这层，只有本地 `stdout` 和本地文件。

### 第三层：可以做，但当前不急

4. **降噪 / 采样 / 限流**
5. **更细的脱敏策略**
6. **第二个 logger 适配器**

关于第 6 点，当前我不建议优先上。

因为：

```text
pino 这一条已经成熟且稳定
当前瓶颈不在“缺第二套 logger 库”
而在“主链 trace 还可以继续补细”
```

---

## 九、明确不做什么

当前阶段暂不做：

- OpenTelemetry
- 完整分布式 tracing 系统
- 大型可观测平台一体化方案
- 为了“多一个适配器”再接一套 `tslog`

原因不是这些方向没价值，而是：

```text
当前项目还是学习型、演进型架构
应该优先把自己的主链观察模型做实
再考虑外部平台化接入
```

---

## 十、推荐的下一步顺序

如果继续沿 logger 往前走，当前更推荐：

1. 把内存 execution journal store 升级成文件持久化 store
2. 补 reviewer / batch 更细粒度 trace
3. 再做日志查看命令
4. 最后再评估远端 transport

一句话总结现在的 logger 状态：

```text
核心能力已经够用了，
下一步重点不是“再换一个库”，
而是让日志更贴近多任务、多协作、可恢复这条主线。
```
