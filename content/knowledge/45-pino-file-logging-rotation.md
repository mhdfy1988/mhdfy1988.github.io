# Pino 文件日志与轮转

## 为什么要接 pino

前面我们先做了：

```text
LoggerPort
ConsoleLogger
MemoryLogger
SilentLogger
```

这是为了把核心边界立住。

但长期运行的 service 不能只靠 `console.log`。

它需要：

- 写入文件
- JSON 结构化输出
- pretty 人类可读输出
- 日志轮转
- 和成熟 Node 生态兼容

这些属于通用工程能力。

所以我们引入成熟库：

```text
pino
pino-pretty
pino-roll
rotating-file-stream
```

但它们只出现在：

```text
src/logging/pino-logger.ts
```

核心模块依然只依赖：

```text
LoggerPort
```

## 当前能力

`PinoLogger` 支持：

```text
stdout
file
json
pretty
rotation
```

第一版轮转策略：

```text
仅 provider = pino
仅 destination = file
按大小切分
保留最近 N 份
```

配置示意：

```json
{
  "logging": {
    "provider": "pino",
    "destination": "file",
    "format": "json",
    "filePath": "./logs/harness-agent.log",
    "rotation": {
      "enabled": true,
      "maxSizeMb": 10,
      "maxFiles": 5
    }
  }
}
```

## 为什么不能自己手写轮转

文件日志轮转看起来简单：

```text
超过大小就改名
再开一个新文件
删掉旧文件
```

但真实场景里会遇到：

- Windows 文件句柄
- 并发写入
- 文件流 flush
- 文件名规则
- 进程退出时收尾
- 旧文件清理

这些不是 Agent 核心领域逻辑。

所以使用成熟库更合适。

这符合我们现在的依赖原则：

```text
核心架构自己掌握
通用工程能力优先学习成熟方案
第三方库通过适配层隔离
```

## json + rotation

JSON 日志适合机器采集。

例如后面接：

```text
日志平台
CI 解析
诊断命令
trace 聚合
```

每一行都是可解析对象。

这一类场景现在走：

```text
PinoLogger
  -> pino
  -> pino-roll
```

## pretty + rotation

pretty 日志适合人看。

例如本地长期跑 service，但还不想接日志平台时。

这一类场景现在走：

```text
PinoLogger
  -> pino-pretty
  -> rotating-file-stream
```

也就是说：

```text
JSON 日志可以轮转
人类可读日志也可以轮转
```

## PinoLogger 的边界

`PinoLogger` 负责：

- 把项目日志事件翻译给 pino
- 处理输出目标
- 处理 pretty/json
- 处理文件和轮转
- 在 dispose 时关闭底层流

它不负责：

- 定义事件名
- 判断任务状态
- 做业务恢复
- 决定什么时候记录某个事件

这些仍然在对应领域模块里。

## 测试重点

当前测试覆盖：

- provider = pino 时工厂返回 `PinoLogger`
- JSON 文件日志可写入
- 敏感字段会被脱敏
- JSON rotation 会产生多个文件
- pretty rotation 会产生可读日志
- 文件流在测试结束时能释放

测试位置：

```text
tests/logging/logger.test.ts
```

