# 日志 Preset：dev / ci / service

## 为什么需要 preset

日志配置项变多以后，如果每次都手写：

```json
{
  "level": "info",
  "format": "json",
  "provider": "pino",
  "destination": "file",
  "filePath": "./logs/harness-agent.log",
  "rotation": {
    "enabled": true,
    "maxSizeMb": 10,
    "maxFiles": 5
  }
}
```

会很累，也容易配错。

所以我们加了：

```text
logging.preset
```

它不是新的 logger 实现，而是“场景底稿”。

## 当前三个 preset

源码位置：

```text
src/config/logging-presets.ts
```

当前有：

```text
dev
ci
service
```

### dev

用于本地学习和调试。

```text
level       = info
format      = pretty
provider    = console
destination = stdout
rotation    = disabled
```

它的目标是：

```text
人容易看
不额外写文件
适合 CLI 本地跑
```

### ci

用于测试流水线。

```text
level       = info
format      = json
provider    = console
destination = stdout
rotation    = disabled
```

它的目标是：

```text
机器容易解析
输出到 stdout
不产生额外文件
```

当前测试脚本会通过 wrapper 使用更适合 CI 的日志 preset。

脚本位置：

```text
scripts/run-vitest-with-log-preset.mjs
```

### service

用于长期运行。

```text
level       = info
format      = json
provider    = pino
destination = file
filePath    = ./logs/harness-agent.log
rotation    = enabled
```

它的目标是：

```text
长期运行不刷终端
日志可持久化
文件能轮转
后续方便接日志平台
```

## preset 和显式配置怎么合并

preset 不是硬覆盖所有配置。

更准确地说：

```text
先铺 preset 默认值
再合并用户显式配置
```

例如：

```json
{
  "logging": {
    "preset": "service",
    "level": "debug"
  }
}
```

意思是：

```text
整体按 service 场景来
但日志等级改成 debug
```

这和配置系统的深合并是一条线。

## 入口层默认值

不同入口应该有不同默认策略。

当前方向：

```text
CLI     -> dev
test    -> ci
service -> service
```

另外，如果配置里没有显式指定 preset，但启用了 gateway，配置加载层可以倾向 service。

原因是：

```text
启用 gateway 往往意味着它不是一次性 CLI 命令，
更像长期运行入口。
```

## 为什么这不是“偷懒配置”

preset 的价值不是少写几行 JSON。

它真正解决的是：

```text
同一套系统在不同运行场景下应该有不同默认行为。
```

如果没有 preset，后续会出现：

```text
本地开发误写大量文件日志
CI 输出 pretty 文本不好解析
长期服务只打 stdout，日志丢失
```

## 边界

preset 不负责：

- 定义事件名
- 决定某条事件是否应该记录
- 改变业务行为

它只负责：

```text
选择一套日志基础设施默认配置。
```

