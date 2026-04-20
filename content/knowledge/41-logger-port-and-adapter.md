# LoggerPort 端口与适配器

## 它解决什么问题

最开始我们只有一个朴素需求：

```text
系统运行时要能打印日志。
```

但 Agent 系统越往后走，日志就不只是打印一行字了。

它会服务于：

- CLI 本地调试
- 长期运行 service
- Gateway 没有终端窗口时的诊断
- 多 Agent 协作链路排查
- 测试断言
- 未来接日志平台

如果每个模块直接写：

```ts
console.log("runtime started");
```

后面会变成：

```text
用户输出和内部日志混在一起
没有统一等级
没有统一字段
不能稳定测试
未来换 pino / tslog / 远端日志平台时要全项目改
```

所以我们先抽自己的端口：

```text
LoggerPort
```

## 核心接口

源码位置：

```text
src/logging/logger.ts
```

当前接口很小：

```ts
export interface LoggerPort {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}
```

这个接口刻意不暴露 pino、console、文件流、transport 这些概念。

原因是：

```text
核心模块只需要表达“发生了什么”
基础设施层才决定“怎么输出、输出到哪里”
```

## 当前实现

当前有四个实现：

```text
ConsoleLogger
SilentLogger
MemoryLogger
PinoLogger
```

对应源码：

```text
src/logging/console-logger.ts
src/logging/silent-logger.ts
src/logging/memory-logger.ts
src/logging/pino-logger.ts
```

它们都实现同一个 `LoggerPort`。

### ConsoleLogger

用于本地 CLI 或学习阶段。

它可以输出：

```text
pretty
json
```

`pretty` 方便人看：

```text
2026-01-02T03:04:05.000Z INFO runtime.start.done {"runtimeStatus":"ready"}
```

`json` 方便机器处理：

```json
{
  "timestamp": "2026-01-02T03:04:05.000Z",
  "level": "info",
  "message": "runtime.start.done",
  "fields": {
    "runtimeStatus": "ready"
  }
}
```

### SilentLogger

用于默认安静场景。

例如：

```text
直接 new 某个领域模块
单元测试不关心日志
用户显式配置 logging.level = silent
```

它的价值不是“功能多”，而是守住默认不扰民。

### MemoryLogger

主要给测试用。

它把日志留在内存数组里，测试可以断言：

```text
某个事件是否出现
字段是否正确
事件顺序是否正确
```

这比捕获 `console.log` 稳定很多。

### PinoLogger

用于成熟基础设施能力：

```text
pino
pino-pretty
pino-roll
rotating-file-stream
```

但这些第三方库只出现在适配层里。

核心模块依然只看见：

```text
LoggerPort
```

## 工厂注入

源码位置：

```text
src/logging/logger-factory.ts
src/runtime/factories/logger-factory.ts
```

当前链路是：

```text
settings.logging
  -> createRuntimeLogger()
  -> createLogger()
  -> ConsoleLogger / SilentLogger / PinoLogger
  -> RuntimeBundle.logger
```

Runtime 不直接写：

```ts
new PinoLogger(...)
```

而是依赖：

```text
RuntimeFactories.createLogger
```

这样后面换日志库、增加文件日志、增加远端 transport，都不会污染核心业务代码。

## 这里用到的设计模式

这是典型的：

```text
端口与适配器（Ports and Adapters）
```

也可以理解为：

```text
Adapter Pattern
```

项目自己的端口是：

```text
LoggerPort
```

外部实现是：

```text
console / pino / memory
```

适配层负责把项目语义翻译给具体库。

## 边界

`LoggerPort` 不负责：

- 任务状态持久化
- 任务恢复
- 协作协议事实
- 用户界面输出
- 日志查询命令

这些后续会由：

```text
TaskSnapshot
CollaborationLog
ExecutionJournalStore
CLI / Gateway / Service
```

分别承担。

## 第一版为什么这样做

第一版目标不是“做一个完整日志平台”。

第一版只保证：

```text
核心模块不再被 console.log 绑死
日志事件能被测试
后续能接成熟日志库
```

这就是我们这一轮最重要的工程边界。

