# 02 - Runtime 组合根与生命周期

## 先说结论

Runtime 是系统装配层，也是外部入口理解内部系统的第一层门面。

当前项目里的核心函数是：

```text
createRuntimeBundle()
```

它做两件事：

```text
1. 把所有模块装配成一套 RuntimeBundle
2. 管理 start / stop / dispose 生命周期
```

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/runtime/lifecycle.ts`
- `../../src/runtime/factories/runtime-factories.ts`

## Runtime 为什么需要单独一层

如果没有 Runtime，CLI 可能会直接这样做：

```text
new SessionState()
new MemoryStore()
new ToolRegistry()
new ModelClient()
new AgentLoop()
agentLoop.run()
```

那 Web Gateway 也要重复一遍，桌面端也要重复一遍。每个入口都会知道系统内部怎么装配。

Runtime 的价值是把内部复杂度集中起来：

```text
entry/cli.ts
  -> createRuntimeBundle(settings)
  -> runtime.agent.run(...)
```

未来 gateway 也可以：

```text
gateway event
  -> runtime.agent.run(...)
```

入口不同，主干复用。

## Runtime 当前装配了什么

当前 `RuntimeBundle` 包含：

```text
settings
session
learning
memory
permissions
hooks
skills
plugins
reflection
gateway
mcp
tools
contextBuilder
model
planner
replanner
taskStore
taskOrchestrator
agentLoop
agent
```

这可以分成四条线：

```text
状态线：session / memory / learning / taskStore
能力线：tools / skills / plugins / mcp
治理线：permissions / hooks / reflection
主干线：contextBuilder / model / agentLoop / agent
```

再加上 V3 任务线：

```text
planner / replanner / taskOrchestrator
```

## Runtime 的生命周期

Runtime 状态：

```text
created
starting
ready
stopping
stopped
failed
disposed
```

关键约束：

```text
ready 前不能 runtime.agent.run()
disposed 后不能再次 start()
start 失败会进入 failed
dispose 会做最终清理
```

启动时：

```text
runtime:before-start
-> plugins.startEnabled()
-> mcp.start()
-> gateway.start()
-> runtime:started
-> status = ready
```

停止时：

```text
runtime:before-stop
-> gateway.stop()
-> mcp.stop()
-> plugins.stopEnabled()
-> runtime:stopped
```

清理时：

```text
gateway.dispose()
-> mcp.dispose()
-> plugins.disposeEnabled()
-> runtime:disposed
```

## Runtime 对任务系统的封装

V3 后，Runtime 不只是提供：

```text
agent.run(...)
```

还提供：

```text
plan(...)
initializePlan(...)
planAndInitialize(...)
getActivePlan()
executeCurrentTask(...)
startNextAndExecute()
resumeAndExecute()
previewReplanBlockedTask(...)
replanBlockedTask(...)
replanBlockedTaskAndExecute(...)
retryTask(...)
retryTaskAndExecute(...)
```

这让 CLI 不需要知道内部怎么串：

```text
Planner
TaskStore
TaskOrchestrator
AgentLoop
TaskExecutionEvaluator
```

CLI 只调用 runtime 方法。

## 常见误解

### 误解一：Runtime 就是创建 AgentLoop

不止。Runtime 还装配工具、插件、MCP、Gateway、任务编排和生命周期。

### 误解二：生命周期是可选的

只要系统会启动外部资源，生命周期就不是可选项。

### 误解三：Runtime 可以写很多业务细节

Runtime 可以封装稳定用例，但不要把每个模块内部细节都写进来。复杂逻辑仍应放回对应模块。

## 值得记住

```text
Runtime 回答“系统如何装起来、如何安全运行、外部如何调用内部能力”。
```

它是 Agent 系统从脚本走向工程化的关键层。

